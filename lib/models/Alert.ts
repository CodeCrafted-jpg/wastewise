import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAlert extends Document {
  alertType: string; // CRITICAL_NOT_CLEANED_12H | CRITICAL_ESCALATION_24H | HIGH_NOT_CLEANED_24H | etc.
  severity: 'critical' | 'high' | 'info';
  binPredictionId?: mongoose.Types.ObjectId;
  routePlanId?: mongoose.Types.ObjectId;
  officerId?: string; // clerkUserId
  triggeredAt: Date;
  resolvedAt?: Date;
  triggerData: {
    hoursExceeded?: number;
    riskLevel?: string;
    lastPredictedScore?: number;
    minutesExceeded?: number;
    routeStatus?: string;
  };
  escalationChain: Array<{
    notifiedRole: string;
    notifiedAt: Date;
    acknowledged: boolean;
    acknowledgmentTime?: Date;
  }>;
  status: 'active' | 'resolved' | 'acknowledged';
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    alertType: {
      type: String,
      required: true,
      index: true,
      enum: [
        'CRITICAL_NOT_CLEANED_12H',
        'CRITICAL_ESCALATION_24H',
        'HIGH_NOT_CLEANED_24H',
        'HIGH_ESCALATION_48H',
        'ROUTE_INCOMPLETE_6H',
        'ROUTE_INCOMPLETE_12H',
        'OFFICER_EFFICIENCY_DROP',
      ],
    },
    severity: {
      type: String,
      required: true,
      enum: ['critical', 'high', 'info'],
      index: true,
    },
    binPredictionId: {
      type: Schema.Types.ObjectId,
      ref: 'BinPrediction',
      sparse: true,
      index: true,
    },
    routePlanId: {
      type: Schema.Types.ObjectId,
      ref: 'RoutePlan',
      sparse: true,
      index: true,
    },
    officerId: {
      type: String, // clerkUserId
      sparse: true,
      index: true,
    },
    triggeredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    resolvedAt: {
      type: Date,
      sparse: true,
      index: true,
    },
    triggerData: {
      hoursExceeded: Number,
      riskLevel: String,
      lastPredictedScore: Number,
      minutesExceeded: Number,
      routeStatus: String,
    },
    escalationChain: [
      {
        notifiedRole: { type: String, required: true },
        notifiedAt: { type: Date, required: true },
        acknowledged: { type: Boolean, default: false },
        acknowledgmentTime: { type: Date, sparse: true },
      },
    ],
    status: {
      type: String,
      required: true,
      enum: ['active', 'resolved', 'acknowledged'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for fast queries
alertSchema.index({ alertType: 1, status: 1, triggeredAt: -1 });
alertSchema.index({ officerId: 1, status: 1, triggeredAt: -1 });
alertSchema.index({ severity: 1, status: 1, triggeredAt: -1 });

export const Alert: Model<IAlert> =
  mongoose.models.Alert || mongoose.model<IAlert>('Alert', alertSchema);
