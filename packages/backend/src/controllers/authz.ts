import { Express, Request, RequestHandler, Response } from "express"
import { Repository } from "typeorm";
import { Action } from "../entities/action.js";
import { Rule } from "../entities/rule.js";
import { Settings } from "../data/settings.js";
import { DecodedJwt, decodeJwt, UNAUTHENTICATED_USER } from "./jwt.js";
import { AuditService } from "../data/audit.js"

const DEFAULT_RULE: Rule = {
  id: 'DEFAULT',
  name: 'DefaultRule',
  position: Number.MAX_VALUE,
  action: Action.DENY
}
let rules: Rule[] = []

export async function initializeAuthProxy(app: Express, settings: Settings, auditService: AuditService, ruleRepo: Repository<Rule>) {
  await reloadRules();

  async function reloadRules() {
    const newRules = await ruleRepo.find()
    console.log(`${newRules.length} authorization rules reloaded`)
    newRules.sort((a, b) => a.position - b.position)
    rules = newRules
  }

  app.get("/authz", (req: Request, res: Response) => {
    const jwt = evaluate({req, res, settings, url: parseForwardedUrl(req, settings), auditService});
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
    const jwt = evaluate({req, res, settings, auditService});
    if (jwt) {
      await reloadRules();
      res.sendStatus(204);
    }
  }) as RequestHandler);
}

export function evaluate({req, res, settings, url = parseHostedUrl(req, settings), auditService}:
    {req: Request, res: Response, settings: Settings, url?: URL, auditService: AuditService}): DecodedJwt | undefined {
  const jwt = decodeJwt(req, settings);
  const roles = new Set(jwt?.roles?.map(r => r.value) ?? []);
  for (const rule of rules) {
    if (matches(rule, url, roles)) {
      auditService.authorizated(url, jwt, rule)
      if (rule.action === Action.ALLOW) {
        return jwt;
      }
      break;
    }
  }
  auditService.authorizated(url, jwt, DEFAULT_RULE)
  if (jwt === UNAUTHENTICATED_USER) {
    res.redirect(settings.publicAuthUrl + `/auth/index.html?u=${encodeURIComponent(url.toString())}`)
  } else {
    // TODO: write a proper error message!
    res.sendStatus(403);
  }
  return undefined;
}

function parseHostedUrl(req: Request, settings: Settings): URL {
  return new URL(req.originalUrl, settings.publicAuthUrl)
}

function parseForwardedUrl(req: Request, settings: Settings): URL {
  const scheme = req.get(settings.forwardedSchemeHttpHeader) || 'http'
  const host = req.get(settings.forwardedHostHttpHeader) || 'unknown'
  const uri = req.get(settings.forwardedUriHttpHeader) || '/'
  return new URL(uri, `${scheme}://${host}`)
}

function matches(rule: Rule, url: URL, roles: Set<string>): boolean {
  const hostMatches = (!rule.hostRegex || rule.hostRegex.test(url.host));
  const pathMatches = (!rule.pathRegex || rule.pathRegex.test(url.pathname));
  const rolesMatches = (!rule.roles || !!rule.roles.find(r => roles.has(r)));
  return hostMatches && pathMatches && rolesMatches;
}
