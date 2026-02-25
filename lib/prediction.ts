import dbConnect from './db'
import WasteReport from './models/WasteReport'
import BinPrediction from './models/BinPrediction'
import CleanupLog from './models/CleanupLog'
import AuditLog from './models/AuditLog'

// ---------------------------------------------------------------------------
// Configuration (Deterministic Weights)
// ---------------------------------------------------------------------------

const WEIGHTS = {
    FREQUENCY: 10,  // reports * 10
    SEVERITY: 0.3,  // avgSeverity * 0.3
    TIME: 2,        // days * 2
}

const THRESHOLDS = {
    CRITICAL: 80,
    HIGH: 60,
    MEDIUM: 30,
}

const CLUSTER_RADIUS_METERS = 30
const WINDOW_HOURS = 48

// ---------------------------------------------------------------------------
// Helper: Haversine distance (meters)
// ---------------------------------------------------------------------------

function distanceBetweenCoords(
    coord1: [number, number],
    coord2: [number, number]
): number {
    const [lng1, lat1] = coord1
    const [lng2, lat2] = coord2
    const R = 6371e3 // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// ---------------------------------------------------------------------------
// Engine Logic
// ---------------------------------------------------------------------------

export async function runPredictionEngine() {
    await dbConnect()

    const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000)

    // 1. Fetch all open reports in the last 48 hours
    const activeReports = await WasteReport.find({
        status: 'open',
        createdAt: { $gte: windowStart },
    }).lean()

    if (activeReports.length === 0) {
        return {
            success: true,
            message: 'No active reports to process',
            binsProcessed: 0,
            riskSummary: { critical: 0, high: 0, medium: 0, low: 0 }
        }
    }

    // 2. Spatial Clustering: Group reports within 30m radius
    const bins: any[] = []
    const processedReportIds = new Set<string>()

    // Sort by createdAt (most recent first) for deterministic bin center selection
    const sortedReports = [...activeReports].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    for (const report of sortedReports) {
        const reportId = report._id.toString()
        if (processedReportIds.has(reportId)) continue

        // Find all neighbors within CLUSTER_RADIUS_METERS
        const neighbors = [report]
        for (const otherReport of activeReports) {
            const otherId = otherReport._id.toString()
            if (otherId === reportId || processedReportIds.has(otherId)) continue

            const dist = distanceBetweenCoords(
                report.location.coordinates as [number, number],
                otherReport.location.coordinates as [number, number]
            )

            if (dist <= CLUSTER_RADIUS_METERS) {
                neighbors.push(otherReport)
            }
        }

        // Mark all neighbors as processed
        neighbors.forEach(n => processedReportIds.add(n._id.toString()))

        // Aggregate stats for this bin
        const reportsCount = neighbors.length
        const avgSeverity = neighbors.length > 0
            ? neighbors.reduce((acc, n) => acc + (n.severityScore || 0), 0) / reportsCount
            : 0

        // 3. Last cleanup lookup: Search CleanupLog for recent completions within 30m radius
        // CleanupLog is the source of truth for cleanup tracking
        const lastCleanup = await CleanupLog.findOne({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: report.location.coordinates,
                    },
                    $maxDistance: CLUSTER_RADIUS_METERS,
                },
            },
            status: 'completed',
        })
            .sort({ completedAt: -1 })
            .lean()

        // Use CleanupLog.completedAt if found, otherwise fall back to report creation date
        const lastCleanedAt = lastCleanup?.completedAt || report.createdAt
        const daysSinceCleanup = Math.max(
            0,
            (Date.now() - new Date(lastCleanedAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        // 4. Score Computation (Deterministic Formula)
        const scoreA = Math.min(reportsCount * WEIGHTS.FREQUENCY, 50)  // Cap at 50
        const scoreB = Math.min(avgSeverity * WEIGHTS.SEVERITY, 30)    // Cap at 30
        const scoreC = Math.min(daysSinceCleanup * WEIGHTS.TIME, 20)   // Cap at 20
        const overflowScore = Math.min(100, scoreA + scoreB + scoreC)

        // 5. Risk Categorization (Deterministic)
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
        if (overflowScore >= THRESHOLDS.CRITICAL) {
            riskLevel = 'critical'
        } else if (overflowScore >= THRESHOLDS.HIGH) {
            riskLevel = 'high'
        } else if (overflowScore >= THRESHOLDS.MEDIUM) {
            riskLevel = 'medium'
        }

        bins.push({
            location: report.location,
            stats: {
                reportsLast48Hours: reportsCount,
                avgSeverity: Math.round(avgSeverity * 100) / 100, // Round to 2 decimals
                daysSinceLastCleanup: Math.round(daysSinceCleanup * 100) / 100,
            },
            overflowScore: Math.round(overflowScore * 100) / 100,
            riskLevel,
            lastPredictedAt: new Date(),
            lastCleanedAt: new Date(lastCleanedAt),
        })
    }

    // 6. Upsert Results into BinPrediction collection
    for (const bin of bins) {
        await BinPrediction.findOneAndUpdate(
            {
                'location.coordinates': bin.location.coordinates,
            },
            {
                $set: {
                    location: bin.location,
                    stats: bin.stats,
                    overflowScore: bin.overflowScore,
                    riskLevel: bin.riskLevel,
                    lastPredictedAt: bin.lastPredictedAt,
                    lastCleanedAt: bin.lastCleanedAt,
                }
            },
            { upsert: true, new: true }
        )
    }

    // 7. Calculate risk summary
    const riskSummary = {
        critical: bins.filter(b => b.riskLevel === 'critical').length,
        high: bins.filter(b => b.riskLevel === 'high').length,
        medium: bins.filter(b => b.riskLevel === 'medium').length,
        low: bins.filter(b => b.riskLevel === 'low').length,
    }

    return {
        success: true,
        binsProcessed: bins.length,
        riskSummary,
    }
}
