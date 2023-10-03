import { DataSource } from "typeorm";
import { CredentialEntity } from "./entities/credential";
import { InvitationEntity } from "./entities/invitation";
import { RoleEntity } from "./entities/role";
import { UserEntity } from "./entities/user";
import { PUBLIC_URL } from "./settings";
import { generateChallenge } from "@simplewebauthn/server/helpers";
import { RuleEntity } from "./entities/rule";
import { Action } from "./entities/action";

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "data/auth.db",
  entities: [UserEntity, CredentialEntity, InvitationEntity, RoleEntity, RuleEntity],
  synchronize: true,
  logging: false,
});
export const RoleRepository = AppDataSource.getRepository(RoleEntity);
export const UserRepository = AppDataSource.getRepository(UserEntity);
export const InvitationRepository =
  AppDataSource.getRepository(InvitationEntity);
export const CredentialRepository =
  AppDataSource.getRepository(CredentialEntity);
export const RuleRepository = AppDataSource.getRepository(RuleEntity);

export function initializeDataSource() {
  return AppDataSource.initialize().then(async () => {
    if (0 == await RoleRepository.count()) {
      // Create required admin role
      await RoleRepository.save(RoleRepository.create([
        {
          value: "admin",
          display: "Administrator",
        },
      ]))

      // Create the owner user and the associated invitation
      const user = UserRepository.create({
        name: "owner",
        displayName: "Owner",
        roles: [{ value: "admin" }],
      });
      const challenge = await generateChallenge();
      const invitation = await InvitationRepository.save({ user, challenge });
      console.log(
        `Created new admin user. Please, register it using: ${PUBLIC_URL}register/${invitation.id}`
      );

      // Create a rule that allows everything to admins
      await RuleRepository.save(RuleRepository.create({
        position: 1,
        description: "Administrators can access all pages",
        action: Action.ALLOW,
        roles: ["admin"]
      }))
    }
  });
}
