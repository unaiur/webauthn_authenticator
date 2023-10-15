import { randomBytes } from "crypto"

export interface Settings {
  listeningPort: number
  listeningAddress: string | undefined
  publicAuthUrl: string
  secure: boolean
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
  verbose: boolean
  forwardedHostHttpHeader: string
  forwardedUriHttpHeader: string
  userNameHttpHeader: string
  userDisplayNameHttpHeader: string
  userRolesHttpHeader: string
  auditPath: string
}

export function loadSettings(): Settings {
  const listeningAddress = process.env.LISTENING_ADDRESS
  const listeningPort = parseInt(process.env.LISTENING_PORT ?? "0") || 8080
  const publicAuthUrl = process.env.PUBLIC_AUTH_URL || `http://localhost:${listeningPort}`
  const rpId = process.env.RP_ID ?? "localhost"
  return {
    listeningAddress,
    listeningPort,
    rpId,
    rpName: process.env.RP_NAME ?? rpId,
    rpHmacAlgo: process.env.RP_HMAC_ALGO ?? "sha256",
    rpHmacSecret: process.env.RP_HMAC_SECRET ?? randomBytes(12).toString('base64url'),
    jwtAlgo: process.env.JWT_ALGO ?? "HS256",
    jwtCookie: process.env.JWT_COOKIE ?? "x-auth-jwt",
    jwtExpiration: process.env.JWT_EXPIRATION ?? "1d",
    jwtSecret: process.env.JWT_SECRET ?? randomBytes(12).toString('base64'),
    dbPath: process.env.DB_PATH ?? "data/auth.db",
    dbSync: process.env.DB_SYNC === 'true',
    secure: publicAuthUrl.startsWith("https:"),
    publicAuthUrl: publicAuthUrl,
    verbose: process.env.VERBOSE === 'true',
    forwardedHostHttpHeader: process.env.FORWARDED_HOST_HTTP_HEADER || 'X-Forwarded-Host',
    forwardedUriHttpHeader: process.env.FORWARDED_URI_HTTP_HEADER || 'X-Forwarded-Uri',
    userNameHttpHeader: process.env.USER_NAME_HTTP_HEADER ||  'X-Forwarded-User-Name',
    userDisplayNameHttpHeader: process.env.USER_DISPLAY_NAME_HTTP_HEADER || 'X-Forwarded-User-Display-Name',
    userRolesHttpHeader: process.env.USER_ROLES_HTTP_HEADER || 'X-Forwarded-User-Roles',
    auditPath: process.env.AUDIT_PATH || 'log/audit.log'
  };
}
