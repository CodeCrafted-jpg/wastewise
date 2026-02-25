import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import BinPrediction from '@/lib/models/BinPrediction'

/**
 * GET /api/predictions/public
 * 
 * PUBLIC ENDPOINT: Returns all current bin predictions for visualization.
 * 
 * No authentication required. Returns:
 * - Bin locations (GeoJSON coordinates)
 * - Risk levels (for color mapping)
 * - Stats (frequency, severity, cleanup age)
 * - Scores (overflow score for reference)
 * 
 * Frontend renders this data on heatmap with NO business logic.
 * All calculations already completed server-side.
 */
export async function GET() {
    try {
        await dbConnect()

        // Fetch all bin predictions from database
        const bins = await BinPrediction.find({})
            .select('location stats overflowScore riskLevel lastPredictedAt')
            .lean()

        if (!bins || bins.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No predictions available yet',
                bins: [],
                count: 0,
            })
        }

        // Transform data for frontend consumption
        // Format: Array of {lat, lng, riskLevel, score, stats}
        const formattedBins = bins.map(bin => {
            const [lng, lat] = bin.location.coordinates

            return {
                id: bin._id.toString(),
                lat,
                lng,
                riskLevel: bin.riskLevel,
                overflowScore: bin.overflowScore,
                stats: {
                    reportsLast48Hours: bin.stats.reportsLast48Hours,
                    avgSeverity: bin.stats.avgSeverity,
                    daysSinceLastCleanup: bin.stats.daysSinceLastCleanup,
                },
                lastPredictedAt: bin.lastPredictedAt,
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Predictions retrieved successfully',
            bins: formattedBins,
            count: formattedBins.length,
            summary: {
                critical: formattedBins.filter(b => b.riskLevel === 'critical').length,
                high: formattedBins.filter(b => b.riskLevel === 'high').length,
                medium: formattedBins.filter(b => b.riskLevel === 'medium').length,
                low: formattedBins.filter(b => b.riskLevel === 'low').length,
            }
        })
    } catch (error: any) {
        console.error('[API] Error fetching predictions:', error)
        return NextResponse.json(
            { error: 'Failed to fetch predictions' },
            { status: 500 }
        )
    }
}
