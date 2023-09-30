import { Response } from "express"
import { Algorithm, sign } from "jsonwebtoken"
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

export function sendJwt(res: Response, user: User | null): Response {
  if (user == null) {
    return res.status(500).send({ message: "user was deleted" })
  }
  const payload = {
    name: user.displayName,
    roles: {
      value: user.role,
    },
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
