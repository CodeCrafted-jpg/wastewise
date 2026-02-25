import mongoose from 'mongoose';
import { BinPrediction } from './models/BinPrediction';
import { RoutePlan } from './models/RoutePlan';
import { CleanupLog } from './models/CleanupLog';
import { Alert } from './models/Alert';
import { AuditLog } from './models/AuditLog';
import { User } from './models/User';

// SLA Configuration (in hours/minutes)
export const SLA_CONFIG = {
  CRITICAL_CLEANUP_SLA_HOURS: 12,
  CRITICAL_ESCALATION_HOURS: 24,
  HIGH_CLEANUP_SLA_HOURS: 24,
  HIGH_ESCALATION_HOURS: 48,
  ROUTE_COMPLETION_SLA_MINUTES: 360, // 6 hours
  ROUTE_ESCALATION_MINUTES: 720, // 12 hours
  OFFICER_EFFICIENCY_WARNING_THRESHOLD: 2.0, // bins/hour
};

/**
 * Check for CRITICAL bins that haven't been cleaned within SLA
 */
export async function checkCriticalBinSLAViolations() {
  const now = new Date();
  const criticalCleanupDeadline = new Date(
    now.getTime() - SLA_CONFIG.CRITICAL_CLEANUP_SLA_HOURS * 60 * 60 * 1000
  );
  const criticalEscalationDeadline = new Date(
    now.getTime() - SLA_CONFIG.CRITICAL_ESCALATION_HOURS * 60 * 60 * 1000
  );

  // Find CRITICAL bins predicted but not yet cleaned
  const criticalBins = await BinPrediction.find({
    riskLevel: 'critical',
    lastCleanedAt: { $lt: criticalCleanupDeadline },
  }).lean();

  const violations = [];

  for (const bin of criticalBins) {
    const hoursExceeded = (now.getTime() - (bin.lastCleanedAt as any).getTime()) / (1000 * 60 * 60);

    // Check if escalation-level alert already exists
    const existingEscalation = await Alert.findOne({
      binPredictionId: bin._id,
      alertType: 'CRITICAL_ESCALATION_24H',
      status: 'active',
    });

    if (existingEscalation && (bin.lastCleanedAt as any) < criticalEscalationDeadline) {
      // Already escalated, no new alert needed
      continue;
    }

    // Check if 12h warning already exists
    const existing12h = await Alert.findOne({
      binPredictionId: bin._id,
      alertType: 'CRITICAL_NOT_CLEANED_12H',
      status: 'active',
    });

    if (!existing12h) {
      // Create 12-hour warning alert
      const alert = new Alert({
        alertType: 'CRITICAL_NOT_CLEANED_12H',
        severity: 'high',
        binPredictionId: bin._id,
        triggeredAt: now,
        triggerData: {
          hoursExceeded: Math.round(hoursExceeded * 10) / 10,
          riskLevel: bin.riskLevel,
          lastPredictedScore: bin.overflowScore,
        },
        escalationChain: [
          {
            notifiedRole: 'municipal_officer',
            notifiedAt: now,
            acknowledged: false,
          },
        ],
        status: 'active',
      });
      await alert.save();
      violations.push(alert);

      // Log to audit
      await AuditLog.create({
        action: 'sla_violation_12h',
        actorClerkUserId: 'system',
        actorRole: 'system',
        target: { type: 'BinPrediction', id: bin._id.toString() },
        payload: {
          alertId: alert._id,
          hoursExceeded,
          riskLevel: bin.riskLevel,
        },
        timestamp: now,
      });
    }

    // Check for 24-hour escalation
    if ((bin.lastCleanedAt as any) < criticalEscalationDeadline && !existingEscalation) {
      const alert = new Alert({
        alertType: 'CRITICAL_ESCALATION_24H',
        severity: 'critical',
        binPredictionId: bin._id,
        triggeredAt: now,
        triggerData: {
          hoursExceeded: Math.round(hoursExceeded * 10) / 10,
          riskLevel: bin.riskLevel,
          lastPredictedScore: bin.overflowScore,
        },
        escalationChain: [
          {
            notifiedRole: 'municipal_officer',
            notifiedAt: now,
            acknowledged: false,
          },
          {
            notifiedRole: 'admin',
            notifiedAt: now,
            acknowledged: false,
          },
        ],
        status: 'active',
      });
      await alert.save();
      violations.push(alert);

      // Mark the 12h alert as resolved
      await Alert.updateOne(
        {
          binPredictionId: bin._id,
          alertType: 'CRITICAL_NOT_CLEANED_12H',
          status: 'active',
        },
        { status: 'resolved', resolvedAt: now }
      );

      // Log to audit
      await AuditLog.create({
        action: 'sla_escalation_24h',
        actorClerkUserId: 'system',
        actorRole: 'system',
        target: { type: 'BinPrediction', id: bin._id.toString() },
        payload: {
          alertId: alert._id,
          hoursExceeded,
          escalatedToAdmin: true,
        },
        timestamp: now,
      });
    }
  }

  return violations;
}

/**
 * Check for HIGH bins that haven't been cleaned within SLA
 */
export async function checkHighBinSLAViolations() {
  const now = new Date();
  const highCleanupDeadline = new Date(
    now.getTime() - SLA_CONFIG.HIGH_CLEANUP_SLA_HOURS * 60 * 60 * 1000
  );
  const highEscalationDeadline = new Date(
    now.getTime() - SLA_CONFIG.HIGH_ESCALATION_HOURS * 60 * 60 * 1000
  );

  const highBins = await BinPrediction.find({
    riskLevel: 'high',
    lastCleanedAt: { $lt: highCleanupDeadline },
  }).lean();

  const violations = [];

  for (const bin of highBins) {
    const hoursExceeded = (now.getTime() - (bin.lastCleanedAt as any).getTime()) / (1000 * 60 * 60);

    // Check if escalation alert already exists
    const existingEscalation = await Alert.findOne({
      binPredictionId: bin._id,
      alertType: 'HIGH_ESCALATION_48H',
      status: 'active',
    });

    if (existingEscalation && (bin.lastCleanedAt as any) < highEscalationDeadline) {
      continue;
    }

    // Check if 24h warning exists
    const existing24h = await Alert.findOne({
      binPredictionId: bin._id,
      alertType: 'HIGH_NOT_CLEANED_24H',
      status: 'active',
    });

    if (!existing24h) {
      const alert = new Alert({
        alertType: 'HIGH_NOT_CLEANED_24H',
        severity: 'high',
        binPredictionId: bin._id,
        triggeredAt: now,
        triggerData: {
          hoursExceeded: Math.round(hoursExceeded * 10) / 10,
          riskLevel: bin.riskLevel,
          lastPredictedScore: bin.overflowScore,
        },
        escalationChain: [
          {
            notifiedRole: 'municipal_officer',
            notifiedAt: now,
            acknowledged: false,
          },
        ],
        status: 'active',
      });
      await alert.save();
      violations.push(alert);

      await AuditLog.create({
        action: 'sla_violation_24h_high',
        actorClerkUserId: 'system',
        actorRole: 'system',
        target: { type: 'BinPrediction', id: bin._id.toString() },
        payload: { alertId: alert._id, hoursExceeded },
        timestamp: now,
      });
    }

    // Check for 48-hour escalation
    if ((bin.lastCleanedAt as any) < highEscalationDeadline && !existingEscalation) {
      const alert = new Alert({
        alertType: 'HIGH_ESCALATION_48H',
        severity: 'critical',
        binPredictionId: bin._id,
        triggeredAt: now,
        triggerData: {
          hoursExceeded: Math.round(hoursExceeded * 10) / 10,
          riskLevel: bin.riskLevel,
        },
        escalationChain: [
          {
            notifiedRole: 'municipal_officer',
            notifiedAt: now,
            acknowledged: false,
          },
          {
            notifiedRole: 'admin',
            notifiedAt: now,
            acknowledged: false,
          },
        ],
        status: 'active',
      });
      await alert.save();
      violations.push(alert);

      // Mark 24h as resolved
      await Alert.updateOne(
        {
          binPredictionId: bin._id,
          alertType: 'HIGH_NOT_CLEANED_24H',
          status: 'active',
        },
        { status: 'resolved', resolvedAt: now }
      );

      await AuditLog.create({
        action: 'sla_escalation_48h_high',
        actorClerkUserId: 'system',
        actorRole: 'system',
        target: { type: 'BinPrediction', id: bin._id.toString() },
        payload: { alertId: alert._id, escalatedToAdmin: true },
        timestamp: now,
      });
    }
  }

  return violations;
}

/**
 * Check for routes incomplete past SLA
 */
export async function checkRouteCompletionSLAViolations() {
  const now = new Date();
  const routeCompletionDeadline = new Date(
    now.getTime() - SLA_CONFIG.ROUTE_COMPLETION_SLA_MINUTES * 60 * 1000
  );
  const routeEscalationDeadline = new Date(
    now.getTime() - SLA_CONFIG.ROUTE_ESCALATION_MINUTES * 60 * 1000
  );

  const activeRoutes = await RoutePlan.find({
    status: 'active',
    generatedAt: { $lt: routeCompletionDeadline },
  }).lean();

  const violations = [];

  for (const route of activeRoutes) {
    const minutesExceeded = (now.getTime() - (route.generatedAt as any).getTime()) / (1000 * 60);

    // Check if 6h warning exists
    const existing6h = await Alert.findOne({
      routePlanId: route._id,
      alertType: 'ROUTE_INCOMPLETE_6H',
      status: 'active',
    });

    if (!existing6h) {
      const alert = new Alert({
        alertType: 'ROUTE_INCOMPLETE_6H',
        severity: 'high',
        routePlanId: route._id,
        officerId: route.generatedBy,
        triggeredAt: now,
        triggerData: {
          minutesExceeded: Math.round(minutesExceeded),
          routeStatus: route.status,
        },
        escalationChain: [
          {
            notifiedRole: 'municipal_officer',
            notifiedAt: now,
            acknowledged: false,
          },
        ],
        status: 'active',
      });
      await alert.save();
      violations.push(alert);

      await AuditLog.create({
        action: 'route_sla_violation_6h',
        actorClerkUserId: 'system',
        actorRole: 'system',
        target: { type: 'RoutePlan', id: route._id.toString() },
        payload: { alertId: alert._id, minutesExceeded, officerId: route.generatedBy },
        timestamp: now,
      });
    }

    // Check for 12h escalation
    if ((route.generatedAt as any) < routeEscalationDeadline) {
      const existing12h = await Alert.findOne({
        routePlanId: route._id,
        alertType: 'ROUTE_INCOMPLETE_12H',
        status: 'active',
      });

      if (!existing12h) {
        const alert = new Alert({
          alertType: 'ROUTE_INCOMPLETE_12H',
          severity: 'critical',
          routePlanId: route._id,
          officerId: route.generatedBy,
          triggeredAt: now,
          triggerData: {
            minutesExceeded: Math.round(minutesExceeded),
            routeStatus: route.status,
          },
          escalationChain: [
            {
              notifiedRole: 'municipal_officer',
              notifiedAt: now,
              acknowledged: false,
            },
            {
              notifiedRole: 'admin',
              notifiedAt: now,
              acknowledged: false,
            },
          ],
          status: 'active',
        });
        await alert.save();
        violations.push(alert);

        // Mark 6h as resolved
        await Alert.updateOne(
          {
            routePlanId: route._id,
            alertType: 'ROUTE_INCOMPLETE_6H',
            status: 'active',
          },
          { status: 'resolved', resolvedAt: now }
        );

        await AuditLog.create({
          action: 'route_sla_escalation_12h',
          actorClerkUserId: 'system',
          actorRole: 'system',
          target: { type: 'RoutePlan', id: route._id.toString() },
          payload: {
            alertId: alert._id,
            minutesExceeded: Math.round(minutesExceeded),
            escalatedToAdmin: true,
          },
          timestamp: now,
        });
      }
    }
  }

  return violations;
}

/**
 * Check for officer efficiency drops
 */
export async function checkOfficerEfficiencySLAViolations() {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get completed routes in last 7 days
  const officerStats = await Promise.all(
    (
      await User.find(
        { role: 'municipal_officer' },
        { clerkUserId: 1 }
      ).lean()
    ).map(async (officer: any) => {
      const completedRoutes = await RoutePlan.find({
        generatedBy: officer.clerkUserId,
        status: 'completed',
        completedAt: { $gte: last7Days },
      }).lean();

      const totalBinsVisited = completedRoutes.reduce(
        (sum: number, route: any) => sum + (route.actualBinsVisited || route.binsIncluded.length || 0),
        0
      );
      const totalHours = completedRoutes.reduce((sum: number, route: any) => {
        const duration = route.actualCompletionTime || route.estimatedDurationMins || 0;
        return sum + duration / 60;
      }, 0);

      const efficiency = totalHours > 0 ? totalBinsVisited / totalHours : 0;

      return {
        officerId: officer.clerkUserId,
        efficiency,
        totalCompletedRoutes: completedRoutes.length,
        totalBinsVisited,
      };
    })
  );

  const violations = [];

  for (const stat of officerStats) {
    if (stat.efficiency < SLA_CONFIG.OFFICER_EFFICIENCY_WARNING_THRESHOLD && stat.totalCompletedRoutes > 0) {
      // Check if alert already exists
      const existing = await Alert.findOne({
        officerId: stat.officerId,
        alertType: 'OFFICER_EFFICIENCY_DROP',
        status: 'active',
        triggeredAt: { $gte: last7Days },
      });

      if (!existing) {
        const alert = new Alert({
          alertType: 'OFFICER_EFFICIENCY_DROP',
          severity: 'high',
          officerId: stat.officerId,
          triggeredAt: now,
          triggerData: {
            efficiency: Math.round(stat.efficiency * 100) / 100,
            threshold: SLA_CONFIG.OFFICER_EFFICIENCY_WARNING_THRESHOLD,
            completedRoutes: stat.totalCompletedRoutes,
          },
          escalationChain: [
            {
              notifiedRole: 'admin',
              notifiedAt: now,
              acknowledged: false,
            },
          ],
          status: 'active',
        });
        await alert.save();
        violations.push(alert);

        await AuditLog.create({
          action: 'officer_efficiency_drop',
          actorClerkUserId: 'system',
          actorRole: 'system',
          target: { type: 'User', id: stat.officerId },
          payload: {
            alertId: alert._id,
            efficiency: stat.efficiency,
            completedRoutes: stat.totalCompletedRoutes,
          },
          timestamp: now,
        });
      }
    }
  }

  return violations;
}

/**
 * Master function to run all SLA checks
 */
export async function runSLAMonitoring() {
  const results = {
    criticalBinViolations: 0,
    highBinViolations: 0,
    routeViolations: 0,
    officerEfficiencyViolations: 0,
    timestamp: new Date(),
  };

  try {
    const criticalAlerts = await checkCriticalBinSLAViolations();
    results.criticalBinViolations = criticalAlerts.length;

    const highAlerts = await checkHighBinSLAViolations();
    results.highBinViolations = highAlerts.length;

    const routeAlerts = await checkRouteCompletionSLAViolations();
    results.routeViolations = routeAlerts.length;

    const efficiencyAlerts = await checkOfficerEfficiencySLAViolations();
    results.officerEfficiencyViolations = efficiencyAlerts.length;

    // Log SLA monitoring run
    await AuditLog.create({
      action: 'sla_monitoring_complete',
      actorClerkUserId: 'system',
      actorRole: 'system',
      target: { type: 'System', id: 'sla_monitor' },
      payload: results,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('SLA monitoring error:', error);
    await AuditLog.create({
      action: 'sla_monitoring_error',
      actorClerkUserId: 'system',
      actorRole: 'system',
      target: { type: 'System', id: 'sla_monitor' },
      payload: { error: String(error) },
      timestamp: new Date(),
    });
  }

  return results;
}

/**
 * Resolve an alert when action is taken
 */
export async function resolveAlert(
  alertId: string,
  resolverClerkUserId: string,
  resolverRole: string,
  resolutionNotes: string
) {
  const now = new Date();
  const alert = await Alert.findByIdAndUpdate(
    alertId,
    {
      status: 'resolved',
      resolvedAt: now,
      $push: {
        escalationChain: {
          notifiedRole: resolverRole,
          notifiedAt: now,
          acknowledged: true,
          acknowledgmentTime: now,
        },
      },
    },
    { new: true }
  );

  if (alert) {
    await AuditLog.create({
      action: 'alert_resolved',
      actorClerkUserId: resolverClerkUserId,
      actorRole: resolverRole,
      target: { type: 'Alert', id: alert._id.toString() },
      payload: { alertType: alert.alertType, resolutionNotes },
      timestamp: now,
    });
  }

  return alert;
}
