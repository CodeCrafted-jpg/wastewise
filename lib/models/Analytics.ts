import mongoose, { Schema, Model, Document } from 'mongoose'

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IAnalytics extends Document {
    generatedAt: Date // When this snapshot was created
    period: 'daily' | 'weekly' | 'monthly' // Aggregation period
    
    // System Overview
    overview: {
        totalReports: number
        totalReportsLast7d: number
        totalReportsLast30d: number
        averageOverflowScore: number
        criticalBinCount: number
        highBinCount: number
        mediumBinCount: number
        lowBinCount: number
    }
    
    // Route Effectiveness
    routes: {
        totalRoutesGenerated: number
        totalRoutesCompleted: number
        completionRate: number // percentage
        averageEstimatedDistance: number
        averageActualDistance: number
        averagePlannedBins: number
        averageActualBinsVisited: number
        averageRiskReduction: number // Avg pre-cleanup score - post-cleanup score
        averageCompletionTime: number // minutes
    }
    
    // Prediction Accuracy
    predictions: {
        totalBinsPredicted: number
        criticalAccuracy: number // Of CRITICAL predictions, how many actually required cleanup
        highAccuracy: number
        falsePositiveRate: number // Predicted HIGH/CRITICAL but stayed LOW/MEDIUM
        averagePredictionLifespan: number // days from prediction to cleanup
        escalationRate: number // MEDIUM → HIGH/CRITICAL
    }
    
    // Officer Performance (top officers)
    officerMetrics: Array<{
        officerId: string
        officerName?: string
        completedRoutes: number
        totalBinsCleaned: number
        averageRiskReduction: number
        averageCompletionTime: number
        efficiency: number // bins/hour
    }>
    
    // Trends over time
    trends: {
        criticalTrendLast7d: number[] // Daily count
        cleanupLatency: number // Average days from CRITICAL to cleanup
        systemHealthScore: number // 0-100, composite metric
    }
    
    metadata?: string // Can store any additional context
}

// ---------------------------------------------------------------------------
// Schema Definition
// ---------------------------------------------------------------------------

const AnalyticsSchema = new Schema<IAnalytics>(
    {
        generatedAt: { type: Date, default: Date.now, index: true },
        period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
        
        overview: {
            totalReports: Number,
            totalReportsLast7d: Number,
            totalReportsLast30d: Number,
            averageOverflowScore: Number,
            criticalBinCount: Number,
            highBinCount: Number,
            mediumBinCount: Number,
            lowBinCount: Number,
        },
        
        routes: {
            totalRoutesGenerated: Number,
            totalRoutesCompleted: Number,
            completionRate: Number,
            averageEstimatedDistance: Number,
            averageActualDistance: Number,
            averagePlannedBins: Number,
            averageActualBinsVisited: Number,
            averageRiskReduction: Number,
            averageCompletionTime: Number,
        },
        
        predictions: {
            totalBinsPredicted: Number,
            criticalAccuracy: Number,
            highAccuracy: Number,
            falsePositiveRate: Number,
            averagePredictionLifespan: Number,
            escalationRate: Number,
        },
        
        officerMetrics: [
            {
                officerId: String,
                officerName: String,
                completedRoutes: Number,
                totalBinsCleaned: Number,
                averageRiskReduction: Number,
                averageCompletionTime: Number,
                efficiency: Number,
            },
        ],
        
        trends: {
            criticalTrendLast7d: [Number],
            cleanupLatency: Number,
            systemHealthScore: Number,
        },
        
        metadata: String,
    },
    {
        timestamps: true,
    }
)

// Index for efficient querying
AnalyticsSchema.index({ generatedAt: -1, period: 1 })

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const Analytics: Model<IAnalytics> =
    mongoose.models.Analytics ||
    mongoose.model<IAnalytics>('Analytics', AnalyticsSchema, 'analytics')

export default Analytics
