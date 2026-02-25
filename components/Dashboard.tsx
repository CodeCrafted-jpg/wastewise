'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Home,
  Map,
  Truck,
  BarChart3,
  AlertCircle,
  Settings,
  LogOut,
  AccessibilityIcon,
  GitBranch,
} from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  description: string;
}

const PRIVILEGED_ROLES = ['municipal_officer', 'admin', 'super_admin'];

function formatRole(role: string | undefined | null): string {
  if (!role) return 'Citizen';
  return role.replace(/_/g, ' ');
}

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You need to sign in to access the dashboard.</p>
          <Link
            href="/sign-in"
            className="inline-block bg-brand-green text-white px-8 py-3 rounded-lg hover:bg-opacity-90 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Safely derive role once — everything below uses this
  const userRole = (user.publicMetadata?.role as string | undefined) ?? 'citizen';
  const isPrivileged = PRIVILEGED_ROLES.includes(userRole);

  const publicLinks: NavLink[] = [
    {
      href: '/',
      label: 'Home',
      icon: <Home size={24} />,
      description: 'Back to main landing page',
    },
    {
      href: '/heatmap',
      label: 'Live Heatmap',
      icon: <Map size={24} />,
      description: 'View waste overflow predictions in real-time',
    },
    {
      href: '/sign-in',
      label: 'Sign In',
      icon: <AccessibilityIcon size={24} />,
      description: 'Sign in to your account',
    },
  ];

  const officerLinks: NavLink[] = [
    {
      href: '/officer/routes',
      label: 'Route Planning',
      icon: <Truck size={24} />,
      roles: ['municipal_officer', 'admin', 'super_admin'],
      description: 'Generate and track cleanup routes',
    },
  ];

  const adminLinks: NavLink[] = [
    {
      href: '/admin/analytics',
      label: 'Analytics Dashboard',
      icon: <BarChart3 size={24} />,
      roles: ['admin', 'super_admin'],
      description: 'Executive intelligence and system metrics',
    },
    {
      href: '/admin/alerts',
      label: 'SLA & Alerts',
      icon: <AlertCircle size={24} />,
      roles: ['admin', 'super_admin'],
      description: 'Monitor SLA violations and escalations',
    },
  ];

  const systemLinks: NavLink[] = [
    {
      href: '/api/health',
      label: 'System Health',
      icon: <GitBranch size={24} />,
      description: 'Check system status and metrics',
    },
  ];

  const renderLinkSection = (title: string, links: NavLink[]) => {
    const filteredLinks = links.filter(
      (link) => !link.roles || link.roles.includes(userRole)
    );
    if (filteredLinks.length === 0) return null;

    return (
      <div key={title}>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-1 h-6 bg-brand-green rounded" />
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {filteredLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.href.startsWith('/api') ? '_blank' : undefined}
              className="group block p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-brand-green hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="text-brand-green group-hover:scale-110 transition-transform">
                  {link.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 group-hover:text-brand-green transition-colors">
                    {link.label}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{link.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-brand-green flex items-center justify-center rounded-sm">
              <div className="w-6 h-6 border-2 border-brand-lime rotate-45" />
            </div>
            <span className="text-2xl font-serif font-bold text-brand-dark">WasteWise</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-600">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome back, {user.firstName}! 👋
          </h1>
          <p className="text-gray-600">
            Your role:{' '}
            <span className="font-semibold text-brand-green capitalize">
              {formatRole(userRole)}
            </span>
          </p>
        </div>

        {/* Quick Stats — only for privileged roles */}
        {isPrivileged && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-gray-600 text-sm font-semibold mb-2">Role</p>
              <p className="text-2xl font-bold text-brand-green capitalize">
                {formatRole(userRole)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-gray-600 text-sm font-semibold mb-2">User ID</p>
              <p className="text-sm font-mono text-gray-700 truncate">{user.id}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-gray-600 text-sm font-semibold mb-2">Account Status</p>
              <p className="text-lg font-bold text-emerald-600">Active</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-gray-600 text-sm font-semibold mb-2">Last Updated</p>
              <p className="text-sm text-gray-700">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="space-y-12">
          {renderLinkSection('🌍 Public Pages', publicLinks)}
          {isPrivileged && renderLinkSection('🚚 Operations', officerLinks)}
          {renderLinkSection('📊 Administration', adminLinks)}
          {renderLinkSection('🔧 System', systemLinks)}
        </div>

        {/* Profile Card */}
        <div className="mt-16 bg-white border-2 border-brand-green rounded-xl p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Your Profile</h2>
              <p className="text-gray-600">Manage your account settings and preferences</p>
            </div>
            <Settings className="text-brand-green" size={32} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600">Full Name</label>
              <p className="text-lg text-gray-900">{user.fullName || 'Not set'}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600">Primary Email</label>
              <p className="text-lg text-gray-900">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600">Phone Number</label>
              <p className="text-lg text-gray-900">
                {user.phoneNumbers?.[0]?.phoneNumber || 'Not set'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600">Account Created</label>
              <p className="text-lg text-gray-900">
                {user.createdAt?.toLocaleDateString() || 'Unknown'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600">Last Sign In</label>
              <p className="text-lg text-gray-900">
                {user.lastSignInAt?.toLocaleDateString() || 'First time'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600">Status</label>
              <p className="text-lg flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-gray-900 font-semibold">Active</span>
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push('/user-profile')}
              className="flex items-center gap-2 px-6 py-3 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition font-semibold"
            >
              <Settings size={20} />
              Edit Profile
            </button>
            <button
              onClick={() => router.push('/sign-in')}
              className="flex items-center gap-2 px-6 py-3 border-2 border-slate-300 text-gray-900 rounded-lg hover:border-slate-400 transition font-semibold"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center text-gray-600">
          <p className="mb-2">WasteWise Intelligence Platform v1.0</p>
          <p className="text-sm">
            B.L.A.S.T. Architecture • Prediction • Route Optimization • Analytics • SLA Enforcement
          </p>
        </div>
      </main>
    </div>
  );
}