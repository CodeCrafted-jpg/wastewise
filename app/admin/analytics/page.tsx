import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function AdminAnalyticsPage() {
    const { userId } = await auth()

    if (!userId) {
        redirect('/sign-in')
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">📈 Command Center</h1>
                    <p className="text-gray-600">
                        Real-time system intelligence: predictions, routes, cleanup, and officer performance
                    </p>
                </div>

                {/* Analytics Dashboard */}
                <AnalyticsDashboard />

                {/* Info Footer */}
                <div className="mt-12 p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm text-gray-700">
                        <strong>Command Center Intelligence:</strong> All metrics are computed server-side from
                        historical data in real-time. No aggregation on the frontend. All calculations are
                        deterministic and reproducible. System health score combines route completion rate,
                        prediction accuracy, critical bin trends, and cleanup latency into a single health indicator.
                    </p>
                </div>
            </div>
        </div>
    )
}
