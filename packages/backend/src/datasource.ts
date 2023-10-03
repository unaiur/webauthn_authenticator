import { DataSource } from "typeorm";
import { CredentialEntity } from "./entities/credential";
import { InvitationEntity } from "./entities/invitation";
import { RoleEntity } from "./entities/role";
import { UserEntity } from "./entities/user";
import { PUBLIC_URL } from "./settings";
import { generateChallenge } from "@simplewebauthn/server/helpers";

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "data/auth.db",
  entities: [UserEntity, CredentialEntity, InvitationEntity, RoleEntity],
  synchronize: true,
  logging: false,
});
export const RoleRepository = AppDataSource.getRepository(RoleEntity);
export const UserRepository = AppDataSource.getRepository(UserEntity);
export const InvitationRepository =
  AppDataSource.getRepository(InvitationEntity);
export const CredentialRepository =
  AppDataSource.getRepository(CredentialEntity);

export function initializeDataSource() {
  return AppDataSource.initialize().then(async () => {
    if (0 == (await RoleRepository.count())) {
      await RoleRepository.save(RoleRepository.create([
        {
          value: "admin",
          display: "Administrator",
        },
        {
          value: "user",
          display: "User",
        },
        {
          value: "guest",
          display: "Guest",
        },
      ]))
    }
    if (0 == (await UserRepository.count())) {
      const user = UserRepository.create({
        name: "admin",
        displayName: "Administrator X",
        roles: [{ value: "admin" }],
      });
      const challenge = await generateChallenge();
      const invitation = await InvitationRepository.save({ user, challenge });
      console.log(
        `Created new admin user. Please, register it using: ${PUBLIC_URL}register/${invitation.id}`
      );
    }
  });
}
