import {
  generateRegistrationOptions,
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from "@simplewebauthn/server"
import { RegistrationCredentialJSON } from "@simplewebauthn/typescript-types"
import { Express, Request, Response } from "express"
import { CredentialRepository, InvitationRepository } from "../datasource"
import { isExpired } from "../entities/invitation"
import { ORIGIN, RP_ID, RP_NAME } from "../settings"
import { sendJwt } from "./jwt"

export function initializeRegistry(app: Express) {
  app.get("/register/:invitationId", (_, res) =>
    res.sendFile("register/index.html", { root: "public", maxAge: 0 })
  )

  app.get(
    "/register/:invitationId/options",
    async (req: Request, res: Response) => {
      const invitation = await InvitationRepository.findOneBy({
        id: req.params.invitationId,
      })
      if (invitation == null || isExpired(invitation)) {
        return res
          .status(400)
          .send({message: "Registration invitation not found or expired"})
      }

      const credentials = await CredentialRepository.findBy({
        userId: invitation.userId,
      })
      const options = generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
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
  )

  app.post(
    "/register/:invitationId/verify",
    async (req: Request, res: Response) => {
      const invitation = await InvitationRepository.findOneBy({
        id: req.params.invitationId,
      })
      if (invitation == null || isExpired(invitation)) {
        return res
          .status(400)
          .send({message: "Registration invalid, not found or expired"})
      }
      const body: {
        credential: RegistrationCredentialJSON
        displayName: string
      } = req.body
      const { credential, displayName } = body
      let verification: VerifiedRegistrationResponse
      try {
        const opts: VerifyRegistrationResponseOpts = {
          credential,
          expectedChallenge: invitation.challenge.toString("base64url"),
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          requireUserVerification: true,
        }
        verification = await verifyRegistrationResponse(opts)
      } catch (error) {
        console.error(error)
        return res
          .status(400)
          .send({message: "Registration invalid, not found or expired"})
      }

      const { verified, registrationInfo } = verification
      if (!verified || !registrationInfo) {
        return res
          .status(400)
          .send("Registration invalid, not found or expired")
      }

      const { credentialPublicKey, credentialID, counter } = registrationInfo
      const cred = CredentialRepository.create({
        credentialID,
        user: invitation.user,
        displayName: `${displayName}`,
        credentialPublicKey,
        counter,
        transports: credential.transports,
      })
      try {
        await CredentialRepository.insert(cred)
      } catch (error) {
        console.error(error)
        return res.sendStatus(409)
      }
      await InvitationRepository.delete(invitation.id)
      return sendJwt(res, invitation.user)
    }
  )
}
