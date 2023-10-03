import { Express, Request, RequestHandler, Response } from "express"
import { RuleRepository } from "../datasource";
import { Action } from "../entities/action";
import { Rule } from "../entities/rule";
import { URL_PATH } from "../settings";
import { DecodedJwt, decodeJwt, UNAUTHENTICATED_USER } from "./jwt";

const REQUEST_URI_HDR = 'X-Forwarded-Uri'
const RESPONSE_USER_NAME_HDR = "X-Forwarded-For-Name"
const RESPONSE_USER_DISPLAY_NAME_HDR = "X-Forwarded-For-Display-Name"
const RESPONSE_USER_ROLES_HDR = "X-Forwarded-For-Roles"

let rules: Rule[] = []

export async function initializeAuthProxy(app: Express) {
  rules = await reloadRules();

  app.get("/authorize", (req: Request, res: Response) => {
    const jwt = evaluate(req, res);
    if (jwt) {
      res.set(RESPONSE_USER_NAME_HDR, jwt.name)
      res.set(RESPONSE_USER_DISPLAY_NAME_HDR, jwt.displayName)
      res.set(RESPONSE_USER_ROLES_HDR, jwt.roles.join(", "))
      res.sendStatus(204);
    }
  })

  app.get("/authorize/reload", (async (req: Request, res: Response) => {
    const jwt = evaluate(req, res);
    if (jwt) {
      rules = await reloadRules();
      res.sendStatus(204);
    }
  }) as RequestHandler);
}

export function evaluate(req: Request, res: Response): DecodedJwt | undefined {
  const jwt = decodeJwt(req);
  const roles = new Set(jwt?.roles?.map(r => r.value) ?? []);
  const {host, path} = parseUrl(req)
  console.log({jwt, host, path})
  for (const rule of rules) {
    if (matches(rule, host, path, roles)) {
      if (rule.action === Action.ALLOW) {
        // TODO: proper audit
        console.log(`Rule#${rule.position} ALLOWS ${jwt.name}`)
        return jwt;
      }
      console.log(`Rule#${rule.position} DENIES ${jwt.name}`)
      break;
    }
  }
  if (jwt === UNAUTHENTICATED_USER) {
    res.redirect(URL_PATH + "auth/index.html")
  } else {
    // TODO: write a proper error message!
    res.sendStatus(403);
  }
  return undefined;
}

function parseUrl(req: Request): {host: string, path: string} {
  const header = req.headers[REQUEST_URI_HDR] as string
  if (header) {
    const url = new URL(header)
    return {host: url.hostname, path: url.pathname}
  }
  return {host: req.get('host') as string, path: req.originalUrl}
}

function matches(rule: Rule, host: string, path: string, roles: Set<string>): boolean {
  const hostMatches = (!rule.hostRegex || rule.hostRegex.test(host));
  const pathMatches = (!rule.pathRegex || rule.pathRegex.test(path));
  const rolesMatches = (!rule.roles || !!rule.roles.find(r => roles.has(r)));
  return hostMatches && pathMatches && rolesMatches;
}

async function reloadRules(): Promise<Rule[]> {
  const rules = await RuleRepository.find()
  console.log(`${rules.length} authorization rules reloaded`)
  return rules.sort((a, b) => a.position - b.position)
}
