import { loadSettings } from '../settings.js'

describe('Settings', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        //jest.resetModules();
        process.env = {...OLD_ENV}
    });

    afterAll(() => {
        process.env = OLD_ENV;
    })


    test('it must load defaults', () => {
        const settings = loadSettings()
        expect(settings.urlHost).toBe('localhost')
        expect(settings.urlPort).toBe(8080)
        expect(settings.rpId).toBe('localhost')
        expect(settings.rpName).toBe('localhost')
        expect(settings.rpHmacAlgo).toBe('sha256')
        expect(settings.rpHmacSecret).toHaveLength(16)
        expect(settings.jwtAlgo).toBe('HS256')
        expect(settings.jwtCookie).toBe('x-auth-jwt')
        expect(settings.jwtExpiration).toBe('1d')
        expect(settings.jwtSecret).toHaveLength(16)
        expect(settings.dbPath).toBe('data/auth.db')
        expect(settings.dbSync).toBe(false)
        expect(settings.secure).toBe(false)
        expect(settings.origin).toBe('http://localhost:8080')
        expect(settings.verbose).toBe(false)
    })

    test('it must load overrides', () => {
        process.env.ORIGIN = 'https://auth.test.org'
        process.env.URL_HOST = 'internal-host-name'
        process.env.URL_PORT = '80'
        process.env.RP_ID = 'test.org'
        process.env.RP_NAME = 'My Test Org'
        process.env.RP_HMAC_ALGO = 'sha512'
        process.env.RP_HMAC_SECRET = 'abcd0123456789'
        process.env.JWT_ALGO = 'HS512'
        process.env.JWT_COOKIE = 'x-test-jwt'
        process.env.JWT_EXPIRATION = '24h'
        process.env.JWT_SECRET = '0123456789abcdef'
        process.env.DB_PATH = 'data/test.db'
        process.env.DB_SYNC = 'true'
        process.env.VERBOSE = 'true'

        const settings = loadSettings()
        expect(settings.urlHost).toBe('internal-host-name')
        expect(settings.urlPort).toBe(80)
        expect(settings.rpId).toBe('test.org')
        expect(settings.rpName).toBe('My Test Org')
        expect(settings.rpHmacAlgo).toBe('sha512')
        expect(settings.rpHmacSecret).toBe('abcd0123456789')
        expect(settings.jwtAlgo).toBe('HS512')
        expect(settings.jwtCookie).toBe('x-test-jwt')
        expect(settings.jwtExpiration).toBe('24h')
        expect(settings.jwtSecret).toBe('0123456789abcdef')
        expect(settings.dbPath).toBe('data/test.db')
        expect(settings.dbSync).toBe(true)
        expect(settings.secure).toBe(true)
        expect(settings.origin).toBe('https://auth.test.org')
        expect(settings.verbose).toBe(true)
    })

    test('it must use RP_ID as default RP_NAME', () => {
        process.env.RP_ID = 'test.org'

        const settings = loadSettings()

        expect(settings.urlHost).toBe('localhost')
        expect(settings.rpId).toBe('test.org')
        expect(settings.rpName).toBe('test.org')
    })

    test('it must omit standard HTTP port in origin', () => {
        process.env.URL_PORT = '80'

        const settings = loadSettings()

        expect(settings.origin).toBe('http://localhost')
    })
})