'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle, Loader, Lock } from 'lucide-react'

interface CleanupActionProps {
    /** Bin location - latitude */
    lat: number
    /** Bin location - longitude */
    lng: number
    /** Bin prediction ID from database */
    binPredictionId: string
    /** Current user role (admin, municipal_officer, citizen, etc) */
    userRole?: string
    /** Callback when cleanup is successful */
    onCleanupSuccess?: (data: any) => void
    /** Callback when cleanup fails */
    onCleanupError?: (error: string) => void
}

export default function CleanupAction({
    lat,
    lng,
    binPredictionId,
    userRole = 'citizen',
    onCleanupSuccess,
    onCleanupError,
}: CleanupActionProps) {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notes, setNotes] = useState('')
    const [showForm, setShowForm] = useState(false)

    // Check if user has permission to log cleanup
    const canCleanup = ['municipal_officer', 'admin', 'super_admin'].includes(userRole)

    const handleCleanup = async () => {
        if (!canCleanup) {
            const msg = 'Only municipal officers and admins can log cleanup'
            setError(msg)
            onCleanupError?.(msg)
            return
        }

        try {
            setLoading(true)
            setError(null)

            const response = await fetch('/api/predictions/clean', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat,
                    lng,
                    binPredictionId,
                    notes: notes.trim(),
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to log cleanup')
            }

            setSuccess(true)
            setNotes('')
            setShowForm(false)
            onCleanupSuccess?.(data)

            // Auto-hide success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000)
        } catch (err: any) {
            const msg = err.message || 'Failed to log cleanup. Please try again.'
            setError(msg)
            onCleanupError?.(msg)
        } finally {
            setLoading(false)
        }
    }

    if (!canCleanup) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 text-gray-600">
                    <Lock size={18} className="text-gray-400" />
                    <span className="text-sm font-medium">Cleanup logging restricted to municipal officers</span>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 text-green-700">
                    <CheckCircle size={18} />
                    <span className="text-sm font-medium">Cleanup logged successfully! Scores will update on next prediction run.</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {!showForm ? (
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full bg-brand-green text-white py-2 px-3 rounded-lg font-medium hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                >
                    <CheckCircle size={16} />
                    Log Cleanup
                </button>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Log Cleanup Action</h3>

                    {/* Notes Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g., 'Cleaned manually, disposed of waste', 'Scheduled for pickup'"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green resize-none"
                            rows={3}
                            disabled={loading}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleCleanup}
                            disabled={loading}
                            className="flex-1 bg-brand-green text-white py-2 px-3 rounded-lg font-medium hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader size={16} className="animate-spin" />
                                    Logging...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Confirm Cleanup
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setShowForm(false)
                                setError(null)
                                setNotes('')
                            }}
                            disabled={loading}
                            className="flex-1 bg-gray-200 text-gray-900 py-2 px-3 rounded-lg font-medium hover:bg-gray-300 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Info Text */}
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        This action will reset the cleanup counter for this location. Scores will be recalculated on the next prediction run.
                    </p>
                </div>
            )}
        </div>
    )
}
