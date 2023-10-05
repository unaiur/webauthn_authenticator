import { jest } from '@jest/globals'
import { mock } from 'ts-jest-mocker'
import request from "supertest"
import express, { Express } from 'express'
import { Repository } from "typeorm"
import { initializeRegistry } from '../register.js'
import { loadSettings } from '../../data/settings.js'
import { Credential } from '../../entities/credential.js'
import { Invitation } from '../../entities/invitation.js'
import { User } from '../../entities/user.js'
import { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/typescript-types'
import { generateChallenge } from '@simplewebauthn/server/helpers'
import * as SimpleWebAuthnServer from "@simplewebauthn/server"

jest.mock('typeorm')

describe('register', () => {
    const settings = loadSettings();

    const app: Express = express()
    const mockedCredentialRepo = mock<Repository<Credential>>();
    const mockedInvitationRepo = mock<Repository<Invitation>>();
    app.use(express.json())
    initializeRegistry(app, settings, mockedCredentialRepo, mockedInvitationRepo)
    const req = request(app)
    const user: User = {
        id: '33b1913e-4b74-4959-8e41-1b3d887d8517',
        name: 'owner',
        displayName: 'Owner',
        roles: [],
        createdOn: new Date(),
        updatedOn: new Date(),
    }
    const invitation: Invitation = {
        id: '6331d656-a3bb-4af4-a6b3-bf1f217c5b8',
        user,
        userId: 'f9ffa256-aeb1-4c3b-bb4d-14a46e94cdd0',
        createdOn: new Date(),
        durationSecs: 600,
        challenge: Buffer.from('CF311D53324B8CBB22829DB78D6E1506D564EF2FDC2F9DF764581E420B07ACA1', 'hex')
    }
    const oldCredentialID = Buffer.from("F0B214E5562619C0B2BBDFEB6CF3E224E5B2F26C", "hex")
    const oldCredential: Credential = {
        credentialID: oldCredentialID,
        userId: user.id,
        user,
        displayName: 'Chrome 118.0.0.0',
        credentialPublicKey: Buffer.from("A501020326200121582065F3169378A2A9848FC3572B2B04EB0691560248698EEC28ABC753C1B13FCA80225820D0F43234E5A1F9ACD61201B51C7A0981491B7E71A99AAE06116C101688A7FCE1", "hex"),
        counter: 0,
        lastUseOn: new Date(),
        transports: ['hybrid', 'internal']

    }
    beforeEach(() => {
        jest.resetAllMocks();
    })

    test('it must retrieve registration options if the invitation is correct', async () => {
        // Arrange
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(invitation))
        mockedCredentialRepo.findBy.mockReturnValue(Promise.resolve([oldCredential]))

        // Act
        const optionsResponse = await req.get(`/register/${invitation.id}/options`)

        // Assert
        expect(optionsResponse.statusCode).toBe(200)
        const registerOptions: PublicKeyCredentialCreationOptionsJSON = optionsResponse.body as PublicKeyCredentialCreationOptionsJSON
        expect(registerOptions.rp).toEqual({id: settings.rpId, name: settings.rpName})
        expect(registerOptions.user).toEqual({id: user.id, name: user.name, displayName: user.displayName})
        expect(registerOptions.challenge).toEqual(invitation.challenge.toString('base64url'))
        expect(registerOptions.timeout).toEqual(60000)
        expect(registerOptions.attestation).toEqual('none')
        expect(registerOptions.excludeCredentials).toEqual([{id: oldCredential.credentialID.toString('base64url'), type: 'public-key', transports: oldCredential.transports}])
        expect(registerOptions.authenticatorSelection?.residentKey).toEqual('required')
        expect(registerOptions.authenticatorSelection?.userVerification).toEqual('required')
        expect(registerOptions.pubKeyCredParams.map(p => p.alg).sort((a, b) => a - b)).toEqual([-257, -8, -7])

        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedCredentialRepo.findBy).toBeCalledWith({userId: invitation.userId})
    });

    test('it must fail to retrieve registration options if there is no invitation', async () => {
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(null))

        // Act
        const optionsResponse = await req.get(`/register/${invitation.id}/options`)

        // Assert
        expect(optionsResponse.statusCode).toBe(400)
        expect(optionsResponse.body).toEqual({message: "Registration invitation not found or expired"})
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedCredentialRepo.findBy).not.toBeCalled()
    })

    test('it must fail to retrieve registration options if the invitation is expired', async () => {
        const now = new Date().getTime()
        const expiredInvitation = { ...invitation, createdOn: new Date(now - 601000)}
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(expiredInvitation))

        // Act
        const optionsResponse = await req.get(`/register/${invitation.id}/options`)

        // Assert
        expect(optionsResponse.statusCode).toBe(400)
        expect(optionsResponse.body).toEqual({message: "Registration invitation not found or expired"})
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedCredentialRepo.findBy).not.toBeCalled()
    })

    test('it must fail to retrieve registration options if the invitation is in the future', async () => {
        const now = new Date().getTime()
        const expiredInvitation = { ...invitation, createdOn: new Date(now + 1000)}
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(expiredInvitation))

        // Act
        const optionsResponse = await req.get(`/register/${invitation.id}/options`)

        // Assert
        expect(optionsResponse.statusCode).toBe(400)
        expect(optionsResponse.body).toEqual({message: "Registration invitation not found or expired"})
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedCredentialRepo.findBy).not.toBeCalled()
    })


    const registrationResponse: RegistrationResponseJSON = {
        id: "IrkNUEk08cY_p64FP3Za7HGzlZ4",
        rawId: "IrkNUEk08cY_p64FP3Za7HGzlZ4",
        response: {
            attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViYSZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NdAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCK5DVBJNPHGP6euBT92Wuxxs5WepQECAyYgASFYIOE0Sc_kwzeUBKfJAKnqyI3ydD_Z54O-V0YX_AeG4QTzIlggHCrzXrcFkPviJxeExHUc65Wm_CT_HxXpQDwhPnQg99E",
            clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoienpFZFV6SkxqTHNpZ3AyM2pXNFZCdFZrN3lfY0w1MzNaRmdlUWdzSHJLRSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MCIsImNyb3NzT3JpZ2luIjpmYWxzZX0",
            transports: [
                "hybrid",
                "internal"
            ],
            publicKeyAlgorithm: -7,
            publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE4TRJz-TDN5QEp8kAqerIjfJ0P9nng75XRhf8B4bhBPMcKvNetwWQ--InF4TEdRzrlab8JP8fFelAPCE-dCD30Q",
            authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NdAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCK5DVBJNPHGP6euBT92Wuxxs5WepQECAyYgASFYIOE0Sc_kwzeUBKfJAKnqyI3ydD_Z54O-V0YX_AeG4QTzIlggHCrzXrcFkPviJxeExHUc65Wm_CT_HxXpQDwhPnQg99E"
        },
        type: "public-key",
        clientExtensionResults: {
            credProps: { rk: true }
        },
        authenticatorAttachment: "platform"
    };
    const registeredPublicKey = Buffer.from('A5010203262001215820E13449CFE4C3379404A7C900A9EAC88DF2743FD9E783BE574617FC0786E104F32258201C2AF35EB70590FBE2271784C4751CEB95A6FC24FF1F15E9403C213E7420F7D1', 'hex')
    const registerVerifyRequest = {
        response: registrationResponse,
        displayName: "Chrome 118.0.0.0"
    }

    test('it must verify correct registration', async () => {
        // Arrange
        const mockedCredential = mock<Credential>()
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(invitation))
        mockedInvitationRepo.delete.mockReturnValue(Promise.resolve({raw: null}))
        mockedCredentialRepo.insert.mockReturnValue(Promise.resolve({raw: null, identifiers: [], generatedMaps: []}))
        mockedCredentialRepo.create.mockReturnValue(mockedCredential)

        // Act
        const verifyResponse = await req
            .post(`/register/${invitation.id}/verify`)
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(registerVerifyRequest))

        // Assert
        expect(verifyResponse.statusCode).toBe(200)
        expect(verifyResponse.headers['set-cookie']).toHaveLength(1)
        expect(verifyResponse.headers['set-cookie'][0]).toMatch(new RegExp(`^${settings.jwtCookie}=.*; Max-Age=87400; Domain=${settings.rpId}; Path=/; Expires=.*; HttpOnly$`))

        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedInvitationRepo.delete).toBeCalledWith(invitation.id)
        expect(mockedCredentialRepo.insert).toBeCalled()
        expect(mockedCredentialRepo.insert.mock.calls[0][0]).toBe(mockedCredential)
        expect(mockedCredentialRepo.create).toBeCalled()
        expect(mockedCredentialRepo.create.mock.calls[0][0]).toEqual({
            credentialID: new Uint8Array(Buffer.from(registrationResponse.id, 'base64url')),
            user: invitation.user,
            displayName: registerVerifyRequest.displayName,
            credentialPublicKey: new Uint8Array(registeredPublicKey),
            counter: 0,
            transports: ['hybrid', 'internal']
        })
    });


    test('it must fail if the credential is unknown', async () => {
        // Arrange
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(null))

        // Act
        const verifyResponse = await req
            .post(`/register/${invitation.id}/verify`)
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(registerVerifyRequest))

        // Assert
        expect(verifyResponse.statusCode).toBe(400)
        expect(verifyResponse.body).toEqual({message: "Registration invitation not found or expired"})
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedInvitationRepo.delete).not.toBeCalled()
        expect(mockedCredentialRepo.insert).not.toBeCalled()
    })

    test('it must fail if the credential is expired', async () => {
        // Arrange
        const now = new Date().getTime()
        const expiredInvitation = { ...invitation, createdOn: new Date(now - 601000)}
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(expiredInvitation))

        // Act
        const verifyResponse = await req
            .post(`/register/${invitation.id}/verify`)
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(registerVerifyRequest))

        // Assert
        expect(verifyResponse.statusCode).toBe(400)
        expect(verifyResponse.body).toEqual({message: "Registration invitation not found or expired"})
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedInvitationRepo.delete).not.toBeCalled()
        expect(mockedCredentialRepo.insert).not.toBeCalled()
    })

    test('it must fail if the challenge has been tampered', async () => {
        // Arrange
        const invalidInvitation = { ...invitation, challenge: Buffer.from(await generateChallenge())}
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(invalidInvitation))

        // Act
        const verifyResponse = await req
            .post(`/register/${invitation.id}/verify`)
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(registerVerifyRequest))

        // Assert
        expect(verifyResponse.statusCode).toBe(400)
        expect(verifyResponse.body).toEqual({message: "Registration invitation not found or expired"})
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedInvitationRepo.delete).not.toBeCalled()
        expect(mockedCredentialRepo.insert).not.toBeCalled()
    })

    test('it must fail if the credentail cannot be created', async() => {
        // Arrange
        const mockedCredential = mock<Credential>()
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(invitation))
        mockedInvitationRepo.delete.mockReturnValue(Promise.resolve({raw: null}))
        mockedCredentialRepo.insert.mockImplementation(() => { throw new Error('test')})
        mockedCredentialRepo.create.mockReturnValue(mockedCredential)

        // Act
        const verifyResponse = await req
            .post(`/register/${invitation.id}/verify`)
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(registerVerifyRequest))

        // Assert
        expect(verifyResponse.statusCode).toBe(409)
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedCredentialRepo.insert).toBeCalled()
        expect(mockedCredentialRepo.create).toBeCalled()
    })

    test('it must fail if the attestation cannot be verified', async () => {
        // Arrange
        const mockedCredential = mock<Credential>()
        mockedInvitationRepo.findOneBy.mockReturnValue(Promise.resolve(invitation))
        mockedInvitationRepo.delete.mockReturnValue(Promise.resolve({raw: null}))
        mockedCredentialRepo.insert.mockReturnValue(Promise.resolve({raw: null, identifiers: [], generatedMaps: []}))
        mockedCredentialRepo.create.mockReturnValue(mockedCredential)
        // I do not know how to generate an unverificable attestation that returns false instead of throwing
        jest.spyOn(SimpleWebAuthnServer, 'verifyRegistrationResponse')
            .mockReturnValue(Promise.resolve({verified: false}))

        // Act
        const verifyResponse = await req
            .post(`/register/${invitation.id}/verify`)
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(registerVerifyRequest))

        // Assert
        expect(verifyResponse.statusCode).toBe(400)
        expect(verifyResponse.body).toEqual({message: "Registration invitation not found or expired"})
        expect(mockedInvitationRepo.findOneBy).toBeCalledWith({id: invitation.id})
        expect(mockedInvitationRepo.delete).not.toBeCalled()
        expect(mockedCredentialRepo.insert).not.toBeCalled()

    })


})