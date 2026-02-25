/**
 * GET /api/analytics/overview
 * 
 * Returns system-level overview metrics
 * RBAC: admin+
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { computeOverviewMetrics, computeSystemHealthScore, computeRouteEffectivenessMetrics, computePredictionAccuracyMetrics } from '@/lib/analytics'
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

        // Compute all metrics
        const overview = await computeOverviewMetrics()
        const routes = await computeRouteEffectivenessMetrics()
        const predictions = await computePredictionAccuracyMetrics()
        const systemHealthScore = await computeSystemHealthScore(overview, routes, predictions)

        return NextResponse.json(
            {
                overview,
                systemHealthScore,
                generatedAt: new Date(),
            },
            { status: 200 }
        )
    } catch (error) {
        console.error('[ANALYTICS] Error fetching overview:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch analytics overview',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
