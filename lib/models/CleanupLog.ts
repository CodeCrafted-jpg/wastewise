import mongoose, { Schema, Document, Model } from 'mongoose'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ICleanupLog extends Document {
    location: {
        type: 'Point'
        coordinates: [number, number] // [lng, lat]
    }
    binPredictionId: mongoose.Types.ObjectId | null
    officerClerkId: string
    officerRole: string
    cleanupRadius: number // meters, typically 30m to match bin cluster
    status: 'completed' | 'in_progress' | 'scheduled'
    notes: string
    createdAt: Date
    completedAt: Date | null
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CleanupLogSchema = new Schema<ICleanupLog>(
    {
        location: {
            type: { type: String, enum: ['Point'], required: true },
            coordinates: { type: [Number], required: true },
        },
        binPredictionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BinPrediction',
            default: null,
        },
        officerClerkId: { type: String, required: true, index: true },
        officerRole: { type: String, required: true },
        cleanupRadius: { type: Number, default: 30 },
        status: {
            type: String,
            enum: ['completed', 'in_progress', 'scheduled'],
            default: 'completed',
        },
        notes: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now, index: true },
        completedAt: { type: Date, default: null },
    },
    {
        timestamps: false,
    }
)

// Spatial index for location-based queries
CleanupLogSchema.index({ location: '2dsphere' })

// Compound index for finding recent cleanups by location
CleanupLogSchema.index({ 'location.coordinates': 1, createdAt: -1 })

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const CleanupLog: Model<ICleanupLog> =
    mongoose.models.CleanupLog ||
    mongoose.model<ICleanupLog>('CleanupLog', CleanupLogSchema)

export default CleanupLog
