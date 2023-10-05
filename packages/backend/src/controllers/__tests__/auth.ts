import { jest } from '@jest/globals'
import { mock } from 'ts-jest-mocker'
import request from "supertest"
import { createHmac } from "crypto"
import express, { Express } from 'express'
import { Repository } from "typeorm"
import { initializeAuth } from '../auth.js'
import { loadSettings } from '../../data/settings.js'
import { Credential } from '../../entities/credential.js'
import { User } from '../../entities/user.js'
import { Role } from '../../entities/role.js'

jest.mock('typeorm')

describe('authenticate', () => {
    const settings = loadSettings();

    const app: Express = express()
    const mockedCredentialRepo = mock<Repository<Credential>>();
    const mockedUserRepo = mock<Repository<User>>();
    app.use(express.json())
    initializeAuth(app, settings, mockedCredentialRepo, mockedUserRepo)
    const req = request(app)
    const adminRole: Role = {
        value: 'admin',
        display: 'Administrator'
    }
    const ownerUser: User = {
        id: '33b1913e-4b74-4959-8e41-1b3d887d8517',
        name: 'owner',
        displayName: 'Owner',
        roles: [adminRole],
        createdOn: new Date(),
        updatedOn: new Date(),
    }
    const credentialID = Buffer.from("F0B214E5562619C0B2BBDFEB6CF3E224E5B2F26C", "hex")
    const ownerCredential: Credential = {
        credentialID,
        userId: ownerUser.id,
        user: ownerUser,
        displayName: 'Chrome 118.0.0.0',
        credentialPublicKey: Buffer.from("A501020326200121582065F3169378A2A9848FC3572B2B04EB0691560248698EEC28ABC753C1B13FCA80225820D0F43234E5A1F9ACD61201B51C7A0981491B7E71A99AAE06116C101688A7FCE1", "hex"),
        counter: 0,
        lastUseOn: new Date(),
        transports: ['hybrid', 'internal']
    }

    const challenge = "CCy1NUODetI--6Z48DrVRspHre5A_bx_PpiUMlX3wFc"
    const challengeValidatorTimestamp = Math.floor(Date.now() / 1000)
    const authVerifyResponse = {
        id: "8LIU5VYmGcCyu9_rbPPiJOWy8mw",
        rawId: "8LIU5VYmGcCyu9_rbPPiJOWy8mw",
        response: {
            authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA",
            clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiQ0N5MU5VT0RldEktLTZaNDhEclZSc3BIcmU1QV9ieF9QcGlVTWxYM3dGYyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MCIsImNyb3NzT3JpZ2luIjpmYWxzZSwib3RoZXJfa2V5c19jYW5fYmVfYWRkZWRfaGVyZSI6ImRvIG5vdCBjb21wYXJlIGNsaWVudERhdGFKU09OIGFnYWluc3QgYSB0ZW1wbGF0ZS4gU2VlIGh0dHBzOi8vZ29vLmdsL3lhYlBleCJ9",
            signature: "MEYCIQDS2q9jsf4qDEHzwhFL79W2eGYzRSo4S8wld8PQAaxsWQIhAIs6JHuiDdntSIbWH3q7FGFrDkMII0zuDuCW2dEJh9MP",
            userHandle: "33b1913e-4b74-4959-8e41-1b3d887d8517"
        },
        type: "public-key",
        clientExtensionResults: {},
        authenticatorAttachment: "platform"
    }
    const challengeValidator = {
        timestamp: challengeValidatorTimestamp,
        hmac: createHmac(settings.rpHmacAlgo, settings.rpHmacSecret)
                .update(`${challengeValidatorTimestamp}`)
                .update(challenge)
                .digest("base64url")
    }

    beforeEach(() => {
        jest.resetAllMocks();
    })

    test('it must retrieve validation options', async () => {
        // Arrange
        const now = Math.floor((new Date()).getTime() / 1000);

        // Act
        const optionsResponse = await req.get('/auth/options')

        // Assert
        expect(optionsResponse.statusCode).toBe(200)
        const authOptions = optionsResponse.body
        expect(authOptions.rpId).toBe(settings.rpId)
        expect(authOptions.userVerification).toBe('required')
        expect(authOptions.challenge).toBeTruthy()
        expect(authOptions.challengeValidator.timestamp).toBeGreaterThanOrEqual(now)
        expect(authOptions.challengeValidator.hmac).toBeTruthy()
    });

    test('it must verify correct authentication', async () => {
        // Arrange
        mockedCredentialRepo.findOneBy.mockReturnValue(Promise.resolve(ownerCredential))
        mockedUserRepo.findOne.mockReturnValue(Promise.resolve(ownerUser))

        // Act
        const verifyResponse = await req
            .post('/auth/verify')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ response: authVerifyResponse, challengeValidator }))

        // Assert
        expect(verifyResponse.statusCode).toBe(200)
        expect(verifyResponse.headers['set-cookie']).toHaveLength(1)
        expect(verifyResponse.headers['set-cookie'][0]).toMatch(new RegExp(`^${settings.jwtCookie}=.*; Max-Age=87400; Domain=${settings.rpId}; Path=/; Expires=.*; HttpOnly$`))

        expect(mockedCredentialRepo.findOneBy).toBeCalledWith({credentialID})
        expect(mockedCredentialRepo.update).toBeCalledWith({ credentialID }, { counter: 0 })
        expect(mockedUserRepo.findOne).toBeCalledWith({where: { id: ownerUser.id }, relations: { roles: true }})
    })

    test('it must fail if the credential is unknown', async () => {
        // Arrange
        mockedCredentialRepo.findOneBy.mockReturnValue(Promise.resolve(null))

        // Act
        const verifyResponse = await req
            .post('/auth/verify')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ response: authVerifyResponse, challengeValidator }))

        // Assert
        expect(verifyResponse.statusCode).toBe(404)
        expect(verifyResponse.headers).not.toHaveProperty('set-cookie')
        expect(mockedCredentialRepo.findOneBy).toBeCalledWith({credentialID})
        expect(mockedUserRepo.findOne).not.toBeCalled
    })

    test('it must fail if the validator has been tampered', async () => {
        // Arrange
        mockedCredentialRepo.findOneBy.mockReturnValue(Promise.resolve(ownerCredential))
        mockedUserRepo.findOne.mockReturnValue(Promise.resolve(ownerUser))
        const corruptChallengeValidator = {
            ...challengeValidator,
            hmac: 'abcd'
        }

        // Act
        const verifyResponse = await req
            .post('/auth/verify')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ response: authVerifyResponse, challengeValidator: corruptChallengeValidator }))

        // Assert
        expect(verifyResponse.statusCode).toBe(400)
        expect(verifyResponse.body).toEqual({ message: "Credential not valid" })
        expect(verifyResponse.headers).not.toHaveProperty('set-cookie')
        expect(mockedCredentialRepo.findOneBy).toBeCalledWith({credentialID})
        expect(mockedUserRepo.findOne).not.toBeCalled
    })

    test('it must fail if the public key does not match', async () => {
        // Arrange
        const updatedOwnerCredential = {
            ...ownerCredential,
            credentialPublicKey: Buffer.from("A5010203262001215820E13449CFE4C3379404A7C900A9EAC88DF2743FD9E783BE574617FC0786E104F32258201C2AF35EB70590FBE2271784C4751CEB95A6FC24FF1F15E9403C213E7420F7D1", 'hex')
        }
        mockedCredentialRepo.findOneBy.mockReturnValue(Promise.resolve(updatedOwnerCredential))
        mockedUserRepo.findOne.mockReturnValue(Promise.resolve(ownerUser))

        // Act
        const verifyResponse = await req
            .post('/auth/verify')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ response: authVerifyResponse, challengeValidator }))

        // Assert
        expect(verifyResponse.statusCode).toBe(400)
        expect(verifyResponse.body).toEqual({ message: "Credential not valid" })
        expect(verifyResponse.headers).not.toHaveProperty('set-cookie')
        expect(mockedCredentialRepo.findOneBy).toBeCalledWith({credentialID})
        expect(mockedUserRepo.findOne).not.toBeCalled
    })

    test('it must fail if user does not exist', async () => {
        // Arrange
        mockedCredentialRepo.findOneBy.mockReturnValue(Promise.resolve(ownerCredential))
        mockedUserRepo.findOne.mockReturnValue(Promise.resolve(null))

        // Act
        const verifyResponse = await req
            .post('/auth/verify')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ response: authVerifyResponse, challengeValidator }))

        // Assert
        expect(verifyResponse.statusCode).toBe(404)
        expect(verifyResponse.body).toEqual({ message: "User not found" })
        expect(verifyResponse.headers).not.toHaveProperty('set-cookie')

        expect(mockedCredentialRepo.findOneBy).toBeCalledWith({credentialID})
        expect(mockedCredentialRepo.update).toBeCalledWith({ credentialID }, { counter: 0 })
        expect(mockedUserRepo.findOne).toBeCalledWith({where: { id: ownerUser.id }, relations: { roles: true }})
    })

    test('it must fail if we cannot update credentail', async () => {
        // Arrange
        mockedCredentialRepo.findOneBy.mockReturnValue(Promise.resolve(ownerCredential))
        mockedCredentialRepo.update.mockImplementation(() => { throw new Error("test") })
        mockedUserRepo.findOne.mockReturnValue(Promise.resolve(ownerUser))

        // Act
        const verifyResponse = await req
            .post('/auth/verify')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify({ response: authVerifyResponse, challengeValidator }))

        // Assert
        expect(verifyResponse.statusCode).toBe(409)

        expect(mockedCredentialRepo.findOneBy).toBeCalledWith({credentialID})
        expect(mockedCredentialRepo.update).toBeCalledWith({ credentialID }, { counter: 0 })
        expect(mockedUserRepo.findOne).toBeCalledWith({where: { id: ownerUser.id }, relations: { roles: true }})
    })
})
