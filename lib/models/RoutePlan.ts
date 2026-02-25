import mongoose, { Schema, Model, Document } from 'mongoose'

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IRoutePlan extends Document {
    generatedAt: Date
    generatedBy: string // Clerk user ID
    riskTiersIncluded: string[] // ['CRITICAL', 'HIGH']
    binsIncluded: mongoose.Schema.Types.ObjectId[] // BinPrediction IDs
    routeOrder: {
        binPredictionId: mongoose.Schema.Types.ObjectId
        lat: number
        lng: number
        riskLevel: string
        overflowScore: number
        binRef?: string // For display
    }[]
    estimatedDistanceKm: number
    estimatedDurationMins: number
    status: 'active' | 'completed' | 'archived'
    completedAt?: Date
    completedBy?: string
    notes?: string
    createdAt: Date
    updatedAt: Date
}

// ---------------------------------------------------------------------------
// Schema Definition
// ---------------------------------------------------------------------------

const RoutePlanSchema = new Schema<IRoutePlan>(
    {
        generatedAt: { type: Date, default: Date.now, index: true },
        generatedBy: { type: String, required: true, index: true },
        riskTiersIncluded: [{ type: String }],
        binsIncluded: [
            {
                type: Schema.Types.ObjectId,
                ref: 'BinPrediction',
            },
        ],
        routeOrder: [
            {
                binPredictionId: {
                    type: Schema.Types.ObjectId,
                    ref: 'BinPrediction',
                    required: true,
                },
                lat: { type: Number, required: true },
                lng: { type: Number, required: true },
                riskLevel: { type: String },
                overflowScore: { type: Number },
                binRef: { type: String },
            },
        ],
        estimatedDistanceKm: { type: Number, default: 0 },
        estimatedDurationMins: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['active', 'completed', 'archived'],
            default: 'active',
            index: true,
        },
        completedAt: Date,
        completedBy: String,
        notes: String,
    },
    {
        timestamps: true,
    }
)

// Compound index for querying active routes by officer
RoutePlanSchema.index({ generatedBy: 1, status: 1, generatedAt: -1 })

// Index for finding active routes
RoutePlanSchema.index({ status: 1, generatedAt: -1 })

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const RoutePlan: Model<IRoutePlan> =
    mongoose.models.RoutePlan ||
    mongoose.model<IRoutePlan>('RoutePlan', RoutePlanSchema, 'route_plans')

export default RoutePlan
