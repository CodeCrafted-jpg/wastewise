import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import dbConnect from '@/lib/db'
import WasteReport from '@/lib/models/WasteReport'
import AuditLog from '@/lib/models/AuditLog'
import {
    validateReportInput,
    checkDuplicate,
    classifyWaste,
    calculateSeverity,
    attemptAwardPoints,
    CreateReportInput,
} from '@/lib/reporting'

/**
 * POST /api/reports
 * Body: CreateReportInput
 */
export async function POST(req: Request) {
    try {
        // 1. Auth check (Citizen or higher)
        const { clerkUserId, role } = await requireRole(['citizen', 'municipal_officer', 'admin', 'super_admin'])
        const body: CreateReportInput = await req.json()

        // 2. Validation
        try {
            validateReportInput(body)
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        await dbConnect()

        // 3. Duplicate Detection
        const isDuplicate = await checkDuplicate(body.location.lat, body.location.lng)
        if (isDuplicate) {
            return NextResponse.json(
                { error: 'A report for this location was already submitted recently.' },
                { status: 409 }
            )
        }

        // 4. AI Classification
        const { category, confidence, classifier } = await classifyWaste(body.description)

        // 5. Severity Scoring
        const severityScore = calculateSeverity(body.userSeverity, category, confidence)

        // 6. Save Report
        const report = await WasteReport.create({
            userClerkId: clerkUserId,
            imageUrls: body.imageUrls,
            description: body.description,
            location: {
                type: 'Point',
                coordinates: [body.location.lng, body.location.lat], // [lng, lat]
            },
            aiCategory: category,
            aiConfidence: confidence,
            classifierUsed: classifier,
            severityScore,
            status: 'open',
        })

        // 7. Audit Report Creation
        await AuditLog.create({
            action: 'emergency_action', // We'll use this or add 'report_created' to enum if needed
            actorClerkUserId: clerkUserId,
            actorRole: role,
            target: { type: 'WasteReport', id: report._id.toString() },
            payload: { severityScore, aiCategory: category },
            timestamp: new Date(),
        })

        // 8. Award EcoPoints (with caps)
        const pointsResult = await attemptAwardPoints(clerkUserId)

        return NextResponse.json({
            reportId: report._id,
            aiCategory: category,
            severityScore,
            pointsAwarded: pointsResult.awarded ? pointsResult.points : 0,
            pointsReason: pointsResult.reason,
            status: 'open',
        })
    } catch (error: any) {
        if (error.status) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        console.error('[API] Report submission error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
