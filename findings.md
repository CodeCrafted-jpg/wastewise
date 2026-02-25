# 🔍 WasteWise — Findings

> Research, discoveries, and constraints captured during the project.

---

## Codebase Discovery (2026-02-25)

| Item | Detail |
|------|--------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5.x (Only) |
| React | 19.2.3 |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` |
| Font | Geist Sans + Geist Mono |
| State | Fresh scaffold — no custom code |

## Clerk Research (2026-02-25)

| Finding | Detail |
|---------|--------|
| File Convention | Next.js 16 uses **`proxy.ts`** (not `middleware.ts`) |
| Helper | `clerkMiddleware()` + `createRouteMatcher()` from `@clerk/nextjs/server` |
| Default Behavior | All routes public by default; must opt-in to protection |
| Defense-in-Depth | CVE-2025-29927 showed middleware bypass risk — full auth must happen in API routes, not just middleware |
| Session Pattern | `auth()` from `@clerk/nextjs/server` returns `{ userId, sessionId }` in API routes |
| RBAC Pattern | Clerk recommends `publicMetadata` for roles, but our spec uses MongoDB as role source of truth |
| Webhooks | `user.created` / `user.updated` events; verify with `svix` library |

## Env Status (2026-02-25)

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Set |
| `CLERK_SECRET_KEY` | ✅ Set |
| `MONGODB_URI` | ✅ Set (points to `DSA-quest` DB) |
| `COHERE_API_KEY` | ✅ Set |
| `CLOUDINARY_URL` | ❌ Not set |
| `CLERK_WEBHOOK_SECRET` | ❌ Not set |

## Reporting Engine Specifications (2026-02-25)

| Specification | Detail |
|---------------|--------|
| Validation | Image (req), Description (min 10 chars), Location (GeoJSON Point) |
| Duplicate Check | 20m radius, 2h window, status: 'open' via `$near` |
| Severity Score | `userSeverity * 20` + AI Bonus (max 100) |
| EcoPoints | 15 per report, cap: 3 per 24h tracked via `audit_logs` |
| AI Classifier | Cohere Chat API (V1 Chat) as generative classifier |

### Constraints
- `CLOUDINARY_URL` provided: Image paths are now handled as strings.
- `COHERE_API_KEY` provided: Generative classification implemented in `lib/reporting.ts`.
- Mongoose `2dsphere` index auto-created on `WasteReport` model.

## Constraints

- MongoDB URI currently points to `DSA-quest` database — may need separate `wastewise` DB
- No Cloudinary credentials yet — image upload features will be stubbed
- Clerk webhook verification requires `CLERK_WEBHOOK_SECRET` from Clerk Dashboard
