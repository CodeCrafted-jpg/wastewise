# 📋 prediction_sop.md — Waste Overflow Prediction Standard Operating Procedure

> This document defines the deterministic logic for predicting waste overflow and service prioritizing.
> **The Golden Rule**: Prediction logic must be fully auditable and reproducible.

---

## 1. Data Aggregation
- **Frequency**: Count of `WasteReport` documents with `status: 'open'` and `createdAt` >= Now - 48h.
- **Clustering**: Group reports by spatial proximity (30m radius). The "Bin" center is the location of the most recent report in the cluster.
- **Cleanup Status**: Days since the last `AuditLog` entry with `action: 'area_cleaned'` for that location. (Fallback: 0 days if never cleaned).

## 2. Quantitative Scoring
The `overflowScore` (0-100) is calculated using three variables:

| Component | Calculation | Max Contribution |
|-----------|-------------|------------------|
| **Frequency** | `count(reports) * 10` | 50 points |
| **Severity** | `average(severityScore) * 0.3` | 30 points |
| **Time Decay**| `daysSinceLastCleanup * 2` | 20 points |

**Formula**:
`overflowScore = Min(100, Frequency + Severity + TimeDecay)`

## 3. Risk Level Assignment
Risk levels are assigned strictly based on the finalized `overflowScore`:

| Score Range | Risk Level | Priority |
|-------------|------------|----------|
| 80 - 100 | **CRITICAL** | Immediate (Next 2h) |
| 60 - 79 | **HIGH** | Same Day (Next 8h) |
| 30 - 59 | **MEDIUM** | Scheduled (Next 24h) |
| 0 - 29 | **LOW** | Routine |

## 4. Execution & Protection
- **Trigger**: Run manually via `/api/predictions/run` by authorized staff.
- **Auth**: Requires `municipal_officer` for viewing, but `admin` or higher for running the engine.
- **Persistence**: Results are upserted into the `bin_predictions` collection.
- **Audit**: Log each run with `payload.binsCount` and `payload.riskSummary`.

## 5. Admin Overrides
- Admins can manually mark an area as `resolved` which will reset the `daysSinceLastCleanup` count.
- Thresholds for weights are configurable via environment variables in future iterations.
