import { createHmac } from "crypto"
import { Express, Request, Response } from "express"
import {
  generateAuthenticationOptions,
  VerifiedAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server"
import {
  AuthenticationCredentialJSON,
} from "@simplewebauthn/typescript-types"
import { RP_ID, RP_HMAC_ALGO, RP_HMAC_SECRET, ORIGIN } from "../settings"
import { CredentialRepository, UserRepository } from "../datasource"
import { sendJwt } from "./jwt"

export interface ChallengeValidator {
  timestamp: number
  hmac: string
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function getHmac(challenge: string, timestamp: number): string {
  return createHmac(RP_HMAC_ALGO, RP_HMAC_SECRET)
    .update(`${timestamp}`)
    .update(challenge)
    .digest("base64url")
}

function buildValidator(challenge: string): ChallengeValidator {
  const timestamp = now()
  return { timestamp, hmac: getHmac(challenge, timestamp) }
}

function validate(
  challenge: string,
  validator: ChallengeValidator,
  maxAgeSeconds = 60
): boolean {
  return (
    now() - validator.timestamp <= maxAgeSeconds &&
    getHmac(challenge, validator.timestamp) === validator.hmac
  )
}

export function initializeAuth(app: Express) {
  app.get("/auth/options", (req: Request, res: Response) => {
    const authenticationOptions = generateAuthenticationOptions({
      timeout: 60000,
      userVerification: "required",
      rpID: RP_ID,
    })
    const challengeValidator = buildValidator(authenticationOptions.challenge)
    return res.send({
      ...authenticationOptions,
      challengeValidator,
    })
  })

  app.post("/auth/verify", async (req: Request, res: Response) => {
    const body: {
      credential: AuthenticationCredentialJSON
      challengeValidator: ChallengeValidator
    } = req.body
    const credentialID = Buffer.from(body.credential.rawId, "base64url")
    const authenticator = await CredentialRepository.findOneBy({
      credentialID,
    })
    if (authenticator == null) {
      return res.status(404).send({ message: "Credential not found" })
    }
    let verification: VerifiedAuthenticationResponse
    try {
      const opts: VerifyAuthenticationResponseOpts = {
        credential: body.credential,
        expectedChallenge: (c) => validate(c, body.challengeValidator),
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
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

    const userPromise = UserRepository.findOneBy({ id: authenticator.userId })
    // Update the authenticator's counter in the DB to the newest count in the authentication
    await CredentialRepository.update(
      { credentialID },
      { counter: authenticationInfo.newCounter }
    )
    return sendJwt(res, await userPromise)
  })
}
