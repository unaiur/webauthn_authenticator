import { AuthenticatorTransportFuture } from "@simplewebauthn/typescript-types";
import { EntitySchema } from "typeorm";
import { User } from "./user";

export interface Credential {
  credentialID: Buffer;
  userId: string;
  user?: User;
  displayName: string;
  credentialPublicKey: Buffer;
  counter: number;
  lastUseOn: Date;
  transports?: AuthenticatorTransportFuture[];
}

export const CredentialEntity = new EntitySchema<Credential>({
  name: "credential",
  columns: {
    credentialID: {
      type: "blob",
      primary: true,
    },
    userId: {
      type: "uuid",
    },
    displayName: {
      type: "varchar",
      length: 100,
    },
    credentialPublicKey: {
      type: "blob",
    },
    counter: {
      type: "int8",
    },
    lastUseOn: {
      type: "datetime",
      updateDate: true,
    },
    transports: {
      type: "simple-array",
    },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "user",
      cascade: true,
    },
  },
  relationIds: {
    userId: {
      relationName: "user",
    },
  },
  indices: [
    {
      name: "idx_by_user",
      columns: ["userId"],
    },
  ],
});
