import mongoose, { Schema, Document, Model } from 'mongoose'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
    | 'mark_cleaned'
    | 'adjust_threshold'
    | 'assign_role'
    | 'award_points'
    | 'user_created'      // auto-provisioned via webhook or requireAuth
    | 'user_updated'      // synced via webhook
    | 'emergency_action'
    | 'prediction_run'    // deterministic prediction engine execution
    | 'sla_violation_12h'
    | 'sla_escalation_24h'
    | 'sla_violation_24h_high'
    | 'sla_escalation_48h_high'
    | 'route_sla_violation_6h'
    | 'route_sla_escalation_12h'
    | 'officer_efficiency_drop'
    | 'sla_monitoring_complete'
    | 'sla_monitoring_error'
    | 'alert_resolved'

export interface IAuditLog extends Document {
    action: AuditAction
    actorClerkUserId: string
    actorRole: string
    target: {
        type: string
        id: string
    }
    payload: Record<string, unknown>
    previousValue: Record<string, unknown>
    timestamp: Date
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AuditLogSchema = new Schema<IAuditLog>(
    {
        action: {
            type: String,
            enum: [
                'mark_cleaned',
                'adjust_threshold',
                'assign_role',
                'award_points',
                'user_created',
                'user_updated',
                'emergency_action',
                'prediction_run',
                'sla_violation_12h',
                'sla_escalation_24h',
                'sla_violation_24h_high',
                'sla_escalation_48h_high',
                'route_sla_violation_6h',
                'route_sla_escalation_12h',
                'officer_efficiency_drop',
                'sla_monitoring_complete',
                'sla_monitoring_error',
                'alert_resolved',
            ],
            required: true,
        },
        actorClerkUserId: { type: String, required: true },
        actorRole: { type: String, default: 'system' },
        target: {
            type: { type: String, default: '' },
            id: { type: String, default: '' },
        },
        payload: { type: Schema.Types.Mixed, default: {} },
        previousValue: { type: Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now, index: true },
    },
    {
        timestamps: false,
    }
)

// Compound index for querying actor audit trails
AuditLogSchema.index({ actorClerkUserId: 1, timestamp: -1 })

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const AuditLog: Model<IAuditLog> =
    mongoose.models.AuditLog ||
    mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)

export default AuditLog
