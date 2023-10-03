import { EntitySchema } from "typeorm"

// Role (a subset of RFC 7643 role definition)
export interface Role {
  value: string,    // identifier of the role used on the wire
  display: string,  // display name to use in the UI
}

export const RoleEntity = new EntitySchema<Role>({
  name: "role",
  columns: {
      value: {
          primary: true,
          type: "varchar",
          length: 32,
      },
      display: {
        type: "text"
      }
  },
})
