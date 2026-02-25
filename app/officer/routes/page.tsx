'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import RouteVisualization from '@/components/RouteVisualization'

interface RouteStop {
    binPredictionId: string
    lat: number
    lng: number
    riskLevel: 'critical' | 'high' | 'medium' | 'low'
    overflowScore: number
    binRef: string
}

interface RoutePlan {
    routePlanId: string
    generatedAt: string
    algorithm: string
    riskTiers: string[]
    routeOrder: RouteStop[]
    totalBins: number
    estimatedDistanceKm: number
    estimatedDurationMins: number
    status: 'active' | 'completed'
}

export default function OfficerRoutesPage() {
    const { user, isLoaded } = useUser()
    const [isGenerating, setIsGenerating] = useState(false)
    const [generationError, setGenerationError] = useState<string | null>(null)
    const [activeRoute, setActiveRoute] = useState<RoutePlan | null>(null)
    const [routeHistory, setRouteHistory] = useState<RoutePlan[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const [selectedAlgorithm, setSelectedAlgorithm] = useState('risk-segmented')
    const [excludeRecentHours, setExcludeRecentHours] = useState(24)

    useEffect(() => {
        if (isLoaded) {
            loadRouteHistory()
        }
    }, [isLoaded])

    const loadRouteHistory = async () => {
        try {
            setIsLoadingHistory(true)
            const res = await fetch('/api/routes/history')
            if (!res.ok) throw new Error('Failed to load routes')
            const data = await res.json()
            
            // Find active route
            const active = data.find((r: RoutePlan) => r.status === 'active')
            setActiveRoute(active || null)
            
            // Set history
            setRouteHistory(data)
        } catch (err) {
            console.error('Error loading routes:', err)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const handleGenerateRoute = async () => {
        setIsGenerating(true)
        setGenerationError(null)

        try {
            const res = await fetch('/api/routes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    riskTiers: ['CRITICAL', 'HIGH'],
                    algorithm: selectedAlgorithm,
                    excludeRecentlyCleanedHours: excludeRecentHours,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to generate route')
            }

            const newRoute = await res.json()
            setActiveRoute(newRoute)
            setRouteHistory([newRoute, ...routeHistory])
        } catch (err) {
            setGenerationError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleRouteCompleted = () => {
        loadRouteHistory()
    }

    if (!isLoaded) {
        return <div className="p-8 text-center">Loading...</div>
    }

    if (!user) {
        return <div className="p-8 text-center text-red-600">Please sign in to access this page</div>
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">🚗 Route Planning Center</h1>
                    <p className="text-gray-600">Optimize cleanup routes based on real-time waste predictions</p>
                </div>

                {/* Control Panel */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Generate New Route</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Algorithm
                            </label>
                            <select
                                value={selectedAlgorithm}
                                onChange={e => setSelectedAlgorithm(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="risk-segmented">Risk-Segmented (Recommended)</option>
                                <option value="nearest-neighbor">Nearest Neighbor</option>
                                <option value="risk-priority">Risk Priority Sort</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Risk-Segmented: Visits all CRITICAL first, then HIGH
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Exclude Recently Cleaned
                            </label>
                            <select
                                value={excludeRecentHours}
                                onChange={e => setExcludeRecentHours(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value={12}>Last 12 Hours</option>
                                <option value={24}>Last 24 Hours</option>
                                <option value={48}>Last 48 Hours</option>
                                <option value={0}>No Filter</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerateRoute}
                        disabled={isGenerating || activeRoute?.status === 'active'}
                        className="w-full bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 px-4 rounded-lg transition"
                    >
                        {isGenerating ? '⏳ Generating Route...' : activeRoute?.status === 'active' ? '📍 Route Already Active' : '🗺️ Generate Optimized Route'}
                    </button>

                    {generationError && (
                        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            ❌ {generationError}
                        </div>
                    )}
                </div>

                {/* Active Route */}
                {activeRoute && activeRoute.status === 'active' && (
                    <div className="bg-blue-50 rounded-lg shadow-lg p-6 mb-8 border-2 border-blue-200">
                        <div className="flex items-center mb-4">
                            <div className="text-3xl mr-3">📍</div>
                            <div>
                                <h2 className="text-2xl font-bold text-blue-900">Active Route</h2>
                                <p className="text-sm text-blue-700">
                                    Generated: {new Date(activeRoute.generatedAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <RouteVisualization
                            routePlanId={activeRoute.routePlanId}
                            routeOrder={activeRoute.routeOrder}
                            totalBins={activeRoute.totalBins}
                            estimatedDistanceKm={activeRoute.estimatedDistanceKm}
                            estimatedDurationMins={activeRoute.estimatedDurationMins}
                            status={activeRoute.status}
                            onMarkCompleted={handleRouteCompleted}
                        />
                    </div>
                )}

                {/* Route History */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Route History</h2>

                    {isLoadingHistory ? (
                        <div className="text-center py-8 text-gray-600">Loading routes...</div>
                    ) : routeHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-600">No routes generated yet</div>
                    ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {routeHistory.map(route => (
                                <div
                                    key={route.routePlanId}
                                    className={`p-4 rounded-lg border-2 ${
                                        route.status === 'active'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="font-semibold text-gray-800">
                                                {route.totalBins} bins • {route.estimatedDistanceKm}km • {route.estimatedDurationMins} mins
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1">
                                                {new Date(route.generatedAt).toLocaleString()}
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                {route.riskTiers.map(tier => (
                                                    <span
                                                        key={tier}
                                                        className="text-xs font-semibold px-2 py-1 rounded"
                                                        style={{
                                                            backgroundColor:
                                                                tier === 'CRITICAL'
                                                                    ? '#fecaca'
                                                                    : '#fed7aa',
                                                            color: 'black',
                                                        }}
                                                    >
                                                        {tier}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span
                                                className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${
                                                    route.status === 'active'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-green-600 text-white'
                                                }`}
                                            >
                                                {route.status === 'active' ? '🔵 Active' : '✅ Completed'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Algorithm Info */}
                <div className="mt-8 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm text-gray-700">
                        <strong>Algorithm Info:</strong> Routes are generated using deterministic nearest-neighbor optimization
                        to minimize travel distance while prioritizing critical overflow areas. All cleanup actions are logged
                        for compliance and accountability.
                    </p>
                </div>
            </div>
        </div>
    )
}
