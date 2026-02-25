# 🧭 WasteWise — Project Constitution (`gemini.md`)

> **This file is LAW.** All schemas, behavioral rules, and architectural invariants live here.
> Only update when: a schema changes, a rule is added, or architecture is modified.

---

## 📐 Data Schemas (Confirmed)

### A. User (MongoDB `users` collection)

```json
{
  "_id": "ObjectId",
  "clerkUserId": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "role": "citizen | municipal_officer | admin | super_admin",
  "roleHistory": [
    {
      "role": "string",
      "assignedBy": "clerkUserId",
      "assignedAt": "ISODate",
      "reason": "string"
    }
  ],
  "ecoPoints": 0,
  "reportsSubmitted": 0,
  "phoneVerified": true,
  "emailVerified": true,
  "createdAt": "ISODate",
  "lastSeenAt": "ISODate"
}
```

### B. Auth Session (server-verified payload → UI)

```json
{
  "clerkUserId": "string",
  "sessionId": "string",
  "role": "citizen | municipal_officer | admin | super_admin",
  "sessionIssuedAt": "ISODate",
  "sessionExpiresAt": "ISODate"
}
```

### C. Report (input → server validated)

```json
{
  "userClerkId": "string",
  "imageUrls": ["string"],
  "description": "string",
  "location": { "lat": 22.5726, "lng": 88.3639 },
  "userSeverity": 1,
  "createdAt": "ISODate"
}
```

### E. WasteReport (Canonical MongoDB collection)

```json
{
  "_id": "ObjectId",
  "userClerkId": "string",
  "areaId": "string",
  "imageUrls": ["string"],
  "description": "string",
  "location": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "aiCategory": "organic | plastic | metal | mixed",
  "aiConfidence": 0.0,
  "classifierUsed": "cohere | fallback",
  "severityScore": 0-100,
  "status": "open | resolved",
  "createdAt": "ISODate"
}
```

> 📍 **Constraint**: Must have a `2dsphere` index on `location`.

### F. EcoPoints Audit Extension

Every time ecoPoints are awarded:

```json
{
  "action": "award_points",
  "actorClerkUserId": "system",
  "target": {
    "type": "user",
    "id": "clerkUserId"
  },
  "payload": {
    "pointsAwarded": 15,
    "reason": "valid_report"
  },
  "timestamp": "ISODate"
}
```

### D. Admin Action / Audit (`audit_logs` collection)

```json
{
  "action": "mark_cleaned | adjust_threshold | assign_role | award_points",
  "actorClerkUserId": "string",
  "actorRole": "string",
  "target": { "type": "string", "id": "string" },
  "payload": {},
  "previousValue": {},
  "timestamp": "ISODate"
}
```

---

## 📏 Behavioral Rules

### Role Hierarchy & Privileges

| Role | Privileges |
|------|-----------|
| `citizen` | Create reports, view public heatmap & own reports, earn ecoPoints |
| `municipal_officer` | + View predictions, acknowledge receipts, request route optimization |
| `admin` | + Mark areas cleaned, adjust thresholds, award ecoPoints, invite officers |
| `super_admin` | Full privileges, assign super_admin, emergency 2-step operations |

### Auth Rules (DETERMINISTIC)

1. **Identity**: Clerk is the identity provider. Server always verifies Clerk session JWT via `CLERK_SECRET_KEY`.
2. **Role Source of Truth**: `users.role` in MongoDB — **never** client tokens or Clerk claims.
3. **Default Role**: New users get `role: "citizen"` unless an invite specifies otherwise.
4. **Role Assignment**: Requires `admin` or `super_admin`. Writes to `roleHistory` with `assignedBy`.
5. **Audit Trail**: Every privileged operation persists to `audit_logs`.
6. **Anti-Abuse**: Rate-limit signups/reports by Clerk account + IP. Geo-duplicate check (20m & 2h).
7. **Emergency Ops**: Bulk reset / irreversible actions require super_admin + admin (2-step).

### Reporting Engine Rules (DETERMINISTIC)

1.  **Validation**: Every report MUST have at least one image URL, a description (min 10 chars), and valid geospatial coordinates.
2.  **Duplicate Detection**: A report is a duplicate if another 'open' report exists within a **20m radius** submitted within the last **2 hours**.
3.  **Severity Scoring**: Calculated as `(userSeverity * 20)`. If AI confidence > 0.8 and category is 'metal' or 'plastic', add 10 points. Max 100.
4.  **EcoPoints Caps**: Users earn 15 points per valid report. Max **3 reports per 24-hour period** are eligible for points to prevent spam.
5.  **Audit**: Every point award and report creation must be logged in `audit_logs`.

### "Do Not" Rules

- ❌ Never trust client-side role claims
- ❌ Never allow role elevation without audit log
- ❌ Never allow super_admin assignment by non-super_admin
- ❌ Never skip server-side session verification on mutations

---

## 🏛️ Architectural Invariants

| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS v4 |
| Auth Provider | Clerk (`@clerk/nextjs`) |
| Database | MongoDB Atlas (Mongoose) |
| Server Ops | TypeScript Utilities (No Python) |
| Middleware File | `proxy.ts` (Next.js 16 convention) |
| Env File | `.env.local` |
| Defense-in-Depth | Middleware = optimistic check; API routes = full auth |

### Env Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
MONGODB_URI
COHERE_API_KEY
CLOUDINARY_URL (TBD)
```

---

## 🔧 Maintenance Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-25 | Project Constitution initialized (Protocol 0) | System Pilot |
| 2026-02-25 | Schemas, behavioral rules, and arch invariants confirmed from Discovery answers | System Pilot |
