import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import { resolveAlert } from '@/lib/slaMonitoring';
import { Alert } from '@/lib/models/Alert';
import User from '@/lib/models/User';

export const dynamic = 'force-dynamic';

// POST /api/alerts/[id]/resolve - Resolve an alert
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    if (!user) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is admin or officer assigned to the alert
    const alert = await Alert.findById(params.id).lean();
    if (!alert) {
      return Response.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    const isAdmin = ['admin', 'super_admin'].includes(user.role);
    const isAssignedOfficer = user.role === 'municipal_officer' && alert.officerId === session.userId;

    if (!isAdmin && !isAssignedOfficer) {
      return Response.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await dbConnect();

    const body = await req.json();
    const { resolutionNotes } = body;

    const resolved = await resolveAlert(
      params.id,
      session.userId,
      user.role,
      resolutionNotes || ''
    );

    return Response.json({
      success: true,
      alert: resolved,
    });
  } catch (error) {
    console.error('POST /api/alerts/[id]/resolve error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
