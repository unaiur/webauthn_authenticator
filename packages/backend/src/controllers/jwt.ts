import { Request, Response } from "express"
import jsonwebtoken from "jsonwebtoken"
import { Role } from "../entities/role.js"
import { User } from "../entities/user.js"
import { Settings } from "../data/settings.js"

export const UNAUTHENTICATED_USER: DecodedJwt = {
  name: "nobody",
  displayName: "No authenticated user",
  roles: []
}

export function createJwt(user: User, settings: Settings): string {
  const payload = {
    name: user.displayName,
    roles: user.roles,
  }
  const algorithm = settings.jwtAlgo as jsonwebtoken.Algorithm
  return jsonwebtoken.sign(payload, settings.jwtSecret, {
    algorithm,
    expiresIn: settings.jwtExpiration,
    audience: settings.publicAuthUrl,
    issuer: settings.publicAuthUrl,
    subject: user.name,
  })
}

export function sendJwt(res: Response, user: User | null, settings: Settings): Response {
  if (user == null) {
    return res.status(500).send({ message: "user was deleted" })
  }
  const jwt = createJwt(user, settings)
  const maxAge = 87400000
  const httpOnly = true
  const secure = settings.secure
  const domain = settings.rpId
  res.cookie(settings.jwtCookie, jwt, { maxAge, httpOnly, secure, domain, sameSite: "strict" })
  return res.send({ jwt })
}

export type DecodedJwt = {
  name: string,
  displayName: string,
  roles: Role[]
}

export function decodeJwt(req: Request, settings: Settings): DecodedJwt {
  try {
    const jwtCookie = getJwtCookie(req.headers["cookie"] ?? "", settings.jwtCookie)
    if (!jwtCookie) return UNAUTHENTICATED_USER
    const jwt = jsonwebtoken.verify(jwtCookie, settings.jwtSecret, {
      algorithms: [settings.jwtAlgo as jsonwebtoken.Algorithm],
      audience: settings.publicAuthUrl,
      issuer: settings.publicAuthUrl,
      maxAge: settings.jwtExpiration,
    }) as jsonwebtoken.JwtPayload
    return {
      name: jwt.sub ?? "",
      displayName: jwt.name,
      roles: jwt.roles,
    }
  } catch(err) {
    console.info(err)
    return UNAUTHENTICATED_USER;
  }
}

function getJwtCookie(cookies: string, name: string): string {
  const jwtCookie = cookies.split(';')
    .map(c => c.trim())
    .filter(c => c.startsWith(name+'='))
    .map(c => c.substring(name.length + 1))
  return jwtCookie[0]
}
