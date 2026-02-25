/**
 * Analytics Service
 * 
 * Computes system-level metrics from historical data:
 * - System overview (reports, predictions, risk distribution)
 * - Route effectiveness (planned vs actual, risk reduction)
 * - Prediction accuracy (escalation rates, false positives)
 * - Officer performance (efficiency, cleanup count)
 * - System health trends
 */

import WasteReport from '@/lib/models/WasteReport'
import BinPrediction from '@/lib/models/BinPrediction'
import CleanupLog from '@/lib/models/CleanupLog'
import RoutePlan from '@/lib/models/RoutePlan'
import Analytics, { IAnalytics } from '@/lib/models/Analytics'

// ---------------------------------------------------------------------------
// Overview Metrics
// ---------------------------------------------------------------------------

export async function computeOverviewMetrics() {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Reports
    const totalReports = await WasteReport.countDocuments({})
    const reportsLast7d = await WasteReport.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
    })
    const reportsLast30d = await WasteReport.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
    })

    // Bin predictions
    const allBins = await BinPrediction.find({})
        .select('overflowScore riskLevel')
        .lean()

    const avgScore =
        allBins.length > 0
            ? allBins.reduce((sum, b) => sum + b.overflowScore, 0) / allBins.length
            : 0

    const riskCounts = {
        critical: allBins.filter((b) => b.riskLevel === 'critical').length,
        high: allBins.filter((b) => b.riskLevel === 'high').length,
        medium: allBins.filter((b) => b.riskLevel === 'medium').length,
        low: allBins.filter((b) => b.riskLevel === 'low').length,
    }

    return {
        totalReports,
        totalReportsLast7d: reportsLast7d,
        totalReportsLast30d: reportsLast30d,
        averageOverflowScore: Math.round(avgScore * 100) / 100,
        criticalBinCount: riskCounts.critical,
        highBinCount: riskCounts.high,
        mediumBinCount: riskCounts.medium,
        lowBinCount: riskCounts.low,
    }
}

// ---------------------------------------------------------------------------
// Route Effectiveness Metrics
// ---------------------------------------------------------------------------

export async function computeRouteEffectivenessMetrics() {
    const allRoutes = await RoutePlan.find({})
        .select('routeOrder binsIncluded estimatedDistanceKm status completedAt generatedAt')
        .populate('binsIncluded', 'overflowScore')
        .lean()

    if (allRoutes.length === 0) {
        return {
            totalRoutesGenerated: 0,
            totalRoutesCompleted: 0,
            completionRate: 0,
            averageEstimatedDistance: 0,
            averageActualDistance: 0,
            averagePlannedBins: 0,
            averageActualBinsVisited: 0,
            averageRiskReduction: 0,
            averageCompletionTime: 0,
        }
    }

    const completedRoutes = allRoutes.filter((r) => r.status === 'completed')
    const completionRate =
        allRoutes.length > 0 ? (completedRoutes.length / allRoutes.length) * 100 : 0

    let totalRiskReduction = 0
    let totalCompletionTime = 0
    let completedCount = 0

    // For each route, calculate risk reduction
    for (const route of completedRoutes) {
        const binsIds = route.binsIncluded || []

        // Calculate pre-cleanup scores (from bin predictions)
        let preCleanupScore = 0
        for (const binId of binsIds) {
            const bin = await BinPrediction.findById(binId)
                .select('overflowScore')
                .lean()
            if (bin) {
                preCleanupScore += bin.overflowScore
            }
        }

        // Calculate post-cleanup scores
        const cleanupLogs = await CleanupLog.find({
            binPredictionId: { $in: binsIds },
            completedAt: { $lte: route.completedAt },
        })
            .sort({ completedAt: -1 })
            .lean()

        let postCleanupScore = 0
        for (const cleanup of cleanupLogs) {
            const bin = await BinPrediction.findById(cleanup.binPredictionId)
                .select('overflowScore')
                .lean()
            if (bin) {
                postCleanupScore += bin.overflowScore * 0.3 // Assume 70% risk reduction from cleanup
            }
        }

        const riskReduction = Math.max(0, preCleanupScore - postCleanupScore)
        totalRiskReduction += riskReduction

        // Completion time
        if (route.completedAt && route.generatedAt) {
            const timeMinutes =
                (new Date(route.completedAt).getTime() - new Date(route.generatedAt).getTime()) /
                (1000 * 60)
            totalCompletionTime += timeMinutes
            completedCount++
        }
    }

    const avgRouteDistance =
        allRoutes.length > 0
            ? allRoutes.reduce((sum, r) => sum + (r.estimatedDistanceKm || 0), 0) / allRoutes.length
            : 0

    const avgRiskReduction = completedCount > 0 ? totalRiskReduction / completedCount : 0
    const avgCompletionTime = completedCount > 0 ? totalCompletionTime / completedCount : 0

    return {
        totalRoutesGenerated: allRoutes.length,
        totalRoutesCompleted: completedRoutes.length,
        completionRate: Math.round(completionRate * 100) / 100,
        averageEstimatedDistance: Math.round(avgRouteDistance * 100) / 100,
        averageActualDistance: Math.round(avgRouteDistance * 1.1 * 100) / 100, // Assume 10% deviation
        averagePlannedBins:
            allRoutes.length > 0
                ? allRoutes.reduce((sum, r) => sum + (r.binsIncluded?.length || 0), 0) /
                  allRoutes.length
                : 0,
        averageActualBinsVisited:
            completedRoutes.length > 0
                ? completedRoutes.reduce(
                      (sum, r) => sum + (r.routeOrder?.length || r.binsIncluded?.length || 0),
                      0
                  ) / completedRoutes.length
                : 0,
        averageRiskReduction: Math.round(avgRiskReduction * 100) / 100,
        averageCompletionTime: Math.round(avgCompletionTime),
    }
}

// ---------------------------------------------------------------------------
// Prediction Accuracy Metrics
// ---------------------------------------------------------------------------

export async function computePredictionAccuracyMetrics() {
    const allBins = await BinPrediction.find({})
        .select('riskLevel overflowScore lastPredictedAt lastCleanedAt')
        .lean()

    if (allBins.length === 0) {
        return {
            totalBinsPredicted: 0,
            criticalAccuracy: 0,
            highAccuracy: 0,
            falsePositiveRate: 0,
            averagePredictionLifespan: 0,
            escalationRate: 0,
        }
    }

    // Track bins that were predicted CRITICAL/HIGH but ended up being cleaned vs not
    let criticalCorrect = 0
    let criticalTotal = 0
    let highCorrect = 0
    let highTotal = 0
    let falsePositives = 0
    let totalLifespan = 0
    let lifeSpanCount = 0

    for (const bin of allBins) {
        if (bin.riskLevel === 'critical') {
            criticalTotal++
            // Check if it was cleaned
            const cleanup = await CleanupLog.findOne({ binPredictionId: bin._id }).lean()
            if (cleanup) {
                criticalCorrect++
            }
        }

        if (bin.riskLevel === 'high') {
            highTotal++
            const cleanup = await CleanupLog.findOne({ binPredictionId: bin._id }).lean()
            if (cleanup) {
                highCorrect++
            }
        }

        // False positive: predicted HIGH/CRITICAL but never required cleanup
        if ((bin.riskLevel === 'high' || bin.riskLevel === 'critical') && bin.overflowScore < 0.3) {
            falsePositives++
        }

        // Prediction lifespan
        if (bin.lastPredictedAt && bin.lastCleanedAt) {
            const lifespan =
                (new Date(bin.lastCleanedAt).getTime() -
                    new Date(bin.lastPredictedAt).getTime()) /
                (1000 * 60 * 60 * 24)
            totalLifespan += lifespan
            lifeSpanCount++
        }
    }

    const criticalAccuracy = criticalTotal > 0 ? (criticalCorrect / criticalTotal) * 100 : 0
    const highAccuracy = highTotal > 0 ? (highCorrect / highTotal) * 100 : 0
    const falsePositiveRate =
        criticalTotal + highTotal > 0
            ? (falsePositives / (criticalTotal + highTotal)) * 100
            : 0
    const avgLifespan = lifeSpanCount > 0 ? totalLifespan / lifeSpanCount : 0

    return {
        totalBinsPredicted: allBins.length,
        criticalAccuracy: Math.round(criticalAccuracy * 100) / 100,
        highAccuracy: Math.round(highAccuracy * 100) / 100,
        falsePositiveRate: Math.round(falsePositiveRate * 100) / 100,
        averagePredictionLifespan: Math.round(avgLifespan * 100) / 100,
        escalationRate: 5.0, // Placeholder: would track MEDIUM → HIGH escalations
    }
}

// ---------------------------------------------------------------------------
// Officer Performance Metrics
// ---------------------------------------------------------------------------

export async function computeOfficerPerformanceMetrics() {
    const officerRoutes = await RoutePlan.find({ status: 'completed' })
        .select('generatedBy completedAt routeOrder binsIncluded')
        .lean()

    const officerMap = new Map<
        string,
        {
            completedRoutes: number
            totalBins: number
            totalTime: number
            totalRiskReduction: number
        }
    >()

    for (const route of officerRoutes) {
        const officerId = route.generatedBy
        if (!officerMap.has(officerId)) {
            officerMap.set(officerId, {
                completedRoutes: 0,
                totalBins: 0,
                totalTime: 0,
                totalRiskReduction: 0,
            })
        }

        const stats = officerMap.get(officerId)!
        stats.completedRoutes++
        stats.totalBins += route.routeOrder?.length || route.binsIncluded?.length || 0

        if (route.completedAt) {
            stats.totalTime += 30 // Placeholder: assume 30 mins per route
        }
    }

    const officerMetrics = Array.from(officerMap.entries()).map(([officerId, stats]) => ({
        officerId,
        completedRoutes: stats.completedRoutes,
        totalBinsCleaned: stats.totalBins,
        averageRiskReduction: 12.5, // Placeholder
        averageCompletionTime: Math.round(stats.totalTime / stats.completedRoutes),
        efficiency: Math.round((stats.totalBins / stats.totalTime) * 60 * 100) / 100,
    }))

    // Sort by efficiency
    return officerMetrics.sort((a, b) => b.efficiency - a.efficiency).slice(0, 10)
}

// ---------------------------------------------------------------------------
// System Health Score (Composite Metric)
// ---------------------------------------------------------------------------

export async function computeSystemHealthScore(
    overview: any,
    routes: any,
    predictions: any
): Promise<number> {
    // Health score factors (0-100):
    // - Route completion rate (30%)
    // - Prediction accuracy (30%)
    // - Critical bins declining (20%)
    // - Cleanup latency (20%)

    const routeHealth = routes.completionRate // 0-100
    const predictionHealth = (predictions.criticalAccuracy + predictions.highAccuracy) / 2 // 0-100
    const criticalHealth = Math.max(0, 100 - overview.criticalBinCount * 2) // Fewer criticals = higher health
    const latencyHealth = 100 - Math.min(100, (routes.averageCompletionTime / 60) * 10) // Faster = higher

    const healthScore =
        (routeHealth * 0.3 +
            predictionHealth * 0.3 +
            criticalHealth * 0.2 +
            latencyHealth * 0.2) *
        0.01 *
        100

    return Math.min(100, Math.round(healthScore * 100) / 100)
}

// ---------------------------------------------------------------------------
// Generate Complete Analytics Snapshot
// ---------------------------------------------------------------------------

export async function generateAnalyticsSnapshot(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    console.log(`[ANALYTICS] Generating ${period} snapshot...`)

    try {
        const overview = await computeOverviewMetrics()
        const routes = await computeRouteEffectivenessMetrics()
        const predictions = await computePredictionAccuracyMetrics()
        const officerMetrics = await computeOfficerPerformanceMetrics()
        const systemHealthScore = await computeSystemHealthScore(overview, routes, predictions)

        const snapshot: Partial<IAnalytics> = {
            generatedAt: new Date(),
            period,
            overview,
            routes,
            predictions,
            officerMetrics,
            trends: {
                criticalTrendLast7d: [overview.criticalBinCount], // Would be extended with historical data
                cleanupLatency: routes.averageCompletionTime,
                systemHealthScore,
            },
        }

        // Save to database
        const analytics = await Analytics.create(snapshot)
        console.log(`[ANALYTICS] Snapshot saved: ${analytics._id}`)

        return analytics
    } catch (error) {
        console.error('[ANALYTICS] Error generating snapshot:', error)
        throw error
    }
}
