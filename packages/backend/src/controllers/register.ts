import {
  generateRegistrationOptions,
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from "@simplewebauthn/server"
import { RegistrationResponseJSON } from "@simplewebauthn/typescript-types"
import { Express, Request, RequestHandler, Response } from "express"
import { Repository } from "typeorm"
import { Credential } from "../entities/credential.js"
import { Invitation, isExpired } from "../entities/invitation.js"
import { Settings } from "../data/settings.js"
import { sendJwt } from "./jwt.js"

export function initializeRegistry(app: Express, settings: Settings, credentialRepo: Repository<Credential>, invitationRepo: Repository<Invitation>) {
  app.get("/register/:invitationId", (_, res) =>
    res.sendFile("register/index.html", { root: "public", maxAge: 0 })
  )

  app.get(
    "/register/:invitationId/options",
    (async (req: Request, res: Response) => {
      const invitation = await invitationRepo.findOneBy({
        id: req.params.invitationId,
      })
      if (invitation == null || isExpired(invitation)) {
        return res
          .status(400)
          .send({message: "Registration invitation not found or expired"})
      }

      const credentials = await credentialRepo.findBy({
        userId: invitation.userId,
      })
      const options = await generateRegistrationOptions({
        rpName: settings.rpName,
        rpID: settings.rpId,
        userID: invitation.user.id,
        userName: invitation.user.name,
        userDisplayName: invitation.user.displayName,
        challenge: invitation.challenge,
        timeout: 60000,
        attestationType: "none",
        excludeCredentials: credentials.map((credential) => ({
          id: credential.credentialID,
          type: "public-key",
          transports: credential.transports,
        })),
        /**
         * The optional authenticatorSelection property allows for specifying more constraints around
         * the types of authenticators that users to can use for registration
         */
        authenticatorSelection: {
          userVerification: "required",
          residentKey: "required",
        },
        /**
         * Support the two most common algorithms: ES256, and RS256
         */
        supportedAlgorithmIDs: [-8, -7, -257],
      })
      res.send(options)
    }
  ) as RequestHandler)

  app.post(
    "/register/:invitationId/verify",
    (async (req: Request, res: Response) => {
      const invitation = await invitationRepo.findOneBy({
        id: req.params.invitationId,
      })
      if (invitation == null || isExpired(invitation)) {
        return res
          .status(400)
          .send({message: "Registration invitation not found or expired"})
      }
      const body: {
        response: RegistrationResponseJSON
        displayName: string
      } = req.body
      const { response, displayName } = body
      let verification: VerifiedRegistrationResponse
      try {
        const opts: VerifyRegistrationResponseOpts = {
          response,
          expectedChallenge: invitation.challenge.toString("base64url"),
          expectedOrigin: settings.origin,
          expectedRPID: settings.rpId,
          requireUserVerification: true,
        }
        verification = await verifyRegistrationResponse(opts)
      } catch (error) {
        console.error(error)
        return res
          .status(400)
          .send({message: "Registration invitation not found or expired"})
      }

      const { verified, registrationInfo } = verification
      if (!verified || !registrationInfo) {
        return res
          .status(400)
          .send({message: "Registration invitation not found or expired"})
      }

      const { credentialPublicKey, credentialID, counter } = registrationInfo
      const cred = credentialRepo.create({
        credentialID,
        user: invitation.user,
        displayName: `${displayName}`,
        credentialPublicKey,
        counter,
        transports: response.response.transports,
      })
      try {
        await credentialRepo.insert(cred)
        await invitationRepo.delete(invitation.id)
      } catch (error) {
        console.error(error)
        return res.sendStatus(409)
      }
      return sendJwt(res, invitation.user, settings)
    }
  ) as RequestHandler)
}
