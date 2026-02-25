/**
 * POST /api/routes/[id]/complete
 * 
 * Marks a route as completed and logs the completion
 * 
 * RBAC: municipal_officer+
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import RoutePlan from '@/lib/models/RoutePlan'
import AuditLog from '@/lib/models/AuditLog'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const requireResult = await requireRole(['municipal_officer', 'admin', 'super_admin'])
        if (requireResult instanceof NextResponse) {
            return requireResult
        }
        const { userRole } = requireResult

        const routeId = params.id

        // Find route
        const route = await RoutePlan.findById(routeId)
        if (!route) {
            return NextResponse.json({ error: 'Route not found' }, { status: 404 })
        }

        // Verify ownership
        if (route.generatedBy !== userId) {
            return NextResponse.json(
                { error: 'Not authorized to modify this route' },
                { status: 403 }
            )
        }

        // Update status
        const now = new Date()
        route.status = 'completed'
        route.completedAt = now
        route.completedBy = userId
        await route.save()

        // Log to AuditLog
        await AuditLog.create({
            action: 'route_completed',
            actorClerkUserId: userId,
            actorRole: userRole,
            target: {
                type: 'RoutePlan',
                id: routeId,
            },
            payload: {
                routePlanId: routeId,
                binsCount: route.binsIncluded.length,
                distanceKm: route.estimatedDistanceKm,
                completedAt: now,
            },
        })

        return NextResponse.json(
            {
                message: 'Route marked as completed',
                routePlanId: routeId,
                status: 'completed',
                completedAt: now,
            },
            { status: 200 }
        )
    } catch (error) {
        console.error('[ROUTES] Error marking route completed:', error)
        return NextResponse.json(
            {
                error: 'Failed to mark route completed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
