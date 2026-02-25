'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
  RefreshCw,
  Flame,
} from 'lucide-react';

type Alert = {
  _id: string;
  alertType: string;
  severity: 'critical' | 'high' | 'info';
  binPredictionId?: string;
  routePlanId?: string;
  officerId?: string;
  triggeredAt: string;
  resolvedAt?: string;
  status: 'active' | 'resolved' | 'acknowledged';
  triggerData: {
    hoursExceeded?: number;
    riskLevel?: string;
    lastPredictedScore?: number;
    minutesExceeded?: number;
    efficiency?: number;
  };
  escalationChain: Array<{
    notifiedRole: string;
    notifiedAt: string;
    acknowledged: boolean;
  }>;
  bin?: { location: { coordinates: [number, number] }; riskLevel: string; overflowScore: number };
  route?: { status: string; estimatedDistanceKm: number };
  officer?: { name: string; email: string };
}

type DashboardData = {
  summary: {
    totalActive: number;
    criticalAlerts: number;
    highAlerts: number;
    criticalBin12h: number;
    criticalBin24h: number;
    routeIncomplete6h: number;
    routeIncomplete12h: number;
  };
  recentCriticalAlerts: Alert[];
  alertTrend: Array<{ _id: string; count: number }>;
  unacknowledgedByOfficer: Array<{ _id: string; count: number }>;
}

const alertTypeLabels: { [key: string]: string } = {
  CRITICAL_NOT_CLEANED_12H: '🚨 CRITICAL: Not Cleaned (12h)',
  CRITICAL_ESCALATION_24H: '🔴 CRITICAL: Escalation (24h)',
  HIGH_NOT_CLEANED_24H: '⚠️ HIGH: Not Cleaned (24h)',
  HIGH_ESCALATION_48H: '🟠 HIGH: Escalation (48h)',
  ROUTE_INCOMPLETE_6H: 'Route Incomplete (6h)',
  ROUTE_INCOMPLETE_12H: 'Route Incomplete (12h)',
  OFFICER_EFFICIENCY_DROP: 'Officer Efficiency Drop',
};

const AlertCard = ({ alert, onResolve }: { alert: Alert; onResolve: (id: string) => void }) => {
  const severityColors: { [key: string]: string } = {
    critical: 'bg-red-50 border-red-300',
    high: 'bg-orange-50 border-orange-300',
    info: 'bg-blue-50 border-blue-300',
  };

  const severityIcons: { [key: string]: React.ReactNode } = {
    critical: <Flame className="w-5 h-5 text-red-600" />,
    high: <AlertTriangle className="w-5 h-5 text-orange-600" />,
    info: <AlertCircle className="w-5 h-5 text-blue-600" />,
  };

  const hoursAgo =
    (Date.now() - new Date(alert.triggeredAt).getTime()) / (1000 * 60 * 60);

  return (
    <div
      className={`border-l-4 rounded-lg p-4 mb-3 ${severityColors[alert.severity]}`}
      style={{
        borderLeftColor:
          alert.severity === 'critical'
            ? '#dc2626'
            : alert.severity === 'high'
              ? '#ea580c'
              : '#3b82f6',
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3 flex-1">
          {severityIcons[alert.severity]}
          <div className="flex-1">
            <p className="font-semibold text-gray-900">
              {alertTypeLabels[alert.alertType] || alert.alertType}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {alert.triggerData.hoursExceeded !== undefined
                ? `${alert.triggerData.hoursExceeded.toFixed(1)} hours exceeded`
                : alert.triggerData.minutesExceeded !== undefined
                  ? `${alert.triggerData.minutesExceeded} minutes in progress`
                  : ''}
            </p>

            {alert.bin && (
              <p className="text-xs text-gray-700 mt-1">
                📍 Bin at ({alert.bin.location.coordinates[1].toFixed(4)},
                {alert.bin.location.coordinates[0].toFixed(4)}) —{' '}
                {alert.bin.riskLevel} (Score: {alert.bin.overflowScore})
              </p>
            )}

            {alert.officer && (
              <p className="text-xs text-gray-700">
                Officer: {alert.officer.name} ({alert.officer.email})
              </p>
            )}

            <p className="text-xs text-gray-500 mt-1">
              Triggered {hoursAgo.toFixed(1)} hours ago
            </p>

            {alert.escalationChain.length > 1 && (
              <p className="text-xs text-gray-600 mt-1 pt-1 border-t border-gray-300">
                Escalation: {alert.escalationChain.map((e) => e.notifiedRole).join(' → ')}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => onResolve(alert._id)}
          className="ml-2 p-1 hover:bg-white rounded-lg transition"
          title="Resolve alert"
        >
          <X className="w-5 h-5 text-gray-500 hover:text-gray-900" />
        </button>
      </div>
    </div>
  );
};

export function AlertsDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/alerts');
      const data = await response.json();
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/alerts/dashboard');
      const data = await response.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/alerts/run-monitoring', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        await fetchAlerts();
        await fetchDashboard();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionNotes: 'Resolved from dashboard',
        }),
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a._id !== alertId));
        if (dashboardData) {
          fetchDashboard();
        }
      }
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🚨 Alert & SLA Dashboard</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Running...' : 'Run SLA Check'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-red-600 font-bold text-2xl">
              {dashboardData.summary.criticalAlerts}
            </div>
            <p className="text-sm text-gray-600">Critical Alerts</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="text-orange-600 font-bold text-2xl">
              {dashboardData.summary.highAlerts}
            </div>
            <p className="text-sm text-gray-600">High Alerts</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-red-600 font-bold text-2xl">
              {dashboardData.summary.criticalBin12h + dashboardData.summary.criticalBin24h}
            </div>
            <p className="text-sm text-gray-600">Critical Bins at Risk</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-blue-600 font-bold text-2xl">
              {dashboardData.summary.routeIncomplete6h + dashboardData.summary.routeIncomplete12h}
            </div>
            <p className="text-sm text-gray-600">Routes Need Attention</p>
          </div>
        </div>
      )}

      {/* Breakdown Cards */}
      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <div className="font-semibold text-red-600">{dashboardData.summary.criticalBin12h}</div>
            <p className="text-gray-600">CRITICAL 12h</p>
          </div>
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <div className="font-semibold text-red-700">{dashboardData.summary.criticalBin24h}</div>
            <p className="text-gray-600">CRITICAL 24h Esc.</p>
          </div>
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <div className="font-semibold text-orange-600">{dashboardData.summary.routeIncomplete6h}</div>
            <p className="text-gray-600">Routes 6h+</p>
          </div>
          <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <div className="font-semibold text-orange-700">{dashboardData.summary.routeIncomplete12h}</div>
            <p className="text-gray-600">Routes 12h+ Esc.</p>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts ({alerts.length})</h3>

        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-600" />
            <p>All clear! No active alerts.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard key={alert._id} alert={alert} onResolve={handleResolveAlert} />
            ))}
          </div>
        )}
      </div>

      {/* Unacknowledged by Officer */}
      {dashboardData && dashboardData.unacknowledgedByOfficer.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Unacknowledged by Officer</h3>
          <div className="space-y-2">
            {dashboardData.unacknowledgedByOfficer.map((item) => (
              <div key={item._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">{item._id}</span>
                <span className="font-bold text-orange-600">{item.count} unacknowledged</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
