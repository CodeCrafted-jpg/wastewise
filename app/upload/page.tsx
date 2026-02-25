'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CohereAnalysis {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  estimatedFillLevel: number;
  recommendedAction: string;
  urgencyScore: number;
  tags: string[];
  locationHint: string;
}

interface SubmittedReport {
  id: string;
  imageUrl: string;
  analysis: CohereAnalysis;
  status: string;
  createdAt: string;
}

type Stage = 'idle' | 'uploading' | 'analyzing' | 'review' | 'submitting' | 'done' | 'error';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
  high:     { label: 'High',     color: '#f97316', bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c' },
  medium:   { label: 'Medium',   color: '#eab308', bg: '#fefce8', border: '#fef08a', dot: '#ca8a04' },
  low:      { label: 'Low',      color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a' },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  overflowing_bin: '🗑 Overflowing Bin',
  illegal_dumping: '🚫 Illegal Dumping',
  damaged_bin: '🔧 Damaged Bin',
  missed_collection: '🚛 Missed Collection',
  biohazard: '☣ Biohazard',
  general_waste: '♻ General Waste',
  recyclables: '♻ Recyclables',
  other: '📋 Other',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function UrgencyMeter({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? '#ef4444' : score >= 5 ? '#f97316' : '#22c55e';
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono)' }}>Urgency</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{score}/10</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, #22c55e, ${color})`,
          borderRadius: 99,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}

function FillMeter({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#ef4444' : pct >= 50 ? '#f97316' : '#22c55e';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono)' }}>Fill Level</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 99,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 0 0 ${color}55`,
      animation: 'pulse-ring 1.8s ease-out infinite',
      flexShrink: 0,
    }} />
  );
}

function StageIndicator({ stage }: { stage: Stage }) {
  const steps = [
    { key: 'upload', label: 'Upload' },
    { key: 'analyze', label: 'AI Scan' },
    { key: 'review', label: 'Review' },
    { key: 'submit', label: 'Submit' },
  ];

  const activeIdx =
    stage === 'idle' ? -1 :
    stage === 'uploading' ? 0 :
    stage === 'analyzing' ? 1 :
    stage === 'review' ? 2 :
    stage === 'submitting' ? 3 :
    stage === 'done' ? 4 : -1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: i < activeIdx ? '#16a34a' : i === activeIdx ? '#15803d' : '#e5e7eb',
              border: i === activeIdx ? '2px solid #15803d' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
              boxShadow: i === activeIdx ? '0 0 0 4px #bbf7d055' : 'none',
            }}>
              {i < activeIdx ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: i <= activeIdx ? '#fff' : '#9ca3af', fontFamily: 'var(--font-mono)' }}>
                  {i + 1}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: i <= activeIdx ? '#15803d' : '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1,
              height: 2,
              background: i < activeIdx ? '#16a34a' : '#e5e7eb',
              margin: '0 4px',
              marginBottom: 22,
              transition: 'background 0.3s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UploadReportPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Form state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Flow state
  const [stage, setStage] = useState<Stage>('idle');
  const [analysis, setAnalysis] = useState<CohereAnalysis | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Editable analysis fields (user can tweak before submit)
  const [editNote, setEditNote] = useState('');
  const [editSeverity, setEditSeverity] = useState<CohereAnalysis['severity']>('medium');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !user) router.push('/sign-in');
  }, [isLoaded, user, router]);

  // ── Geo location ──
  const getLocation = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  };

  // ── Image handling ──
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }
    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setStage('idle');
    setAnalysis(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Analyze with Cohere (via API route) ──
  const handleAnalyze = async () => {
    if (!imageFile) return;
    setError(null);
    setStage('uploading');

    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      fd.append('note', note);
      if (coords) {
        fd.append('lat', String(coords.lat));
        fd.append('lng', String(coords.lng));
      }
      // Use a dedicated analysis-only endpoint or the same one
      // Here we POST to the full submit endpoint which does upload + analyze + save
      // Alternatively, split into /api/analyze-report for preview only.
      // For this flow we'll do: analyze first (client-side Cohere call via proxy), then confirm.
      // We call /api/upload-report/analyze (lightweight endpoint, no DB write)

      setStage('analyzing');

      // Call Cohere directly via a lightweight server action
      const analyzeRes = await fetch('/api/upload-report/analyze', {
        method: 'POST',
        body: fd,
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error ?? 'Analysis failed');
      }

      const { analysis: result } = await analyzeRes.json();
      setAnalysis(result);
      setEditNote(note);
      setEditSeverity(result.severity);
      setStage('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setStage('error');
    }
  };

  // ── Final submit ──
  const handleSubmit = async () => {
    if (!imageFile || !analysis) return;
    setError(null);
    setStage('submitting');

    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      fd.append('note', editNote);
      fd.append('overrideSeverity', editSeverity);
      if (coords) {
        fd.append('lat', String(coords.lat));
        fd.append('lng', String(coords.lng));
      }

      const res = await fetch('/api/upload-report', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Submission failed');
      }

      const json = await res.json();
      setSubmitted(json.report);
      setStage('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed');
      setStage('error');
    }
  };

  // ── Reset ──
  const reset = () => {
    setImageFile(null);
    setImagePreview(null);
    setNote('');
    setAnalysis(null);
    setSubmitted(null);
    setError(null);
    setStage('idle');
    setCoords(null);
  };

  if (!isLoaded || !user) return null;

  const sev = analysis ? SEVERITY_CONFIG[editSeverity] : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --font-display: 'Fraunces', Georgia, serif;
          --font-mono: 'DM Mono', monospace;
          --green: #15803d;
          --green-light: #22c55e;
          --green-pale: #f0fdf4;
          --green-border: #bbf7d0;
          --ink: #111827;
          --muted: #6b7280;
          --surface: #ffffff;
          --ground: #f8fafc;
          --border: #e5e7eb;
        }

        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 currentColor; }
          70%  { box-shadow: 0 0 0 8px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .page-enter { animation: fade-up 0.5s ease both; }
        .analysis-card { animation: fade-up 0.4s ease both; }

        .drop-zone {
          border: 2px dashed var(--border);
          border-radius: 16px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--ground);
        }
        .drop-zone:hover, .drop-zone.dragging {
          border-color: var(--green);
          background: var(--green-pale);
        }

        .btn-primary {
          background: var(--green);
          color: #fff;
          border: none;
          padding: 14px 28px;
          border-radius: 10px;
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s;
          letter-spacing: 0.01em;
        }
        .btn-primary:hover:not(:disabled) {
          background: #166534;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px #15803d33;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-ghost {
          background: transparent;
          color: var(--muted);
          border: 1.5px solid var(--border);
          padding: 12px 22px;
          border-radius: 10px;
          font-family: var(--font-display);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-ghost:hover {
          border-color: #9ca3af;
          color: var(--ink);
          background: var(--ground);
        }

        .tag {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 99px;
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--green-pale);
          color: var(--green);
          border: 1px solid var(--green-border);
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-family: var(--font-mono);
        }
        .field textarea, .field input {
          background: var(--ground);
          border: 1.5px solid var(--border);
          color: var(--ink);
          padding: 12px 14px;
          border-radius: 10px;
          font-family: var(--font-display);
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .field textarea:focus, .field input:focus {
          border-color: var(--green);
          background: #fff;
        }

        .severity-btn {
          flex: 1;
          padding: 10px 8px;
          border-radius: 8px;
          border: 1.5px solid var(--border);
          background: var(--ground);
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          transition: all 0.15s;
          text-align: center;
        }

        .shimmer-line {
          height: 14px;
          border-radius: 6px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .info-row:last-child { border-bottom: none; }
        .info-row .info-key {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--muted);
          padding-top: 2px;
        }
        .info-row .info-val {
          font-size: 13px;
          color: var(--ink);
          text-align: right;
          max-width: 60%;
          line-height: 1.5;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--ground)', fontFamily: 'var(--font-display)' }}>

        {/* ── Topbar ── */}
        <header style={{
          background: '#fff',
          borderBottom: '1px solid var(--border)',
          padding: '0 32px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, background: 'var(--green)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>WasteWise</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--green-pale)',
              border: '1.5px solid var(--green-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--green)',
            }}>
              {user.firstName?.[0] ?? '?'}
            </div>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user.firstName}</span>
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>

          {/* Title */}
          <div className="page-enter" style={{ marginBottom: 40 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Civic Report
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1, marginBottom: 10 }}>
              Report a Waste Issue
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6 }}>
              Upload a photo and our AI will instantly analyze the severity, category, and recommended action — then submit directly to your municipal team.
            </p>
          </div>

          {/* Stage Indicator */}
          <StageIndicator stage={stage} />

          {/* ── DONE STATE ── */}
          {stage === 'done' && submitted && (
            <div className="analysis-card" style={{ background: '#fff', borderRadius: 20, border: '1.5px solid var(--green-border)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--green)', padding: '28px 32px', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Report Submitted!</h2>
                <p style={{ color: '#bbf7d0', fontSize: 14 }}>Your report has been logged and assigned to the municipal team.</p>
              </div>
              <div style={{ padding: '24px 32px' }}>
                <div className="info-row">
                  <span className="info-key">Report ID</span>
                  <span className="info-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{submitted.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Severity</span>
                  <span className="info-val">
                    <span style={{
                      background: SEVERITY_CONFIG[submitted.analysis.severity].bg,
                      color: SEVERITY_CONFIG[submitted.analysis.severity].color,
                      padding: '2px 10px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                    }}>
                      {submitted.analysis.severity.toUpperCase()}
                    </span>
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">Category</span>
                  <span className="info-val">{CATEGORY_LABELS[submitted.analysis.category] ?? submitted.analysis.category}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Status</span>
                  <span className="info-val" style={{ color: 'var(--green)', fontWeight: 600 }}>Pending Review</span>
                </div>
                {submitted.imageUrl && (
                  <img src={submitted.imageUrl} alt="Submitted" style={{ width: '100%', borderRadius: 12, marginTop: 16, maxHeight: 200, objectFit: 'cover' }} />
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button className="btn-primary" onClick={reset} style={{ flex: 1, justifyContent: 'center' }}>
                    Submit Another
                  </button>
                  <Link href="/dashboard" style={{ flex: 1 }}>
                    <button className="btn-ghost" style={{ width: '100%' }}>Back to Dashboard</button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── REVIEW STATE ── */}
          {stage === 'review' && analysis && sev && (
            <div className="analysis-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* AI Result Banner */}
              <div style={{
                background: sev.bg,
                border: `1.5px solid ${sev.border}`,
                borderRadius: 16,
                padding: '20px 24px',
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}>
                <PulsingDot color={sev.dot} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                      color: sev.color, letterSpacing: '0.1em',
                    }}>
                      {sev.label.toUpperCase()} SEVERITY
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {CATEGORY_LABELS[analysis.category] ?? analysis.category}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, marginBottom: 12 }}>
                    {analysis.description}
                  </p>
                  <UrgencyMeter score={analysis.urgencyScore} />
                  <div style={{ marginTop: 8 }}>
                    <FillMeter pct={analysis.estimatedFillLevel} />
                  </div>
                  {analysis.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {analysis.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended Action */}
              <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  AI Recommended Action
                </p>
                <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{analysis.recommendedAction}</p>
                {analysis.locationHint !== 'Not identifiable' && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    📍 {analysis.locationHint}
                  </p>
                )}
              </div>

              {/* Image preview */}
              {imagePreview && (
                <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: 14, maxHeight: 220, objectFit: 'cover', border: '1.5px solid var(--border)' }} />
              )}

              {/* Editable fields */}
              <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Review & Edit Before Submitting
                </p>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Your Note</label>
                  <textarea
                    rows={3}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Add any additional context…"
                  />
                </div>

                <div className="field">
                  <label>Override Severity</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['low', 'medium', 'high', 'critical'] as const).map((s) => {
                      const c = SEVERITY_CONFIG[s];
                      const active = editSeverity === s;
                      return (
                        <button
                          key={s}
                          className="severity-btn"
                          onClick={() => setEditSeverity(s)}
                          style={{
                            background: active ? c.bg : 'var(--ground)',
                            borderColor: active ? c.color : 'var(--border)',
                            color: active ? c.color : 'var(--muted)',
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                  ⚠ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={handleSubmit} style={{ flex: 1, justifyContent: 'center' }}>
                  {stage === 'submitting' ? (
                    <>
                      <svg style={{ animation: 'spin 0.7s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                      Submitting…
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Confirm & Submit
                    </>
                  )}
                </button>
                <button className="btn-ghost" onClick={reset}>Start Over</button>
              </div>
            </div>
          )}

          {/* ── UPLOAD / IDLE / ANALYZING STATE ── */}
          {(stage === 'idle' || stage === 'uploading' || stage === 'analyzing' || stage === 'error') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">

              {/* Drop Zone */}
              <div
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                {imagePreview ? (
                  <div style={{ position: 'relative' }}>
                    <img src={imagePreview} alt="Preview" style={{ maxHeight: 280, maxWidth: '100%', borderRadius: 12, objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: '#fff', borderRadius: 8, padding: '4px 10px',
                      fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)',
                      border: '1px solid var(--green-border)',
                    }}>
                      ✓ {imageFile?.name?.slice(0, 24)}
                    </div>
                    <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>Click to change image</p>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 56, height: 56, background: 'var(--green-pale)', border: '1.5px solid var(--green-border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)', fontSize: 15, marginBottom: 6 }}>
                      Drop your photo here
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>or click to browse · JPG, PNG, WEBP up to 10MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {/* Note Field */}
              <div className="field">
                <label>Describe the Issue <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="E.g. 'Bin on Main St overflowing since yesterday, foul smell…'"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Location */}
              <div style={{
                background: '#fff',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Attach Location</p>
                  {coords ? (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>
                      📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--muted)' }}>Helps teams locate the issue faster</p>
                  )}
                </div>
                <button
                  className="btn-ghost"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={getLocation}
                  disabled={geoLoading}
                >
                  {geoLoading ? (
                    <svg style={{ animation: 'spin 0.7s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  ) : coords ? '✓ Located' : '📍 Locate Me'}
                </button>
              </div>

              {/* Analyzing shimmer */}
              {(stage === 'uploading' || stage === 'analyzing') && (
                <div style={{ background: '#fff', border: '1.5px solid var(--green-border)', borderRadius: 14, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <svg style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--green)' }}>
                      {stage === 'uploading' ? 'Uploading image…' : 'AI analyzing your photo…'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="shimmer-line" style={{ width: '80%' }} />
                    <div className="shimmer-line" style={{ width: '60%' }} />
                    <div className="shimmer-line" style={{ width: '70%' }} />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                  ⚠ {error}
                </div>
              )}

              {/* CTA */}
              <button
                className="btn-primary"
                onClick={handleAnalyze}
                disabled={!imageFile || stage === 'uploading' || stage === 'analyzing'}
                style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '16px' }}
              >
                {stage === 'uploading' || stage === 'analyzing' ? (
                  <>
                    <svg style={{ animation: 'spin 0.7s linear infinite' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                    {stage === 'uploading' ? 'Uploading…' : 'Analyzing…'}
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Scan with AI
                  </>
                )}
              </button>

              <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                Powered by Cohere AI · Your report is reviewed by your local municipal team
              </p>
            </div>
          )}

        </main>
      </div>
    </>
  );
}