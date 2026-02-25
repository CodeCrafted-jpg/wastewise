import dbConnect from '@/lib/db';
import { BinPrediction } from '@/lib/models/BinPrediction';
import { RoutePlan } from '@/lib/models/RoutePlan';
import { CleanupLog } from '@/lib/models/CleanupLog';
import { Alert } from '@/lib/models/Alert';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: string;
  database: {
    connected: boolean;
    latency: number;
  };
  collections: {
    binPredictions: number;
    routes: number;
    cleanupLogs: number;
    alerts: {
      total: number;
      active: number;
      critical: number;
    };
  };
  metrics: {
    activeAlerts: number;
    criticalBinsAtRisk: number;
    routesNeedingAttention: number;
  };
}

// GET /api/health - System health check (public)
export async function GET() {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime().toFixed(2) + 's',
    database: {
      connected: false,
      latency: 0,
    },
    collections: {
      binPredictions: 0,
      routes: 0,
      cleanupLogs: 0,
      alerts: {
        total: 0,
        active: 0,
        critical: 0,
      },
    },
    metrics: {
      activeAlerts: 0,
      criticalBinsAtRisk: 0,
      routesNeedingAttention: 0,
    },
  };

  try {
    // Test database connection
    const dbStartTime = Date.now();
    await dbConnect();
    health.database.connected = true;
    health.database.latency = Date.now() - dbStartTime;

    // Get collection stats
    const [binCount, routeCount, cleanupCount, alertCount, activeAlerts, criticalAlerts, criticalBins, incompleteRoutes] =
      await Promise.all([
        BinPrediction.countDocuments(),
        RoutePlan.countDocuments(),
        CleanupLog.countDocuments(),
        Alert.countDocuments(),
        Alert.countDocuments({ status: 'active' }),
        Alert.countDocuments({ status: 'active', severity: 'critical' }),
        BinPrediction.countDocuments({ riskLevel: 'critical', lastCleanedAt: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) } }),
        RoutePlan.countDocuments({ status: 'active', generatedAt: { $lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } }),
      ]);

    health.collections.binPredictions = binCount;
    health.collections.routes = routeCount;
    health.collections.cleanupLogs = cleanupCount;
    health.collections.alerts.total = alertCount;
    health.collections.alerts.active = activeAlerts;
    health.collections.alerts.critical = criticalAlerts;
    health.metrics.activeAlerts = activeAlerts;
    health.metrics.criticalBinsAtRisk = criticalBins;
    health.metrics.routesNeedingAttention = incompleteRoutes;

    // Determine health status
    if (health.metrics.activeAlerts > 10 || health.metrics.criticalBinsAtRisk > 5) {
      health.status = 'degraded';
    }
    if (!health.database.connected) {
      health.status = 'unhealthy';
    }
  } catch (error) {
    health.status = 'unhealthy';
    health.database.connected = false;
    console.error('Health check error:', error);
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;

  return Response.json(health, { status: statusCode });
}
