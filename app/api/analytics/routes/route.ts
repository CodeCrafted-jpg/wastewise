/**
 * GET /api/analytics/routes
 * 
 * Returns route effectiveness metrics
 * RBAC: admin+
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { computeRouteEffectivenessMetrics } from '@/lib/analytics'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const requireResult = await requireRole(['admin', 'super_admin'])
        if (requireResult instanceof NextResponse) {
            return requireResult
        }

        const routes = await computeRouteEffectivenessMetrics()

        return NextResponse.json(
            {
                routes,
                generatedAt: new Date(),
            },
            { status: 200 }
        )
    } catch (error) {
        console.error('[ANALYTICS] Error fetching routes metrics:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch routes analytics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
