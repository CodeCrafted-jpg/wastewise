import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IBinPrediction extends Document {
    location: {
        type: 'Point'
        coordinates: [number, number] // [lng, lat]
    }
    stats: {
        reportsLast48Hours: number
        avgSeverity: number
        daysSinceLastCleanup: number
    }
    overflowScore: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    lastPredictedAt: Date
    lastCleanedAt: Date
}

const BinPredictionSchema: Schema = new Schema({
    location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true },
    },
    stats: {
        reportsLast48Hours: { type: Number, default: 0 },
        avgSeverity: { type: Number, default: 0 },
        daysSinceLastCleanup: { type: Number, default: 0 },
    },
    overflowScore: { type: Number, default: 0 },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    lastPredictedAt: { type: Date, default: Date.now },
    lastCleanedAt: { type: Date, default: Date.now },
})

// Index for spatial grouping
BinPredictionSchema.index({ location: '2dsphere' })

const BinPrediction: Model<IBinPrediction> = mongoose.models.BinPrediction || mongoose.model<IBinPrediction>('BinPrediction', BinPredictionSchema)

export default BinPrediction
