import { EntitySchema } from "typeorm";
import { Action } from "./action.js";

export interface Rule {
  position: number,
  id: string,
  name: string,
  description?: string,
  hostRegex?: RegExp,
  pathRegex?: RegExp,
  roles?: string[],
  action: Action,
}

export const RuleEntity = new EntitySchema<Rule>({
  name: "rule",
  columns: {
      id: {
        primary: true,
        generated: "uuid",
        type: "uuid",
      },
      position: {
        unique: true,
        type: "int",
      },
      name: {
        type: "varchar",
        unique: true,
        length: 64,
      },
      description: {
        type: "text",
      },
      action: {
        type: "simple-enum",
        enum: Action,
      },
      roles: {
        type: "simple-json",
        nullable: true,
      },
      hostRegex: {
        type: "text",
        nullable: true,
        transformer: {
          from: (value: string | null) => value ? new RegExp(value, 'i') : undefined,
          to: (value: RegExp | undefined) => !value ? null : value.source,
        }
      },
      pathRegex: {
        type: "text",
        nullable: true,
        transformer: {
          from: (value: string | null) => value ? new RegExp(value) : undefined,
          to: (value: RegExp | undefined) => !value ? null : value.source,
        }
      },
  },
})
