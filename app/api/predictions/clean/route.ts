import { NextResponse, NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import dbConnect from '@/lib/db'
import CleanupLog from '@/lib/models/CleanupLog'
import BinPrediction from '@/lib/models/BinPrediction'
import AuditLog from '@/lib/models/AuditLog'

/**
 * POST /api/predictions/clean
 * 
 * Municipal officer or admin: Logs a cleanup action.
 * 
 * Closes the prediction loop:
 * 1. Creates CleanupLog entry with location & officer info
 * 2. Updates BinPrediction.lastCleanedAt timestamp
 * 3. Logs action to AuditLog for compliance
 * 4. Returns updated bin data (frontend doesn't recalculate)
 * 
 * On next prediction run, engine will see new lastCleanedAt
 * and reduce overflowScore accordingly.
 * 
 * Body:
 * {
 *   "lat": 22.5726,
 *   "lng": 88.3639,
 *   "binPredictionId": "ObjectId",
 *   "notes": "Cleaned manually, disposed of waste"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Auth check (Municipal Officer or higher)
        const { clerkUserId, role } = await requireRole(['municipal_officer', 'admin', 'super_admin'])

        // 2. Parse request
        const body = await request.json()
        const { lat, lng, binPredictionId, notes = '' } = body

        // Validate input
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return NextResponse.json(
                { error: 'Invalid location coordinates' },
                { status: 400 }
            )
        }

        if (!binPredictionId || typeof binPredictionId !== 'string') {
            return NextResponse.json(
                { error: 'Invalid binPredictionId' },
                { status: 400 }
            )
        }

        await dbConnect()

        const now = new Date()

        // 3. Create CleanupLog entry
        const cleanupLog = await CleanupLog.create({
            location: {
                type: 'Point',
                coordinates: [lng, lat],
            },
            binPredictionId: binPredictionId,
            officerClerkId: clerkUserId,
            officerRole: role,
            cleanupRadius: 30,
            status: 'completed',
            notes: notes,
            completedAt: now,
        })

        // 4. Update BinPrediction with new lastCleanedAt
        // Important: Don't modify scores here. Scores are recalculated on next prediction run.
        const updatedBin = await BinPrediction.findByIdAndUpdate(
            binPredictionId,
            {
                $set: {
                    lastCleanedAt: now,
                }
            },
            { new: true }
        )

        if (!updatedBin) {
            return NextResponse.json(
                { error: 'Bin prediction not found' },
                { status: 404 }
            )
        }

        // 5. Log to AuditLog
        await AuditLog.create({
            action: 'mark_cleaned',
            actorClerkUserId: clerkUserId,
            actorRole: role,
            target: { type: 'BinPrediction', id: binPredictionId },
            payload: {
                cleanupLogId: cleanupLog._id.toString(),
                location: { lat, lng },
                notes: notes,
                cleanupRadius: 30,
            },
            timestamp: now,
        })

        // 6. Calculate days since cleanup for response (informational, not for scoring)
        const daysSinceCleanup = 0 // Just cleaned
        const [lng_coords, lat_coords] = updatedBin.location.coordinates

        return NextResponse.json({
            success: true,
            message: 'Cleanup logged successfully',
            cleanupLog: {
                id: cleanupLog._id.toString(),
                location: { lat, lng },
                completedAt: now.toISOString(),
                officerClerkId: clerkUserId,
            },
            updatedBin: {
                id: updatedBin._id.toString(),
                location: { lat: lat_coords, lng: lng_coords },
                lastCleanedAt: updatedBin.lastCleanedAt.toISOString(),
                stats: updatedBin.stats,
                overflowScore: updatedBin.overflowScore,
                riskLevel: updatedBin.riskLevel,
                note: 'Scores will be recalculated on next prediction run. Day-counter reset to 0.',
            }
        })
    } catch (error: any) {
        // Handle auth errors
        if (error.status === 401) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (error.status === 403) {
            return NextResponse.json(
                { error: 'Forbidden: Municipal Officer access required' },
                { status: 403 }
            )
        }

        console.error('[API] Cleanup logging error:', error)
        return NextResponse.json(
            { error: 'Failed to log cleanup' },
            { status: 500 }
        )
    }
}
