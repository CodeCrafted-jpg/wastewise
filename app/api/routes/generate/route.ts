/**
 * POST /api/routes/generate
 * 
 * Generates an optimized cleanup route for municipal officers
 * 
 * RBAC: municipal_officer+
 * 
 * Request body:
 * {
 *   riskTiers?: ['CRITICAL', 'HIGH'], // defaults to ['CRITICAL', 'HIGH']
 *   algorithm?: 'nearest-neighbor' | 'risk-priority' | 'risk-segmented', // defaults to 'risk-segmented'
 *   excludeRecentlyCleanedHours?: number, // defaults to 24 hours
 *   centerLat?: number, // optional start location
 *   centerLng?: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import RoutePlan from '@/lib/models/RoutePlan'
import BinPrediction from '@/lib/models/BinPrediction'
import AuditLog from '@/lib/models/AuditLog'
import {
    generateNearestNeighborRoute,
    generateRiskPrioritySortRoute,
    generateRiskSegmentedRoute,
} from '@/lib/routing'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        // Step 1: Auth & RBAC
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const requireResult = await requireRole(['municipal_officer', 'admin', 'super_admin'])
        if (requireResult instanceof NextResponse) {
            return requireResult
        }
        const { userRole } = requireResult

        // Step 2: Parse request
        const body = await req.json()
        const {
            riskTiers = ['CRITICAL', 'HIGH'],
            algorithm = 'risk-segmented',
            excludeRecentlyCleanedHours = 24,
            centerLat,
            centerLng,
        } = body

        console.log(`[ROUTE] Generating route for ${userId} with tiers ${riskTiers.join(', ')}`)

        // Step 3: Fetch bins in specified risk tiers
        const binsTiers = riskTiers.map((t: string) => t.toLowerCase())
        const bins = await BinPrediction.find({
            riskLevel: { $in: binsTiers },
        })
            .select('_id location stats riskLevel overflowScore lastCleanedAt')
            .lean()

        console.log(`[ROUTE] Found ${bins.length} bins in risk tiers`)

        // Step 4: Filter out recently cleaned bins
        const now = new Date()
        const recentThreshold = new Date(now.getTime() - excludeRecentlyCleanedHours * 60 * 60 * 1000)

        const filteredBins = bins.filter(bin => {
            if (!bin.lastCleanedAt) return true // Include if never cleaned
            return new Date(bin.lastCleanedAt) < recentThreshold
        })

        console.log(
            `[ROUTE] After filtering recent cleanups: ${filteredBins.length} bins remaining`
        )

        if (filteredBins.length === 0) {
            return NextResponse.json(
                {
                    message: 'No bins require cleanup in specified risk tiers',
                    routeOrder: [],
                    estimatedDistanceKm: 0,
                    estimatedDurationMins: 0,
                },
                { status: 200 }
            )
        }

        // Step 5: Convert bins to routing format
        const binLocations = filteredBins.map(bin => ({
            id: bin._id.toString(),
            lat: bin.location.coordinates[1],
            lng: bin.location.coordinates[0],
            riskLevel: bin.riskLevel,
            overflowScore: bin.overflowScore,
        }))

        // Step 6: Generate route using selected algorithm
        let routeResult
        switch (algorithm) {
            case 'nearest-neighbor':
                routeResult = generateNearestNeighborRoute(binLocations, centerLat, centerLng)
                break
            case 'risk-priority':
                routeResult = generateRiskPrioritySortRoute(binLocations)
                break
            case 'risk-segmented':
            default:
                routeResult = generateRiskSegmentedRoute(binLocations)
                break
        }

        console.log(
            `[ROUTE] Generated route: ${routeResult.routeOrder.length} bins, ${routeResult.totalDistanceKm}km`
        )

        // Step 7: Convert route to database format
        const routeOrderDB = routeResult.routeOrder.map(bin => ({
            binPredictionId: bin.id,
            lat: bin.lat,
            lng: bin.lng,
            riskLevel: bin.riskLevel,
            overflowScore: bin.overflowScore,
            binRef: `${bin.riskLevel.toUpperCase()} (${bin.overflowScore.toFixed(1)})`,
        }))

        // Step 8: Save RoutePlan to database
        const routePlan = await RoutePlan.create({
            generatedAt: now,
            generatedBy: userId,
            riskTiersIncluded: riskTiers,
            binsIncluded: filteredBins.map(b => b._id),
            routeOrder: routeOrderDB,
            estimatedDistanceKm: routeResult.totalDistanceKm,
            estimatedDurationMins: routeResult.estimatedDurationMins,
            status: 'active',
        })

        console.log(`[ROUTE] Saved route plan: ${routePlan._id}`)

        // Step 9: Log to AuditLog
        await AuditLog.create({
            action: 'route_generated',
            actorClerkUserId: userId,
            actorRole: userRole,
            target: {
                type: 'RoutePlan',
                id: routePlan._id.toString(),
            },
            payload: {
                routePlanId: routePlan._id.toString(),
                algorithm,
                riskTiers,
                binsCount: filteredBins.length,
                distanceKm: routeResult.totalDistanceKm,
                durationMins: routeResult.estimatedDurationMins,
            },
        })

        console.log(`[ROUTE] Audit logged for ${userId}`)

        // Step 10: Return formatted route
        return NextResponse.json(
            {
                routePlanId: routePlan._id.toString(),
                generatedAt: routePlan.generatedAt,
                algorithm,
                riskTiers,
                routeOrder: routeOrderDB.map(r => ({
                    binPredictionId: r.binPredictionId,
                    lat: r.lat,
                    lng: r.lng,
                    riskLevel: r.riskLevel,
                    overflowScore: r.overflowScore,
                    binRef: r.binRef,
                })),
                totalBins: routeOrderDB.length,
                estimatedDistanceKm: routeResult.totalDistanceKm,
                estimatedDurationMins: routeResult.estimatedDurationMins,
                status: 'active',
            },
            { status: 200 }
        )
    } catch (error) {
        console.error('[ROUTE] Error generating route:', error)
        return NextResponse.json(
            {
                error: 'Failed to generate route',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
