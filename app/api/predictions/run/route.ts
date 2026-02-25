import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { runPredictionEngine } from '@/lib/prediction'
import AuditLog from '@/lib/models/AuditLog'

/**
 * POST /api/predictions/run
 * 
 * Admin-only: Triggers the deterministic prediction engine.
 * 
 * Process:
 * 1. Verify caller is admin or super_admin
 * 2. Run the prediction engine (aggregates reports, clusters spatially, scores)
 * 3. Upsert results to bin_predictions collection
 * 4. Log the execution to audit_logs with full summary
 * 
 * Returns: Risk summary with bins processed and distribution by risk level
 */
export async function POST() {
    try {
        // 1. Auth check (Admin or higher)
        const { clerkUserId, role } = await requireRole(['admin', 'super_admin'])

        // 2. Run the Prediction Engine
        // This is deterministic and reproducible:
        // - Aggregates reports from last 48 hours
        // - Groups spatially within 30m radius
        // - Computes overflow scores using configurable weights
        // - Assigns risk levels firmly (low, medium, high, critical)
        const result = await runPredictionEngine()

        if (!result.success) {
            return NextResponse.json(
                { error: 'Prediction engine failed', details: result.message },
                { status: 500 }
            )
        }

        // 3. Log the Prediction Run to Audit Trail
        // This ensures every prediction execution is traceable and auditable
        await AuditLog.create({
            action: 'prediction_run',
            actorClerkUserId: clerkUserId,
            actorRole: role,
            target: { type: 'PredictionEngine', id: 'system' },
            payload: {
                binsProcessed: result.binsProcessed,
                riskSummary: result.riskSummary,
                executedAt: new Date().toISOString(),
            },
            timestamp: new Date(),
        })

        return NextResponse.json({
            success: true,
            message: 'Prediction engine executed successfully',
            binsProcessed: result.binsProcessed,
            riskSummary: result.riskSummary,
        })
    } catch (error: any) {
        // Handle auth-related errors
        if (error.status === 401) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (error.status === 403) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
        }

        // Log and return generic error
        console.error('[API] Prediction engine error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
