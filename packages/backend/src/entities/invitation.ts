import { EntitySchema } from "typeorm"
import { User } from "./user.js"

export interface Invitation {
    id: string
    userId: string
    user: User
    createdOn: Date
    durationSecs: number
    challenge: Buffer
}

export function isExpired(invitation: Invitation): boolean {
    const now = new Date().getTime()
    const createdOn = invitation.createdOn.getTime()
    return createdOn - now > 0 || createdOn + invitation.durationSecs - now < 0
}

export const InvitationEntity = new EntitySchema<Invitation>({
    name: "invitation",
    columns: {
        id: {
            primary: true,
            generated: "uuid",
            type: "uuid",
        },
        userId: {
            type: "uuid",
        },
        createdOn: {
            type: "datetime",
            createDate: true,
        },
        durationSecs: {
            type: "int",
            default: 600,
        },
        challenge: {
            type: "blob"
        }
    },
    relations: {
        user: {
            type: "many-to-one",
            target: "user",
            cascade: true,
            eager: true,
        },
    },
    relationIds: {
        userId: {
            relationName: "user",
        }
    },
    indices: [
        {
            name: "user_index",
            columns: ["userId"],
        }
    ]
})
