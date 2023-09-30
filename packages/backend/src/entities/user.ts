import { EntitySchema } from "typeorm";
import { Role } from "./role";

export interface User {
  id: string;
  name: string;
  displayName: string;
  role: Role;
  createdOn: Date;
  updatedOn: Date;
}

export const UserEntity = new EntitySchema<User>({
  name: "user",
  columns: {
    id: {
      primary: true,
      generated: "uuid",
      type: "uuid",
    },
    name: {
      unique: true,
      type: "varchar",
      length: 32,
    },
    displayName: {
      type: "varchar",
      length: 100,
    },
    role: {
      type: "simple-enum",
      enum: Role,
    },
    createdOn: {
      type: "datetime",

      createDate: true,
    },
    updatedOn: {
      type: "datetime",
      updateDate: true,
    },
  },
  indices: [
    {
      name: "idx_by_name",
      unique: true,
      columns: ["name"],
    },
  ],
});
