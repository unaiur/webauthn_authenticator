import { DataSource, Repository } from "typeorm";
import { Credential, CredentialEntity } from "../entities/credential.js";
import { Invitation, InvitationEntity } from "../entities/invitation.js";
import { Role, RoleEntity } from "../entities/role.js";
import { User, UserEntity } from "../entities/user.js";
import { Settings } from "./settings.js";
import { generateChallenge } from "@simplewebauthn/server/helpers";
import { Rule, RuleEntity } from "../entities/rule.js";
import { Action } from "../entities/action.js";

export interface Repositories {
  dataSource: DataSource
  credentials: Repository<Credential>
  invitations: Repository<Invitation>
  roles: Repository<Role>
  rules: Repository<Rule>
  users: Repository<User>
}

export async function loadRepositories(settings: Settings): Promise<Repositories> {
  const appDataSource = new DataSource({
    type: "better-sqlite3",
    entities: [UserEntity, CredentialEntity, InvitationEntity, RoleEntity, RuleEntity],
    database: settings.dbPath,
    synchronize: settings.dbSync,
    logging: settings.verbose,
  });
  const dataSource = await appDataSource.initialize();
  const credentials = dataSource.getRepository(CredentialEntity);
  const invitations = dataSource.getRepository(InvitationEntity);
  const roles = dataSource.getRepository(RoleEntity);
  const rules = dataSource.getRepository(RuleEntity);
  const users = dataSource.getRepository(UserEntity);
  if (0 == await users.count()) {
    // Create required admin role
    await roles.save(roles.create([
      {
        value: "admin",
        display: "Administrator",
      },
    ]))

    // Create the owner user and the associated invitation
    const user = users.create({
      name: "owner",
      displayName: "Owner",
      roles: [{ value: "admin" }],
    });
    const challenge = await generateChallenge();
    const invitation = await invitations.save({ user, challenge });
    console.log(
      `Created new admin user. Please, register it using: ${settings.publicAuthUrl}/register/${invitation.id}`
    );

    // Create a rule that allows everything to admins
    await rules.save(rules.create({
      position: 1,
      name: "EverythingAllowedForAdmins",
      description: "Administrators can access all pages",
      action: Action.ALLOW,
      roles: ["admin"]
    }))
  }
  return {dataSource, credentials, invitations, roles, rules, users};
}
