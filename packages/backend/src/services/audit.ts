import { DecodedJwt } from "../controllers/jwt"
import { Credential } from "../entities/credential"
import { Invitation } from "../entities/invitation"
import { Rule } from "../entities/rule"
import { User } from "../entities/user"
import * as winston from "winston"
import { Action } from "../entities/action"

export interface AuditService {
   authorizated(host: string, path: string, decodedJwt: DecodedJwt, rule: Rule): void
   authenticated(user: User, credential: Credential): void
   registered(invitation: Invitation, credential: Credential): void
}

const myCustomLevels = {
    levels: {
      deny: 0,
      allow: 1,
      authenticated: 2,
      registered: 3,
    },
    colors: {
      allow: 'green',
      deny: 'red'
    }
};
winston.addColors(myCustomLevels.colors);

const myFormat = winston.format.printf(({ level, message, label, timestamp }) => {
    return `${timestamp} ${level} ${message}`;
});


const auditLogger = winston.createLogger({
    levels: myCustomLevels.levels,
    level: 'registered',
    format: winston.format.combine(winston.format.timestamp(), myFormat),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'log/audit.log' })
    ]
});


const auditService: AuditService = {
   authorizated(host: string, path: string, decodedJwt: DecodedJwt, rule: Rule): void {
    const level = rule.action === Action.ALLOW ? 'allow' : 'deny'
    auditLogger.log(level, `user ${decodedJwt.name} to ${host}${path} by rule ${rule.name} [${rule.id}]`)
    console.info('authorized')
   },
   authenticated(user: User, credential: Credential): void {
    auditLogger.log('authenticated', `user ${user.name} by credential ${credential.displayName} [${credential.credentialID.toString('base64url')}]`)
    console.info('authenticated')
   },
   registered(invitation: Invitation, credential: Credential): void {
    auditLogger.log('registered', `user ${invitation.user.name} created credential ${credential.displayName} [${credential.credentialID}] using invitation ${invitation.id}`)
    console.info('registered')
   }
}

export function getAuditService() {
    return auditService
}