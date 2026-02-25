'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const RISK_COLORS = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#eab308',
    low: '#22c55e',
}

interface RouteStop {
    binPredictionId: string
    lat: number
    lng: number
    riskLevel: 'critical' | 'high' | 'medium' | 'low'
    overflowScore: number
    binRef: string
}

interface RouteVisualizationProps {
    routePlanId: string
    routeOrder: RouteStop[]
    totalBins: number
    estimatedDistanceKm: number
    estimatedDurationMins: number
    status: 'active' | 'completed'
    onMarkCompleted?: (routePlanId: string) => void
}

export default function RouteVisualization({
    routePlanId,
    routeOrder,
    totalBins,
    estimatedDistanceKm,
    estimatedDurationMins,
    status,
    onMarkCompleted,
}: RouteVisualizationProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Generate polyline coordinates (in reverse for Leaflet)
    const polylineCoords = routeOrder.map(stop => [stop.lat, stop.lng] as [number, number])

    // Calculate bounds for map
    const bounds =
        routeOrder.length > 0
            ? L.latLngBounds(
                  routeOrder.map(stop => [stop.lat, stop.lng] as [number, number])
              )
            : null

    const handleMarkCompleted = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const res = await fetch(`/api/routes/${routePlanId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to mark route completed')
            }

            setSuccess(true)
            onMarkCompleted?.(routePlanId)

            // Hide success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-600">Distance</div>
                    <div className="text-2xl font-bold text-blue-600">{estimatedDistanceKm} km</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-600">Estimated Duration</div>
                    <div className="text-2xl font-bold text-green-600">
                        {estimatedDurationMins} mins
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-600">Bins to Clean</div>
                    <div className="text-2xl font-bold text-purple-600">{totalBins}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-600">Route Status</div>
                    <div className={`text-2xl font-bold ${status === 'active' ? 'text-yellow-600' : 'text-green-600'}`}>
                        {status === 'active' ? 'Active' : 'Completed'}
                    </div>
                </div>
            </div>

            {/* Map */}
            {routeOrder.length > 0 && (
                <div className="h-96 rounded-lg overflow-hidden shadow border border-gray-200">
                    <MapContainer
                        center={[routeOrder[0].lat, routeOrder[0].lng]}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        bounds={bounds}
                        boundsOptions={{ padding: [50, 50] }}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap contributors'
                        />

                        {/* Polyline connecting all stops */}
                        <Polyline positions={polylineCoords} color="#007a33" weight={3} opacity={0.7} />

                        {/* Markers for each stop */}
                        {routeOrder.map((stop, idx) => (
                            <CircleMarker
                                key={stop.binPredictionId}
                                center={[stop.lat, stop.lng]}
                                radius={8}
                                fillColor={RISK_COLORS[stop.riskLevel]}
                                color="#fff"
                                weight={2}
                                opacity={1}
                                fillOpacity={0.8}
                            >
                                <Tooltip>
                                    <div className="text-sm">
                                        <div className="font-bold">Stop {idx + 1}</div>
                                        <div>{stop.binRef}</div>
                                        <div>Score: {stop.overflowScore.toFixed(1)}</div>
                                    </div>
                                </Tooltip>
                                <Popup>
                                    <div className="text-xs">
                                        <div className="font-bold mb-1">Stop {idx + 1} of {totalBins}</div>
                                        <div>Risk Level: {stop.riskLevel.toUpperCase()}</div>
                                        <div>Score: {stop.overflowScore.toFixed(1)}</div>
                                        <div>Lat: {stop.lat.toFixed(4)}</div>
                                        <div>Lng: {stop.lng.toFixed(4)}</div>
                                        <div className="text-gray-600 text-xs mt-1">ID: {stop.binPredictionId}</div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        ))}

                        {/* Start marker */}
                        <CircleMarker
                            center={[routeOrder[0].lat, routeOrder[0].lng]}
                            radius={12}
                            fillColor="#007a33"
                            color="#fff"
                            weight={3}
                            opacity={1}
                            fillOpacity={1}
                        >
                            <Tooltip>START</Tooltip>
                        </CircleMarker>
                    </MapContainer>
                </div>
            )}

            {/* Ordered bin list */}
            <div className="bg-white rounded-lg shadow">
                <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800">Cleanup Route Order</h3>
                </div>
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {routeOrder.map((stop, idx) => (
                        <div key={stop.binPredictionId} className="px-4 py-3 hover:bg-gray-50 flex items-center space-x-3">
                            <div className="shrink-0">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                    style={{ backgroundColor: RISK_COLORS[stop.riskLevel] }}
                                >
                                    {idx + 1}
                                </div>
                            </div>
                            <div className="grow">
                                <div className="font-semibold text-gray-800">{stop.binRef}</div>
                                <div className="text-xs text-gray-600">
                                    Lat: {stop.lat.toFixed(4)}, Lng: {stop.lng.toFixed(4)}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`inline-block px-2 py-1 rounded text-xs font-semibold text-white`}
                                    style={{ backgroundColor: RISK_COLORS[stop.riskLevel] }}
                                >
                                    {stop.riskLevel.toUpperCase()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Action buttons */}
            {status === 'active' && (
                <div className="flex gap-2">
                    <button
                        onClick={handleMarkCompleted}
                        disabled={isLoading}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                        {isLoading ? '⏳ Marking...' : '✅ Mark Route as Completed'}
                    </button>
                </div>
            )}

            {/* Success/Error Messages */}
            {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                    ✅ Route marked as completed!
                </div>
            )}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    ❌ {error}
                </div>
            )}
        </div>
    )
}
