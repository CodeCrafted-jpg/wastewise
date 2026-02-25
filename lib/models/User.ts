import mongoose, { Schema, Document, Model } from 'mongoose'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'citizen' | 'municipal_officer' | 'admin' | 'super_admin'

export interface IRoleHistory {
    role: UserRole
    assignedBy: string // clerkUserId of the actor
    assignedAt: Date
    reason: string
}

export interface IUser extends Document {
    clerkUserId: string
    name: string
    email: string
    phone: string
    role: UserRole
    roleHistory: IRoleHistory[]
    ecoPoints: number
    reportsSubmitted: number
    phoneVerified: boolean
    emailVerified: boolean
    createdAt: Date
    lastSeenAt: Date
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RoleHistorySchema = new Schema<IRoleHistory>(
    {
        role: {
            type: String,
            enum: ['citizen', 'municipal_officer', 'admin', 'super_admin'],
            required: true,
        },
        assignedBy: { type: String, required: true },
        assignedAt: { type: Date, default: Date.now },
        reason: { type: String, default: '' },
    },
    { _id: false }
)

const UserSchema = new Schema<IUser>(
    {
        clerkUserId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        name: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        role: {
            type: String,
            enum: ['citizen', 'municipal_officer', 'admin', 'super_admin'],
            default: 'citizen',
        },
        roleHistory: { type: [RoleHistorySchema], default: [] },
        ecoPoints: { type: Number, default: 0 },
        reportsSubmitted: { type: Number, default: 0 },
        phoneVerified: { type: Boolean, default: false },
        emailVerified: { type: Boolean, default: false },
        lastSeenAt: { type: Date, default: Date.now },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
)

// ---------------------------------------------------------------------------
// Model (prevent re-compilation on hot-reload)
// ---------------------------------------------------------------------------

const User: Model<IUser> =
    mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

export default User
