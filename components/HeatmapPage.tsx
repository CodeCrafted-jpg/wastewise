'use client'

import { useEffect, useState } from 'react'
import {
    MapContainer,
    TileLayer,
    Popup,
    CircleMarker,
    Tooltip,
    useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_COLORS = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#eab308',
    low: '#22c55e',
} as const

const RISK_LABELS = {
    critical: 'CRITICAL (80+)',
    high: 'HIGH (60–79)',
    medium: 'MEDIUM (30–59)',
    low: 'LOW (<30)',
} as const

const RISK_PRIORITY = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
} as const

const RISK_RADIUS = {
    critical: 12,
    high: 10,
    medium: 8,
    low: 6,
} as const

type RiskLevel = keyof typeof RISK_COLORS

// ─── Types ────────────────────────────────────────────────────────────────────

interface BinData {
    id: string
    lat: number
    lng: number
    riskLevel: RiskLevel
    overflowScore: number
    stats: {
        reportsLast48Hours: number
        avgSeverity: number
        daysSinceLastCleanup: number
    }
    lastPredictedAt: string
}

interface Summary {
    critical: number
    high: number
    medium: number
    low: number
}

interface ApiResponse {
    success: boolean
    bins?: BinData[]
    count?: number
    summary?: Summary
    // error responses may carry a message under different keys
    message?: string
    error?: string
}

// ─── Default / fallback values ────────────────────────────────────────────────

const DEFAULT_SUMMARY: Summary = { critical: 0, high: 0, medium: 0, low: 0 }

// ─── Legend (proper hook-based approach) ─────────────────────────────────────

function LegendControl() {
    const map = useMap()

    useEffect(() => {
        const legend = L.control({ position: 'bottomright' })

        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'risk-legend')
            Object.assign(div.style, {
                backgroundColor: 'white',
                padding: '12px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                fontSize: '12px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.6',
                minWidth: '160px',
            })

            const title = document.createElement('div')
            title.style.fontWeight = 'bold'
            title.style.marginBottom = '8px'
            title.textContent = 'Risk Levels'
            div.appendChild(title)

            Object.entries(RISK_COLORS).forEach(([risk, color]) => {
                const item = document.createElement('div')
                Object.assign(item.style, { display: 'flex', alignItems: 'center', marginBottom: '6px' })

                const swatch = document.createElement('div')
                Object.assign(swatch.style, {
                    width: '14px', height: '14px',
                    backgroundColor: color,
                    marginRight: '8px',
                    borderRadius: '3px',
                    flexShrink: '0',
                })

                const label = document.createElement('span')
                label.textContent = RISK_LABELS[risk as RiskLevel]
                label.style.color = '#333'

                item.appendChild(swatch)
                item.appendChild(label)
                div.appendChild(item)
            })

            return div
        }

        legend.addTo(map)
        return () => { legend.remove() }
    }, [map])

    return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString()
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HeatmapPage() {
    const [bins, setBins] = useState<BinData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [summary, setSummary] = useState<Summary>(DEFAULT_SUMMARY)

    const mapCenter: [number, number] = [22.5726, 88.3639]
    const mapZoom = 12

    useEffect(() => {
        const fetchPredictions = async () => {
            try {
                setLoading(true)
                const response = await fetch('/api/predictions/public')

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status} ${response.statusText}`)
                }

                const data: ApiResponse = await response.json()

                if (!data.success) {
                    // Safely read whichever error field the API sends
                    throw new Error(data.message ?? data.error ?? 'Failed to fetch predictions')
                }

                const sortedBins = (data.bins ?? []).sort(
                    (a, b) => RISK_PRIORITY[a.riskLevel] - RISK_PRIORITY[b.riskLevel]
                )

                setBins(sortedBins)
                // Guard: only use summary if it's a real object
                setSummary(data.summary ?? DEFAULT_SUMMARY)
                setError(null)
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to load predictions'
                console.error('Error fetching predictions:', err)
                setError(message)
            } finally {
                setLoading(false)
            }
        }

        fetchPredictions()
    }, [])

    // ── Loading ──
    if (loading) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Loading waste predictions...</p>
                </div>
            </div>
        )
    }

    // ── Error ──
    if (error) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md">
                    <svg className="mx-auto h-12 w-12 text-red-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Predictions</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        )
    }

    // ── Page ──
    return (
        <div className="w-full h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">Waste Overflow Predictions</h1>
                    <p className="text-gray-600 text-sm mb-3">
                        Real-time visualization of waste bin overflow risk across the city
                    </p>

                    <div className="grid grid-cols-4 gap-4 mt-4">
                        {(
                            [
                                { key: 'critical', bg: 'bg-red-50', border: 'border-red-600', text: 'text-red-700', val: 'text-red-600' },
                                { key: 'high',     bg: 'bg-orange-50', border: 'border-orange-600', text: 'text-orange-700', val: 'text-orange-600' },
                                { key: 'medium',   bg: 'bg-yellow-50', border: 'border-yellow-600', text: 'text-yellow-700', val: 'text-yellow-600' },
                                { key: 'low',      bg: 'bg-green-50',  border: 'border-green-600',  text: 'text-green-700',  val: 'text-green-600' },
                            ] as const
                        ).map(({ key, bg, border, text, val }) => (
                            <div key={key} className={`${bg} rounded-lg p-3 border-l-4 ${border}`}>
                                <p className={`text-xs font-semibold ${text} uppercase`}>{key}</p>
                                <p className={`text-2xl font-bold ${val}`}>{summary[key]}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
                {bins.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                            <p className="text-gray-600 font-medium">No predictions available</p>
                            <p className="text-gray-500 text-sm">Run prediction engine to generate waste overflow predictions</p>
                        </div>
                    </div>
                ) : (
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <LegendControl />

                        {bins.map((bin) => {
                            const color = RISK_COLORS[bin.riskLevel]
                            const radius = RISK_RADIUS[bin.riskLevel]

                            return (
                                <CircleMarker
                                    key={bin.id}
                                    center={[bin.lat, bin.lng]}
                                    radius={radius}
                                    fillColor={color}
                                    color={color}
                                    weight={2}
                                    opacity={0.8}
                                    fillOpacity={0.7}
                                >
                                    <Popup>
                                        <div className="text-xs">
                                            <div className="font-bold mb-2 flex items-center gap-2">
                                                <span
                                                    className="inline-block w-3 h-3 rounded"
                                                    style={{ backgroundColor: color }}
                                                />
                                                <span>{bin.riskLevel.toUpperCase()}</span>
                                            </div>
                                            <div className="space-y-1 text-gray-700">
                                                <p><strong>Score:</strong> {bin.overflowScore.toFixed(1)}/100</p>
                                                <p><strong>Reports (48h):</strong> {bin.stats.reportsLast48Hours}</p>
                                                <p><strong>Avg Severity:</strong> {bin.stats.avgSeverity.toFixed(1)}</p>
                                                <p><strong>Days Uncleaned:</strong> {bin.stats.daysSinceLastCleanup.toFixed(1)}</p>
                                                <p className="text-gray-500 text-xs mt-2">
                                                    <strong>Updated:</strong> {formatDate(bin.lastPredictedAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </Popup>
                                    <Tooltip>
                                        <span className="text-xs font-semibold">
                                            {bin.riskLevel.toUpperCase()} · Score {bin.overflowScore.toFixed(1)}
                                        </span>
                                    </Tooltip>
                                </CircleMarker>
                            )
                        })}
                    </MapContainer>
                )}
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-gray-200 p-3 text-center text-xs text-gray-500">
                Total bins: <strong>{bins.length}</strong> | Last updated: <strong>{formatDate(new Date().toISOString())}</strong>
            </div>
        </div>
    )
}