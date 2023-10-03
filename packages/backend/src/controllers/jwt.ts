import { Request, Response } from "express"
import { Algorithm, JwtPayload, sign, verify } from "jsonwebtoken"
import { Role } from "../entities/role"
import { User } from "../entities/user"
import {
  isSecure,
  JWT_ALGO,
  JWT_COOKIE,
  JWT_EXPIRATION,
  JWT_SECRET,
  ORIGIN,
  RP_ID,
} from "../settings"

export const UNAUTHENTICATED_USER: DecodedJwt = {
  name: "nobody",
  displayName: "No authenticated user",
  roles: []
}

export function sendJwt(res: Response, user: User | null): Response {
  if (user == null) {
    return res.status(500).send({ message: "user was deleted" })
  }
  const payload = {
    name: user.displayName,
    roles: user.roles,
  }
  const algorithm = <Algorithm>JWT_ALGO
  const jwt = sign(payload, JWT_SECRET, {
    algorithm,
    expiresIn: JWT_EXPIRATION,
    audience: ORIGIN,
    issuer: ORIGIN,
    subject: user.name,
  })
  const maxAge = 87400000
  const httpOnly = true
  const secure = isSecure()
  const domain = RP_ID
  res.cookie(JWT_COOKIE, jwt, { maxAge, httpOnly, secure, domain })
  return res.send({ jwt })
}

export type DecodedJwt = {
  name: string,
  displayName: string,
  roles: Role[]
}

export function decodeJwt(req: Request): DecodedJwt {
  try {
    const jwtCookie = getJwtCookie(req.headers["cookie"] || "")
    const jwt = verify(jwtCookie, JWT_SECRET, {
      algorithms: [<Algorithm>JWT_ALGO],
      audience: ORIGIN,
      issuer: ORIGIN,
      maxAge: JWT_EXPIRATION,
    }) as JwtPayload
    return {
      name: jwt.sub ?? "",
      displayName: jwt.name,
      roles: jwt.roles,
    }
  } catch(err) {
    console.log(err)
    return UNAUTHENTICATED_USER;
  }
}

function getJwtCookie(cookies: string): string {
  const jwtCookie = cookies.split(';')
    .map(c => c.trim())
    .filter(c => c.startsWith(JWT_COOKIE+'='))
    .map(c => c.substring(JWT_COOKIE.length + 1))
  return jwtCookie[0]
}
