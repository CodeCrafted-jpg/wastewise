import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import User from '@/lib/models/User'
import AuditLog from '@/lib/models/AuditLog'

/**
 * POST /api/admin/assign-role
 * Body: { targetClerkUserId: string, newRole: UserRole, reason: string }
 */
export async function POST(req: Request) {
    try {
        // 1. Authenticate and check for admin/super_admin role
        const { clerkUserId: actorId, role: actorRole } = await requireRole(['admin', 'super_admin'])

        const { targetClerkUserId, newRole, reason } = await req.json()

        // 2. Validate role hierarchy
        // Only super_admin can assign the super_admin role
        if (newRole === 'super_admin' && actorRole !== 'super_admin') {
            return NextResponse.json(
                { error: 'Only super_admin can assign the super_admin role' },
                { status: 403 }
            )
        }

        // 3. Find target user
        const targetUser = await User.findOne({ clerkUserId: targetClerkUserId })
        if (!targetUser) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
        }

        const previousRole = targetUser.role

        // 4. Update role and history
        targetUser.role = newRole
        targetUser.roleHistory.push({
            role: newRole,
            assignedBy: actorId,
            assignedAt: new Date(),
            reason: reason || 'Role update via admin API',
        })

        await targetUser.save()

        // 5. Create audit log
        const auditRecord = await AuditLog.create({
            action: 'assign_role',
            actorClerkUserId: actorId,
            actorRole: actorRole,
            target: { type: 'User', id: targetUser._id.toString() },
            payload: { newRole, reason },
            previousValue: { role: previousRole },
            timestamp: new Date(),
        })

        return NextResponse.json(auditRecord)
    } catch (error: any) {
        if (error.status) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        console.error('[API] Role assignment error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
