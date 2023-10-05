import { Express, Request, RequestHandler, Response } from "express"
import { Repository } from "typeorm";
import { Action } from "../entities/action.js";
import { Rule } from "../entities/rule.js";
import { Settings } from "../data/settings.js";
import { DecodedJwt, decodeJwt, UNAUTHENTICATED_USER } from "./jwt.js";

let rules: Rule[] = []

export async function initializeAuthProxy(app: Express, settings: Settings, ruleRepo: Repository<Rule>) {
  await reloadRules();

  async function reloadRules() {
    const newRules = await ruleRepo.find()
    console.log(`${newRules.length} authorization rules reloaded`)
    newRules.sort((a, b) => a.position - b.position)
    rules = newRules
  }

  app.get("/authz", (req: Request, res: Response) => {
    const jwt = evaluate(req, res, settings);
    if (jwt) {
      if (!!settings.userNameHttpHeader) {
        res.set(settings.userNameHttpHeader, jwt.name)
      }
      if (!!settings.userDisplayNameHttpHeader) {
        res.set(settings.userDisplayNameHttpHeader, jwt.displayName)
      }
      if (!!settings.userRolesHttpHeader) {
        res.set(settings.userRolesHttpHeader, jwt.roles.map(r => r.value).join(", "))
      }
      res.sendStatus(204);
    }
  })

  app.get("/authz/reload", (async (req: Request, res: Response) => {
    const jwt = evaluate(req, res, settings);
    if (jwt) {
      await reloadRules();
      res.sendStatus(204);
    }
  }) as RequestHandler);
}

export function evaluate(req: Request, res: Response, settings: Settings): DecodedJwt | undefined {
  const jwt = decodeJwt(req, settings);
  const roles = new Set(jwt?.roles?.map(r => r.value) ?? []);
  const {host, path} = parseUrl(req, settings)
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
  console.log(`Rule#DEFAULT DENIES ${jwt.name}`)
  if (jwt === UNAUTHENTICATED_USER) {
    res.redirect("/auth/index.html")
  } else {
    // TODO: write a proper error message!
    res.sendStatus(403);
  }
  return undefined;
}

function parseUrl(req: Request, settings: Settings): {host: string, path: string} {
  const header = req.get(settings.forwardedUriHttpHeader)
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
