import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { AlertsDashboard } from '@/components/AlertsDashboard';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Alerts & SLA Dashboard - WasteWise Admin',
  description: 'Monitor SLA violations, bin cleanups, and operational metrics',
};

// Explicit type for what .lean() actually returns from your User model
interface LeanUser {
  _id: unknown;
  clerkUserId: string;
  role?: string;
  email?: string;
  name?: string;
}

export default async function AlertsAdminPage() {
  const session = await auth();

  if (!session.userId) {
    redirect('/sign-in');
  }

  await dbConnect();

  // Cast lean() result so TypeScript knows the shape —
  // lean() returns a plain object (or null), never a Mongoose Document
  const user = await User.findOne({ clerkUserId: session.userId })
    .lean<LeanUser>()
    .exec();

  // ── Debug: log what we actually got back ────────────────────────────────
  // Remove these console.logs once the issue is confirmed fixed
  console.log('[AlertsAdminPage] session.userId:', session.userId);
  console.log('[AlertsAdminPage] user from DB:', user);
  console.log('[AlertsAdminPage] user.role:', user?.role);
  // ────────────────────────────────────────────────────────────────────────

  if (!user) {
    // User is authenticated with Clerk but has no DB record yet.
    // This commonly happens if the post-sign-up webhook hasn't fired.
    console.error('[AlertsAdminPage] No DB user found for clerkUserId:', session.userId);
    redirect('/sign-in?error=no_user_record');
  }

  const ADMIN_ROLES = ['admin', 'super_admin'];

  if (!user.role || !ADMIN_ROLES.includes(user.role)) {
    // Role is missing or insufficient — log before redirecting so you can
    // diagnose whether this is a missing-role or wrong-role problem
    console.warn(
      '[AlertsAdminPage] Access denied. clerkUserId:',
      session.userId,
      '| role in DB:',
      user.role ?? '(undefined — field not set)'
    );
    redirect('/dashboard?error=insufficient_role');
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <div className="flex-1 max-w-7xl mx-auto w-full p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <AlertsDashboard />
        </div>
      </div>

      <Footer />
    </main>
  );
}