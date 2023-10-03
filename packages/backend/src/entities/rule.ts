import { EntitySchema } from "typeorm";
import { Action } from "./action";

export interface Rule {
  position: number,
  description?: string,
  hostRegex?: RegExp,
  pathRegex?: RegExp,
  roles: string[],
  action: Action,
}

export const RuleEntity = new EntitySchema<Rule>({
  name: "rule",
  columns: {
      position: {
        primary: true,
        type: "int",
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
          to: (value: string | null) => !!value ? new RegExp(value) : undefined,
          from: (value: RegExp | undefined) => !!value ? value.source : null,
        }
      },
      pathRegex: {
        type: "text",
        nullable: true,
        transformer: {
          to: (value: string | null) => !!value ? new RegExp(value) : undefined,
          from: (value: RegExp | undefined) => !!value ? value.source : null,
        }
      },
  },
})
