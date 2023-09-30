import { randomBytes } from "crypto"

export const URL_PORT = parseInt(process.env["URL_PORT"] || "") || 8080
export const URL_PATH = fixPath(process.env["URL_PATH"] || "")
export const {
  URL_SCHEMA = "http",
  URL_HOST = "localhost",
  RP_ID = URL_HOST,
  RP_NAME = URL_HOST,
  RP_HMAC_ALGO = "sha256",
  RP_HMAC_SECRET = randomBytes(12).toString('base64url'),
  JWT_COOKIE = "x-auth-jwt",
  JWT_SECRET = randomBytes(12).toString('base64'),
  JWT_ALGO = "HS256",
  JWT_EXPIRATION = "1d",
} = process.env

export function isSecure() {
  return URL_SCHEMA == "https"
}

function fixPath(input: string) {
  if (input) {
    const prefix = input.startsWith('/') ? "" : "/"
    const suffix = input.endsWith('/') ? "" : "/"
    return prefix + input + suffix
  }
  return "/"
}

export const ORIGIN = `${URL_SCHEMA}://${URL_HOST}:${URL_PORT}`
export const PUBLIC_URL = `${ORIGIN}${fixPath(URL_PATH)}`
