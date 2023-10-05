import { jest } from '@jest/globals'
import { mock } from 'ts-jest-mocker'
import request from "supertest"
import express, { Express } from 'express'
import { Repository } from "typeorm"
import { initializeAuthProxy } from '../authz.js'
import { createJwt } from '../jwt.js'
import { loadSettings } from '../../data/settings.js'
import { User } from '../../entities/user.js'
import { Role } from '../../entities/role.js'
import { Rule } from '../../entities/rule.js'
import { Action } from '../../entities/action.js'

jest.mock('typeorm')

describe('authorize', () => {
    const settings = loadSettings()
    const origSettings = {...settings}
    const rules: Rule[] = [
        {
            position: 0,
            pathRegex: /^\/admin\//,
            roles: ['admin'],
            action: Action.ALLOW
        },
        {
            position: 10,
            pathRegex: /^\/admin\//,
            action: Action.DENY
        },
        {
            position: 11,
            hostRegex: /^127.0.0.1:[0-9]*$/,
            pathRegex: /^\/authz$/,
            action: Action.ALLOW
        },
        {
            position: 20,
            hostRegex: /^public\./,
            action: Action.ALLOW
        },
        {
            position: 30,
            hostRegex: /^myservice\./,
            pathRegex: /^\/user\//,
            roles: ['user'],
            action: Action.ALLOW
        },
        {
            position: 40,
            roles: ['admin'],
            action: Action.ALLOW
        },
    ]

    const app: Express = express()
    app.use(express.json())

    const mockedRuleRepo = mock<Repository<Rule>>();
    mockedRuleRepo.find.mockResolvedValue(Promise.resolve(rules))
    initializeAuthProxy(app, settings, mockedRuleRepo)

    const adminRole: Role = {
        value: 'admin',
        display: 'Administrator'
    }
    const userRole: Role = {
        value: 'user',
        display: 'User'
    }
    const ownerUser: User = {
        id: '33b1913e-4b74-4959-8e41-1b3d887d8517',
        name: 'owner',
        displayName: 'Owner',
        roles: [adminRole],
        createdOn: new Date(),
        updatedOn: new Date(),
    }
    const regularUser: User = {
        id: '33b1913e-4b74-4959-8e41-1b3d887d8517',
        name: 'pfox',
        displayName: 'Peter Fox',
        roles: [userRole],
        createdOn: new Date(),
        updatedOn: new Date(),
    }
    beforeEach(() => {
        jest.resetAllMocks();
        settings.userNameHttpHeader = origSettings.userNameHttpHeader
        settings.userDisplayNameHttpHeader = origSettings.userDisplayNameHttpHeader
        settings.userRolesHttpHeader = origSettings.userRolesHttpHeader
    })

    test('it must authorize an admin request with a JWT with admin role', async () => {
        // arrange
        const req = request(app)
        const jwt = createJwt(ownerUser, settings)

        // act
        const response = await req
            .get('/authz')
            .set('Cookie', [`${settings.jwtCookie}=${jwt}`])
            .set(settings.forwardedUriHttpHeader, 'http://admin.example.org/admin/users')
            .send()

        // assert
        expect(response.statusCode).toBe(204)
        expect(response.get(settings.userNameHttpHeader)).toEqual(ownerUser.name)
        expect(response.get(settings.userDisplayNameHttpHeader)).toEqual(ownerUser.displayName)
        expect(response.get(settings.userRolesHttpHeader)).toEqual(ownerUser.roles.map(r => r.value).join(', '))
    })

    test('it must not send user http headers when empty', async () => {
        // arrange
        const req = request(app)
        const jwt = createJwt(ownerUser, settings)
        settings.userNameHttpHeader = ''
        settings.userDisplayNameHttpHeader = ''
        settings.userRolesHttpHeader = ''

        // act
        const response = await req
            .get('/authz')
            .set('Cookie', [`${settings.jwtCookie}=${jwt}`])
            .set(settings.forwardedUriHttpHeader, 'http://admin.example.org/admin/users')
            .send()

        // assert
        expect(response.statusCode).toBe(204)
        expect(response.get(settings.userNameHttpHeader)).toBeUndefined()
        expect(response.get(settings.userDisplayNameHttpHeader)).toBeUndefined()
        expect(response.get(settings.userRolesHttpHeader)).toBeUndefined()
    })

    test('anonymous access to non-public areas must redirected to authentication page', async () => {
        // arrange
        const req = request(app)

        // act
        const response = await req
            .get('/authz')
            .set(settings.forwardedUriHttpHeader, 'http://example.org/items')
            .send()

        // assert
        expect(response.statusCode).toBe(302)
        expect(response.get('location')).toEqual('/auth/index.html')
        expect(response.get(settings.userNameHttpHeader)).toBeUndefined()
        expect(response.get(settings.userDisplayNameHttpHeader)).toBeUndefined()
        expect(response.get(settings.userRolesHttpHeader)).toBeUndefined()
    })

    test('anonymous access to public hosts must succeed', async () => {
        // arrange
        const req = request(app)

        // act
        const response = await req
            .get('/authz')
            .set(settings.forwardedUriHttpHeader, 'http://public.example.org/items')
            .send()

        // assert
        expect(response.statusCode).toBe(204)
        expect(response.get(settings.userNameHttpHeader)).toBe('nobody')
        expect(response.get(settings.userDisplayNameHttpHeader)).toBe('No authenticated user')
        expect(response.get(settings.userRolesHttpHeader)).toBe('')
    })

    test('authenticated access to restricted areas must fail', async () => {
        // arrange
        const req = request(app)
        const jwt = createJwt(regularUser, settings)

        // act
        const response = await req
            .get('/authz')
            .set('Cookie', [`${settings.jwtCookie}=${jwt}`])
            .set(settings.forwardedUriHttpHeader, 'http://example.org/admin/users')
            .send()

        // assert
        expect(response.statusCode).toBe(403)
        expect(response.get(settings.userNameHttpHeader)).toBeUndefined()
        expect(response.get(settings.userDisplayNameHttpHeader)).toBeUndefined()
        expect(response.get(settings.userRolesHttpHeader)).toBeUndefined()
    })

    test('it should use request host and path if the forwarded URI header is not present in the http request', async () => {
        // arrange
        const req = request(app)

        // act
        const response = await req
            .get('/authz')
            .send()

        // assert
        expect(response.statusCode).toBe(204)
        expect(response.get(settings.userNameHttpHeader)).toBe('nobody')
        expect(response.get(settings.userDisplayNameHttpHeader)).toBe('No authenticated user')
        expect(response.get(settings.userRolesHttpHeader)).toBe('')
    })

    test('it should also match rules with both host and path regex', async () => {
        // arrange
        const req = request(app)
        const jwt = createJwt(regularUser, settings)

        // act
        const response = await req
            .get('/authz')
            .set('Cookie', [`${settings.jwtCookie}=${jwt}`])
            .set(settings.forwardedUriHttpHeader, 'http://myservice.example.org/user/')
            .send()

        // assert
        expect(response.statusCode).toBe(204)
        expect(response.get(settings.userNameHttpHeader)).toBe(regularUser.name)
        expect(response.get(settings.userDisplayNameHttpHeader)).toBe(regularUser.displayName)
        expect(response.get(settings.userRolesHttpHeader)).toBe('user')
    })
})
