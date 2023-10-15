import { randomBytes } from "crypto"

export interface Settings {
  urlSchema: string
  urlPort: number
  urlHost: string
  rpId: string
  rpName: string
  rpHmacAlgo: string
  rpHmacSecret: string
  jwtAlgo: string
  jwtCookie: string
  jwtExpiration: string
  jwtSecret: string
  dbPath: string
  dbSync: boolean
  secure: boolean
  origin: string
  verbose: boolean
  forwardedUriHttpHeader: string
  userNameHttpHeader: string
  userDisplayNameHttpHeader: string
  userRolesHttpHeader: string
}

function getOriginUrl(schema: string, host: string, port: number): string {
  const portStr = (schema === "http" && port == 80) || (schema === "https" && port == 443) ? "" : `:${port}`;
  return `${schema}://${host}${portStr}`
}

export function loadSettings(): Settings {
  const urlSchema = process.env.URL_SCHEMA ?? "http"
  const urlHost = process.env.URL_HOST ?? "localhost"
  const urlPort = parseInt(process.env.URL_PORT ?? "0") || 8080
  const rpId = process.env.RP_ID ?? urlHost
  return {
    urlSchema,
    urlHost,
    urlPort,
    rpId,
    rpName: process.env.RP_NAME ?? rpId,
    rpHmacAlgo: process.env.RP_HMAC_ALGO ?? "sha256",
    rpHmacSecret: process.env.RP_HMAC_SECRET ?? randomBytes(12).toString('base64url'),
    jwtAlgo: process.env['JWT_ALGO'] ?? "HS256",
    jwtCookie: process.env['JWT_COOKIE'] ?? "x-auth-jwt",
    jwtExpiration: process.env['JWT_EXPIRATION'] ?? "1d",
    jwtSecret: process.env['JWT_SECRET'] ?? randomBytes(12).toString('base64'),
    dbPath: process.env['DB_PATH'] ?? "data/auth.db",
    dbSync: process.env['DB_SYNC'] === 'true',
    secure: urlSchema === "https",
    origin: process.env['ORIGIN'] || getOriginUrl(urlSchema, urlHost, urlPort),
    verbose: process.env["VERBOSE"] === 'true',
    forwardedUriHttpHeader: process.env["FORWARDED_URI_HTTP_HEADER"] || 'X-Forwarded-Uri',
    userNameHttpHeader: process.env["USER_NAME_HTTP_HEADER"] ||  'X-Forwarded-For-Name',
    userDisplayNameHttpHeader: process.env["USER_DISPLAY_NAME_HTTP_HEADER"] || 'X-Forwarded-For-Display-Name',
    userRolesHttpHeader: process.env["USER_ROLES_HTTP_HEADER"] || 'X-Forwarded-For-Roles'
  };
}
