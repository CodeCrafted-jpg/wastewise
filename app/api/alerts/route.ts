import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import { Alert } from '@/lib/models/Alert';
import AuditLog from '@/lib/models/AuditLog';
import User from '@/lib/models/User';
import BinPrediction from '@/lib/models/BinPrediction';
import RoutePlan from '@/lib/models/RoutePlan';

export const dynamic = 'force-dynamic';

// GET /api/alerts - List active alerts (admin+ only)
export async function GET(req: Request) {
  try {
    await auth.protect();
    const session = await auth();

    if (!session.userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify role is admin or super_admin
    const user = await User.findOne({ clerkUserId: session.userId }).lean();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json(
        { error: 'Forbidden: admin+ required' },
        { status: 403 }
      );
    }

    await dbConnect();

    // Get all active alerts, sorted by severity and date
    const alerts = await Alert.find({
      status: { $in: ['active', 'acknowledged'] },
    })
      .sort({ severity: -1, triggeredAt: -1 })
      .limit(100)
      .lean();

    // Enrich with related data
    const enrichedAlerts = await Promise.all(
      alerts.map(async (alert: any) => {
        let enrichment: any = {};

        if (alert.binPredictionId) {
          const bin = await BinPrediction.findById(alert.binPredictionId)
            .select('location riskLevel overflowScore')
            .lean();
          enrichment.bin = bin;
        }

        if (alert.routePlanId) {
          const route = await RoutePlan.findById(alert.routePlanId)
            .select('status estimatedDistanceKm binsIncluded generatedAt')
            .lean();
          enrichment.route = route;
        }

        if (alert.officerId) {
          const officer = await User.findOne({ clerkUserId: alert.officerId })
            .select('name email')
            .lean();
          enrichment.officer = officer;
        }

        return { ...alert, ...enrichment };
      })
    );

    return Response.json({
      success: true,
      count: enrichedAlerts.length,
      alerts: enrichedAlerts,
    });
  } catch (error) {
    console.error('GET /api/alerts error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
