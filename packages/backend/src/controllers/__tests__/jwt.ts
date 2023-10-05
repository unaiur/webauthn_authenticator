import { decodeJwt, sendJwt } from '../jwt.js'
import { loadSettings } from '../../data/settings.js'
import { jest } from '@jest/globals'
import { Request, Response } from 'express'
import { User } from '../../entities/user.js'
import { mock } from 'ts-jest-mocker'


jest.mock('express')


describe('JWT', () => {
    const settings = loadSettings();

    test('it must send a valid JWT and parse it back', () => {
        const mockedResponse = mock<Response>();
        const user: User = {
            id: 'abc',
            name: 'user1',
            displayName: 'User1',
            roles: [{value: 'admin', display: 'Administrator'}],
            createdOn: new Date(),
            updatedOn: new Date()
        };

        sendJwt(mockedResponse, user, settings)

        expect(mockedResponse.cookie).toHaveBeenCalledTimes(1)
        expect(mockedResponse.send).toHaveBeenCalledTimes(1)
        const cookieCall = mockedResponse.cookie.mock.calls[0] as object[]
        expect(cookieCall[0]).toEqual(settings.jwtCookie)
        expect(cookieCall[2]).toEqual({maxAge: 87400000, httpOnly: true, secure: false, domain: 'localhost'})
        const jwt = mockedResponse.cookie.mock.calls[0][1];
        expect(mockedResponse.send.mock.calls[0][0]).toEqual({jwt})

        const mockedRequest = mock<Request>();
        mockedRequest.headers.cookie = `blabla; ${settings.jwtCookie}=${jwt} ; blabla`
        const decodedJwt = decodeJwt(mockedRequest, settings);

        expect(decodedJwt.name).toBe('user1')
        expect(decodedJwt.displayName).toBe('User1')
        expect(decodedJwt.roles).toEqual([{value: 'admin', display: 'Administrator'}])
    })

    test('it must send error when user has been deleted', () => {
        const mockedResponse = mock<Response>();
        mockedResponse.status.mockReturnThis();

        sendJwt(mockedResponse, null, settings)

        expect(mockedResponse.status).toHaveBeenCalledTimes(1)
        expect(mockedResponse.status.mock.calls[0][0]).toBe(500)
        expect(mockedResponse.send).toHaveBeenCalledTimes(1)
        expect(mockedResponse.send.mock.calls[0][0]).toEqual({ message: "user was deleted" })
    })

    test('it must return unauthenticated users when cookie is missing', () => {
        const mockedRequest = mock<Request>();
        mockedRequest.headers.cookie = `blabla; x-auth-jwt0=1234 ; blabla`
        const decodedJwt = decodeJwt(mockedRequest, settings);

        expect(decodedJwt.name).toBe('nobody')
        expect(decodedJwt.displayName).toBe('No authenticated user')
        expect(decodedJwt.roles).toEqual([])
    })
})
