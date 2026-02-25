# 📋 reporting_sop.md — Waste Reporting Standard Operating Procedure

> This document defines the deterministic logic for reporting, validation, and scoring.
> **The Golden Rule**: If scoring logic changes, update this SOP first.

---

## 1. Input Validation
- **Image**: At least 1 valid URL.
- **Description**: Minimum 10 characters.
- **Location**: Must be a valid GeoJSON Point `[lng, lat]`.

## 2. Duplicate Detection
- **Window**: 2 hours (inclusive).
- **Radius**: 20 meters.
- **Status**: Only check against reports where `status: 'open'`.
- **Action**: If a match is found, return a `409 Conflict`.

## 3. AI Classification (Cohere)
- **Prompt**: User description + available metadata.
- **Goal**: Categorize into `organic | plastic | metal | mixed`.
- **Confidence**: If confidence < 0.4, use `fallback` (mixed).

## 4. Severity Scoring
- **Base Score**: `userSeverity * 20` (User input 1-5).
- **AI Bonus**: If `aiConfidence` > 0.8:
    - `plastic` or `metal`: +10 points.
    - `organic`: +5 points.
- **Max Score**: 100.

## 5. EcoPoints Logic
- **Award**: 15 points per valid report.
- **Cap**: Max **3 reports per 24-hour period** are eligible for points.
- **Verification**: Check `audit_logs` for `action: 'award_points'` within the last 24h.

## 6. Audit & Traceability
- Every point award must be logged in `audit_logs` with `reason: 'valid_report'`.
- Every report creation must be logged in `audit_logs`.
- Failures in AI classification must be logged but should not block report creation (use `fallback`).
