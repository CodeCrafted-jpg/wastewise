import { auth } from '@clerk/nextjs/server'
import dbConnect from './db'
import User, { IUser, UserRole } from './models/User'
import AuditLog from './models/AuditLog'

export interface AuthSession {
    clerkUserId: string
    role: UserRole
    user: IUser
}

/**
 * requireAuth()
 * 1. Checks Clerk session
 * 2. Connects to DB
 * 3. Fetches user by clerkUserId
 * 4. If missing, auto-provisions a 'citizen' user
 */
export async function requireAuth(): Promise<AuthSession> {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
        const error = new Error('Unauthorized')
            ; (error as any).status = 401
        throw error
    }

    await dbConnect()

    let user = await User.findOne({ clerkUserId })

    // Auto-provision user if they exist in Clerk but not yet in our DB
    if (!user) {
        user = await User.create({
            clerkUserId,
            role: 'citizen',
        })

        // Log the auto-provisioning
        await AuditLog.create({
            action: 'user_created',
            actorClerkUserId: clerkUserId,
            actorRole: 'citizen',
            target: { type: 'User', id: user._id.toString() },
            payload: { reason: 'Auto-provisioned on first login' },
            timestamp: new Date(),
        })
    }

    // Update lastSeenAt
    user.lastSeenAt = new Date()
    await user.save()

    return {
        clerkUserId,
        role: user.role,
        user,
    }
}

/**
 * requireRole()
 * Wraps requireAuth() and checks if user role is in the allowed list
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthSession> {
    const session = await requireAuth()

    if (!allowedRoles.includes(session.role)) {
        const error = new Error('Forbidden')
            ; (error as any).status = 403
        throw error
    }

    return session
}
