import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import { Alert } from '@/lib/models/Alert';
import User from '@/lib/models/User';

export const dynamic = 'force-dynamic';

// GET /api/alerts/dashboard - Alert dashboard summary (admin+ only)
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

    const user = await User.findOne({ clerkUserId: session.userId }).lean();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json(
        { error: 'Forbidden: admin+ required' },
        { status: 403 }
      );
    }

    await dbConnect();

    // Count active alerts by type and severity
    const alertCounts = await Promise.all([
      Alert.countDocuments({ status: 'active' }),
      Alert.countDocuments({ status: 'active', severity: 'critical' }),
      Alert.countDocuments({ status: 'active', severity: 'high' }),
      Alert.countDocuments({ alertType: 'CRITICAL_NOT_CLEANED_12H', status: 'active' }),
      Alert.countDocuments({ alertType: 'CRITICAL_ESCALATION_24H', status: 'active' }),
      Alert.countDocuments({ alertType: 'ROUTE_INCOMPLETE_6H', status: 'active' }),
      Alert.countDocuments({ alertType: 'ROUTE_INCOMPLETE_12H', status: 'active' }),
    ]);

    // Get most recent critical alerts
    const recentCriticalAlerts = await Alert.find({
      severity: 'critical',
      status: 'active',
    })
      .sort({ triggeredAt: -1 })
      .limit(5)
      .lean();

    // Get alert trend (last 7 days)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const alertTrend = await Alert.aggregate([
      {
        $match: {
          triggeredAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$triggeredAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get unacknowledged alerts by officer
    const unacknowledgedByOfficer = await Alert.aggregate([
      {
        $match: {
          'escalationChain.acknowledged': false,
          officerId: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$officerId',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    return Response.json({
      success: true,
      summary: {
        totalActive: alertCounts[0],
        criticalAlerts: alertCounts[1],
        highAlerts: alertCounts[2],
        criticalBin12h: alertCounts[3],
        criticalBin24h: alertCounts[4],
        routeIncomplete6h: alertCounts[5],
        routeIncomplete12h: alertCounts[6],
      },
      recentCriticalAlerts,
      alertTrend,
      unacknowledgedByOfficer,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('GET /api/alerts/dashboard error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
