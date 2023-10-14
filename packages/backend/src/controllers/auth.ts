import { createHmac } from "crypto"
import { Express, Request, RequestHandler, Response } from "express"
import {
  generateAuthenticationOptions,
  VerifiedAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server"
import {
  AuthenticationResponseJSON
} from "@simplewebauthn/typescript-types"
import { Settings } from "../data/settings.js"
import { Credential } from "../entities/credential.js"
import { User } from "../entities/user.js"
import { sendJwt } from "./jwt.js"
import { Repository } from "typeorm"
import { getAuditService } from "../services/audit.js"

export interface ChallengeValidator {
  timestamp: number
  hmac: string
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function getHmac(settings: Settings, challenge: string, timestamp: number): string {
  return createHmac(settings.rpHmacAlgo, settings.rpHmacSecret)
    .update(`${timestamp}`)
    .update(challenge)
    .digest("base64url")
}

function buildValidator(settings: Settings, challenge: string): ChallengeValidator {
  const timestamp = now()
  return { timestamp, hmac: getHmac(settings, challenge, timestamp) }
}

function validate(
  settings: Settings,
  challenge: string,
  validator: ChallengeValidator,
  maxAgeSeconds = 60
): boolean {
  return (
    now() - validator.timestamp <= maxAgeSeconds &&
    getHmac(settings, challenge, validator.timestamp) === validator.hmac
  )
}

export function initializeAuth(app: Express, settings: Settings, credentialRepo: Repository<Credential>, userRepo: Repository<User>) {
  app.get("/auth/options", (async (req: Request, res: Response) => {
    const authenticationOptions = await generateAuthenticationOptions({
      timeout: 60000,
      userVerification: "required",
      rpID: settings.rpId,
    })
    const challengeValidator = buildValidator(settings, authenticationOptions.challenge)
    return res.send({
      ...authenticationOptions,
      challengeValidator,
    })
  }) as RequestHandler)

  app.post("/auth/verify", (async (req: Request, res: Response) => {
    const body: {
      response: AuthenticationResponseJSON,
      challengeValidator: ChallengeValidator,
    } = req.body
    const credentialID = Buffer.from(body.response.rawId, "base64url")
    const authenticator = await credentialRepo.findOneBy({
      credentialID,
    })
    if (authenticator === null) {
      return res.status(404).send({ message: "Credential not found" })
    }
    let verification: VerifiedAuthenticationResponse
    try {
      const opts: VerifyAuthenticationResponseOpts = {
        response: body.response,
        expectedChallenge: (c) => validate(settings, c, body.challengeValidator),
        expectedOrigin: settings.origin,
        expectedRPID: settings.rpId,
        authenticator,
        requireUserVerification: true,
      }
      verification = await verifyAuthenticationResponse(opts)
    } catch (error) {
      console.error(error)
      return res.status(400).send({ message: "Credential not valid" })
    }

    const { verified, authenticationInfo } = verification
    if (!verified) {
      console.warn("Unverified credential")
      return res.status(400).send({ message: "Credential not valid" })
    }

    const userPromise = userRepo.findOne({
      where: { id: authenticator.userId },
      relations: { roles: true },
     })

    // Update the authenticator's counter in the DB to the newest count in the authentication
    try {
      await credentialRepo.update(
        { credentialID },
        { counter: authenticationInfo.newCounter }
      )
    } catch (error) {
        console.error(error)
        return res.sendStatus(409)
    }

    const user = await userPromise
    if (user == null) {
      console.warn("Unverified credential")
      return res.status(404).send({ message: "User not found" })
    }

    getAuditService().authenticated(user, authenticator)
    return sendJwt(res, user, settings)
  }) as RequestHandler)
}
