/**
 * GET /api/routes/history
 * 
 * Fetches route history for the authenticated officer
 * Returns the 20 most recent routes (active first, then completed)
 * 
 * RBAC: municipal_officer+
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import RoutePlan from '@/lib/models/RoutePlan'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    try {
        // Auth & RBAC
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const requireResult = await requireRole(['municipal_officer', 'admin', 'super_admin'])
        if (requireResult instanceof NextResponse) {
            return requireResult
        }

        // Fetch routes for this officer, sorted by recency
        const routes = await RoutePlan.find({
            generatedBy: userId,
        })
            .sort({ generatedAt: -1 })
            .limit(20)
            .lean()

        // Transform for response
        const formatted = routes.map(route => ({
            routePlanId: route._id.toString(),
            generatedAt: route.generatedAt,
            algorithm: 'risk-segmented', // Default, could be stored in DB if needed
            riskTiers: route.riskTiersIncluded,
            routeOrder: route.routeOrder.map(r => ({
                binPredictionId: r.binPredictionId.toString() || r.binPredictionId,
                lat: r.lat,
                lng: r.lng,
                riskLevel: r.riskLevel,
                overflowScore: r.overflowScore,
                binRef: r.binRef,
            })),
            totalBins: route.binsIncluded.length,
            estimatedDistanceKm: route.estimatedDistanceKm,
            estimatedDurationMins: route.estimatedDurationMins,
            status: route.status,
        }))

        return NextResponse.json(formatted, { status: 200 })
    } catch (error) {
        console.error('[ROUTES] Error fetching history:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch route history',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
