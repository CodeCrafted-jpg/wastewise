import dbConnect from './db'
import WasteReport, { WasteCategory } from './models/WasteReport'
import User from './models/User'
import AuditLog from './models/AuditLog'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DUPLICATE_RADIUS_METERS = 20
const DUPLICATE_TIME_WINDOW_HOURS = 2
const ECO_POINTS_AWARD = 15
const DAILY_POINT_ELIGIBILITY_CAP = 3

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface CreateReportInput {
    imageUrls: string[]
    description: string
    location: {
        lat: number
        lng: number
    }
    userSeverity: number // 1-5
}

export function validateReportInput(input: CreateReportInput) {
    if (!input.imageUrls || input.imageUrls.length === 0) {
        throw new Error('At least one image is required')
    }
    if (!input.description || input.description.length < 10) {
        throw new Error('Description must be at least 10 characters')
    }
    if (!input.location || typeof input.location.lat !== 'number' || typeof input.location.lng !== 'number') {
        throw new Error('Valid location coordinates are required')
    }
    if (input.userSeverity < 1 || input.userSeverity > 5) {
        throw new Error('User severity must be between 1 and 5')
    }
}

// ---------------------------------------------------------------------------
// Duplicate Detection
// ---------------------------------------------------------------------------

export async function checkDuplicate(lat: number, lng: number) {
    await dbConnect()

    const timeWindow = new Date(Date.now() - DUPLICATE_TIME_WINDOW_HOURS * 60 * 60 * 1000)

    // Use MongoDB $near query for geospatial duplicate detection
    const duplicate = await WasteReport.findOne({
        status: 'open',
        createdAt: { $gte: timeWindow },
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [lng, lat], // MongoDB uses [lng, lat]
                },
                $maxDistance: DUPLICATE_RADIUS_METERS,
            },
        },
    })

    return !!duplicate
}

// ---------------------------------------------------------------------------
// AI Classification (Cohere Fallback)
// ---------------------------------------------------------------------------

export async function classifyWaste(description: string): Promise<{ category: WasteCategory; confidence: number; classifier: 'cohere' | 'fallback' }> {
    const apiKey = process.env.COHERE_API_KEY
    if (!apiKey) {
        return { category: 'mixed', confidence: 0, classifier: 'fallback' }
    }

    try {
        const response = await fetch('https://api.cohere.ai/v1/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Classify the following waste report description into exactly one of these categories: "organic", "plastic", "metal", or "mixed". Respond with ONLY the category name. Description: "${description}"`,
            }),
        })

        const data = await response.json()
        const text = data.text?.toLowerCase().trim()

        const validCategories: WasteCategory[] = ['organic', 'plastic', 'metal', 'mixed']
        const matchedCategory = validCategories.find(cat => text.includes(cat))

        if (matchedCategory) {
            return {
                category: matchedCategory,
                confidence: 0.9, // Generative returns are high confidence if they match
                classifier: 'cohere',
            }
        }
    } catch (error) {
        console.error('[Cohere] Classification failed:', error)
    }

    return { category: 'mixed', confidence: 0, classifier: 'fallback' }
}

// ---------------------------------------------------------------------------
// Scoring & Points
// ---------------------------------------------------------------------------

export function calculateSeverity(userSeverity: number, aiCategory: WasteCategory, aiConfidence: number): number {
    let score = userSeverity * 20 // Base: 20, 40, 60, 80, 100

    if (aiConfidence > 0.8) {
        if (aiCategory === 'plastic' || aiCategory === 'metal') {
            score += 10
        } else if (aiCategory === 'organic') {
            score += 5
        }
    }

    return Math.min(score, 100)
}

export async function attemptAwardPoints(clerkUserId: string) {
    await dbConnect()

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    // Check audit logs for point awards today
    const awardsToday = await AuditLog.countDocuments({
        actorClerkUserId: 'system',
        action: 'award_points',
        'target.id': clerkUserId,
        timestamp: { $gte: startOfDay },
    })

    if (awardsToday >= DAILY_POINT_ELIGIBILITY_CAP) {
        return { awarded: false, reason: 'Daily point cap reached' }
    }

    // Award points
    const user = await User.findOneAndUpdate(
        { clerkUserId },
        { $inc: { ecoPoints: ECO_POINTS_AWARD } },
        { new: true }
    )

    if (!user) {
        return { awarded: false, reason: 'User not found' }
    }

    // Log audit
    await AuditLog.create({
        action: 'award_points',
        actorClerkUserId: 'system',
        target: { type: 'user', id: clerkUserId },
        payload: {
            pointsAwarded: ECO_POINTS_AWARD,
            reason: 'valid_report',
        },
        timestamp: new Date(),
    })

    return { awarded: true, points: ECO_POINTS_AWARD }
}
