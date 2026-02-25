import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import { runSLAMonitoring } from '@/lib/slaMonitoring';
import User from '@/lib/models/User';

export const dynamic = 'force-dynamic';

// POST /api/alerts/run-monitoring - Manually trigger SLA monitoring (admin+ only)
export async function POST(req: Request) {
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

    const results = await runSLAMonitoring();

    return Response.json({
      success: true,
      monitoring: results,
      message: `SLA monitoring complete. Critical violations: ${results.criticalBinViolations}, High violations: ${results.highBinViolations}`,
    });
  } catch (error) {
    console.error('POST /api/alerts/run-monitoring error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
