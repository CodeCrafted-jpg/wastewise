import mongoose, { Schema, Document, Model } from 'mongoose'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WasteCategory = 'organic' | 'plastic' | 'metal' | 'mixed'
export type ReportStatus = 'open' | 'resolved'

export interface IWasteReport extends Document {
    userClerkId: string
    areaId?: string
    imageUrls: string[]
    description: string
    location: {
        type: 'Point'
        coordinates: [number, number] // [lng, lat]
    }
    aiCategory: WasteCategory
    aiConfidence: number
    classifierUsed: 'cohere' | 'fallback' | 'manual'
    severityScore: number // 0-100
    status: ReportStatus
    createdAt: Date
    resolvedAt?: Date
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const WasteReportSchema = new Schema<IWasteReport>(
    {
        userClerkId: { type: String, required: true, index: true },
        areaId: { type: String },
        imageUrls: { type: [String], required: true },
        description: { type: String, required: true },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true,
            },
            coordinates: {
                type: [Number],
                required: true,
            },
        },
        aiCategory: {
            type: String,
            enum: ['organic', 'plastic', 'metal', 'mixed'],
            default: 'mixed',
        },
        aiConfidence: { type: Number, default: 0 },
        classifierUsed: {
            type: String,
            enum: ['cohere', 'fallback', 'manual'],
            default: 'fallback',
        },
        severityScore: { type: Number, default: 0, min: 0, max: 100 },
        status: {
            type: String,
            enum: ['open', 'resolved'],
            default: 'open',
            index: true,
        },
        resolvedAt: { type: Date },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    }
)

// Critical: Geospatial index for duplicate detection and heatmap queries
WasteReportSchema.index({ location: '2dsphere' })

// Compound index for finding open reports by status and location
WasteReportSchema.index({ status: 1, location: '2dsphere' })

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const WasteReport: Model<IWasteReport> =
    mongoose.models.WasteReport ||
    mongoose.model<IWasteReport>('WasteReport', WasteReportSchema)

export default WasteReport
