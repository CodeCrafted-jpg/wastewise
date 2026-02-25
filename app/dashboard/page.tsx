import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';

export const metadata = {
  title: 'Dashboard - WasteWise',
  description: 'Your WasteWise command center with links to all features',
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session.userId) {
    redirect('/sign-in');
  }

  return <Dashboard />;
}
