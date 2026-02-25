'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react'

interface AnalyticsData {
    overview?: {
        totalReports: number
        totalReportsLast7d: number
        totalReportsLast30d: number
        averageOverflowScore: number
        criticalBinCount: number
        highBinCount: number
        mediumBinCount: number
        lowBinCount: number
    }
    routes?: {
        totalRoutesGenerated: number
        totalRoutesCompleted: number
        completionRate: number
        averageEstimatedDistance: number
        averagePlannedBins: number
        averageActualBinsVisited: number
        averageRiskReduction: number
        averageCompletionTime: number
    }
    predictions?: {
        totalBinsPredicted: number
        criticalAccuracy: number
        highAccuracy: number
        falsePositiveRate: number
        averagePredictionLifespan: number
        escalationRate: number
    }
    officers?: Array<{
        officerId: string
        completedRoutes: number
        totalBinsCleaned: number
        efficiency: number
        averageCompletionTime: number
    }>
    systemHealthScore?: number
}

interface MetricCardProps {
    title: string
    value: string | number
    unit?: string
    trend?: 'up' | 'down' | 'neutral'
    icon?: 'trending-up' | 'trending-down' | 'alert' | 'check'
}

function MetricCard({ title, value, unit = '', trend, icon }: MetricCardProps) {
    let bgColor = 'bg-blue-50 border-blue-200'
    let textColor = 'text-blue-900'
    let iconComponent = null

    if (icon === 'alert') {
        bgColor = 'bg-red-50 border-red-200'
        textColor = 'text-red-900'
        iconComponent = <AlertCircle size={20} className="text-red-600" />
    } else if (icon === 'check') {
        bgColor = 'bg-green-50 border-green-200'
        textColor = 'text-green-900'
        iconComponent = <CheckCircle size={20} className="text-green-600" />
    } else if (trend === 'up') {
        bgColor = 'bg-green-50 border-green-200'
        textColor = 'text-green-900'
        iconComponent = <TrendingUp size={20} className="text-green-600" />
    } else if (trend === 'down') {
        bgColor = 'bg-red-50 border-red-200'
        textColor = 'text-red-900'
        iconComponent = <TrendingDown size={20} className="text-red-600" />
    }

    return (
        <div className={`${bgColor} border-2 rounded-lg p-4 ${textColor}`}>
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-sm font-medium opacity-75">{title}</div>
                    <div className="text-3xl font-bold mt-2">
                        {value}
                        {unit && <span className="text-lg ml-1">{unit}</span>}
                    </div>
                </div>
                {iconComponent && <div>{iconComponent}</div>}
            </div>
        </div>
    )
}

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData>({})
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadAnalytics()
    }, [])

    const loadAnalytics = async () => {
        try {
            setIsLoading(true)
            setError(null)

            // Load all analytics in parallel
            const [overviewRes, routesRes, predictionsRes, officersRes] = await Promise.all([
                fetch('/api/analytics/overview'),
                fetch('/api/analytics/routes'),
                fetch('/api/analytics/predictions'),
                fetch('/api/analytics/officers'),
            ])

            if (!overviewRes.ok || !routesRes.ok || !predictionsRes.ok || !officersRes.ok) {
                throw new Error('Failed to load analytics data')
            }

            const overviewData = await overviewRes.json()
            const routesData = await routesRes.json()
            const predictionsData = await predictionsRes.json()
            const officersData = await officersRes.json()

            setData({
                overview: overviewData.overview,
                routes: routesData.routes,
                predictions: predictionsData.predictions,
                officers: officersData.officers,
                systemHealthScore: overviewData.systemHealthScore,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center">Loading analytics...</div>
    }

    if (error) {
        return <div className="p-8 text-center text-red-600">Error: {error}</div>
    }

    return (
        <div className="space-y-8">
            {/* System Health Score */}
            <div className="bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold opacity-90">System Health Score</h2>
                        <div className="text-5xl font-bold mt-2">{data.systemHealthScore || 0}%</div>
                    </div>
                    <div className="w-32 h-32 rounded-full border-8 border-white border-opacity-20 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-3xl font-bold">{data.systemHealthScore || 0}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overview Section */}
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">📊 System Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Total Reports"
                        value={data.overview?.totalReports || 0}
                        trend="up"
                    />
                    <MetricCard
                        title="Reports (Last 7d)"
                        value={data.overview?.totalReportsLast7d || 0}
                        icon="check"
                    />
                    <MetricCard
                        title="Average Overflow Score"
                        value={data.overview?.averageOverflowScore || 0}
                    />
                    <MetricCard
                        title="CRITICAL Bins"
                        value={data.overview?.criticalBinCount || 0}
                        icon={
                            (data.overview?.criticalBinCount || 0) > 5 ? 'alert' : 'check'
                        }
                    />
                </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">🎯 Risk Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4">
                        <div className="text-3xl font-bold text-red-600">
                            {data.overview?.criticalBinCount || 0}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">CRITICAL</div>
                    </div>
                    <div className="text-center p-4">
                        <div className="text-3xl font-bold text-orange-600">
                            {data.overview?.highBinCount || 0}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">HIGH</div>
                    </div>
                    <div className="text-center p-4">
                        <div className="text-3xl font-bold text-yellow-600">
                            {data.overview?.mediumBinCount || 0}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">MEDIUM</div>
                    </div>
                    <div className="text-center p-4">
                        <div className="text-3xl font-bold text-green-600">
                            {data.overview?.lowBinCount || 0}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">LOW</div>
                    </div>
                </div>
            </div>

            {/* Route Effectiveness */}
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">🚗 Route Effectiveness</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Routes Generated"
                        value={data.routes?.totalRoutesGenerated || 0}
                    />
                    <MetricCard
                        title="Routes Completed"
                        value={data.routes?.totalRoutesCompleted || 0}
                        icon="check"
                    />
                    <MetricCard
                        title="Completion Rate"
                        value={data.routes?.completionRate || 0}
                        unit="%"
                    />
                    <MetricCard
                        title="Avg Risk Reduction"
                        value={data.routes?.averageRiskReduction || 0}
                    />
                </div>
            </div>

            {/* Prediction Accuracy */}
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">🎯 Prediction Accuracy</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <MetricCard
                        title="CRITICAL Accuracy"
                        value={data.predictions?.criticalAccuracy || 0}
                        unit="%"
                    />
                    <MetricCard
                        title="HIGH Accuracy"
                        value={data.predictions?.highAccuracy || 0}
                        unit="%"
                    />
                    <MetricCard
                        title="False Positive Rate"
                        value={data.predictions?.falsePositiveRate || 0}
                        unit="%"
                        icon="alert"
                    />
                </div>
            </div>

            {/* Officer Performance */}
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">👥 Top Officers</h3>
                {data.officers && data.officers.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2 border-gray-200">
                                    <th className="text-left py-2 px-4">Officer</th>
                                    <th className="text-right py-2 px-4">Routes</th>
                                    <th className="text-right py-2 px-4">Bins Cleaned</th>
                                    <th className="text-right py-2 px-4">Efficiency</th>
                                    <th className="text-right py-2 px-4">Avg Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.officers.map((officer, idx) => (
                                    <tr
                                        key={officer.officerId}
                                        className="border-b border-gray-100 hover:bg-gray-50"
                                    >
                                        <td className="py-3 px-4 font-medium">#{idx + 1}</td>
                                        <td className="py-3 px-4 text-right">
                                            {officer.completedRoutes}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {officer.totalBinsCleaned}
                                        </td>
                                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                                            {officer.efficiency} bins/hr
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {officer.averageCompletionTime} min
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-600">No officer data available</div>
                )}
            </div>

            {/* Refresh Button */}
            <div className="flex justify-center">
                <button
                    onClick={loadAnalytics}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                    🔄 Refresh Analytics
                </button>
            </div>
        </div>
    )
}
