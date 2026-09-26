# Tech Stack — AI Political Poster Maker

> Derived from `task.md` and `project-scope.md` (v0.5), 2026-09-25.
> **Change from task.md:** authentication uses **server-side sessions stored in MongoDB**, not JWT (see §4).
> Pin exact versions in the lockfile at `init` time; the versions below are the minimum major versions to target.

---

## 1. Summary

| Layer | Choice |
|---|---|
| Language | **TypeScript** everywhere (strict mode) |
| Runtime | **Node.js 24 LTS** |
| Repo layout | **pnpm workspaces** monorepo: `apps/web`, `apps/api`, `packages/shared` |
| Frontend | **Next.js 16+** (App Router, React 19) on **Vercel** |
| UI | **Tailwind CSS v4** + **shadcn/ui**, Bangla fonts via `next/font` |
| Forms & data fetching | **React Hook Form** + **Zod**, **TanStack Query** |
| Backend | **Express 5** on **Render** (Docker, long-running process) |
| Database | **MongoDB Atlas** + **Mongoose 8+** |
| Auth | **Phone + one-time code → opaque session token in an httpOnly cookie, session stored in MongoDB** |
| AI | **Google Gemini** via the official **`@google/genai`** SDK |
| Rendering | **Puppeteer** (headless Chromium) — HTML/CSS template → PNG |
| Image processing | **sharp** (validate resolution, fix EXIF rotation, strip metadata) |
| File storage | **Cloudinary** (authenticated/signed delivery) |
| Uploads | **multer** (memory storage, size limit) |
| Validation | **Zod** schemas shared between web and api |
| Security | **helmet**, **express-rate-limit**, Origin check for CSRF |
| Logging | **pino** (+ `pino-http`) |
| Testing | **Vitest**, **supertest**, **mongodb-memory-server** |
| Tooling | ESLint, Prettier, `tsx` (dev runner), `tsup` or `tsc` (build) |

---

## 2. Repository Structure

```
/
├─ apps/
│  ├─ web/                 # Next.js frontend (Vercel)
│  │  ├─ app/              # routes: /login, /templates, /posters/new, /posters/[id], /history
│  │  ├─ components/
│  │  └─ lib/api.ts        # fetch wrapper (credentials: 'include')
│  └─ api/                 # Express backend (Render)
│     ├─ src/
│     │  ├─ config/        # env (Zod-validated), db, cloudinary, gemini
│     │  ├─ models/        # User, Session, OtpCode, Template, Poster, UsageCounter, GenerationLog
│     │  ├─ middleware/    # requireAuth, requireAdmin, rateLimits, errorHandler, originCheck
│     │  ├─ routes/        # auth, templates, posters, upload
│     │  ├─ services/      # session, otp, sms, quota, gemini, render, storage, blocklist
│     │  └─ render/        # HTML templates, in-page scripts (fonts in apps/api/assets/fonts)
│     ├─ scripts/          # seed-templates, seed-users, generate-backgrounds (offline Gemini)
│     └─ Dockerfile
└─ packages/
   └─ shared/              # Zod schemas + TS types: form input, layoutConfig, API DTOs
```

**Why a monorepo:** the poster form schema, `layoutConfig` schema and API response types are defined once in `packages/shared` and used by both the Next.js form and the Express validators, so the two can't drift apart.

---

## 3. Frontend — `apps/web`

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Required by task.md. Mostly client components for the form/preview flow; server components for static pages. |
| Styling | Tailwind CSS v4 + shadcn/ui | Fast, mobile-first, accessible primitives (dialog, select, toast). |
| Fonts | `next/font/google`: **Hind Siliguri** (UI), **Noto Serif Bengali** (headings) | OFL-licensed, good conjunct support. |
| Forms | React Hook Form + `@hookform/resolvers/zod` | Same Zod schema as the backend. |
| Server state | TanStack Query | Caching for templates/history, mutation state for generate/regenerate. |
| Photo input | Native `<input type="file" accept="image/*" capture>` + client-side preview | Downscale oversized images in the browser before upload to save mobile data. |
| i18n | None — Bangla strings directly in components (a single `strings.ts`) | UI is Bangla-only per scope. |
| API access | Same-origin `/api/*` via Next.js **rewrites** to the Render backend | Keeps the session cookie first-party (see §4.5). |

---

## 4. Authentication — Database Sessions

### 4.1 Why database sessions instead of JWT

| Need in this project | Database session | JWT |
|---|---|---|
| **Ban a misusing user instantly** (R1: defamation, fake endorsements) | Delete their sessions → logged out on the next request | Token stays valid until expiry unless a denylist is added (which is a DB lookup anyway) |
| **Premium plan changes take effect immediately** | User is loaded from DB on each request | Stale `plan` claim until token refresh |
| **Logout that really logs out** | Session row deleted | Client just forgets the token |
| **Token theft (XSS)** | httpOnly cookie, opaque value, nothing to decode | Often kept in `localStorage`; needs a refresh-token scheme to be safe |
| **Complexity** | One collection + one middleware | Access + refresh tokens, rotation, denylist |
| **Cost** | One indexed lookup per request (MongoDB Atlas already in the stack) | No lookup |

At this scale the extra lookup is negligible, and revocation matters for a political content tool.

### 4.2 Implementation choice

A small **custom session service** (~100 lines) on a Mongoose `Session` model, rather than `express-session` + `connect-mongo`, because it lets us:
- store only a **hash** of the token (a leaked DB dump can't be replayed),
- query sessions by `userId` ("log out everywhere", admin ban),
- keep types and indexes in the same place as the other models.

*(`express-session` + `connect-mongo` is an acceptable fallback if time runs short; it stores the raw session ID and uses its own schema.)*

### 4.3 Data model

```ts
// Session
{
  _id: ObjectId,
  tokenHash: string,      // SHA-256(hex) of the raw token — unique index
  userId: ObjectId,       // ref User — index
  createdAt: Date,
  lastSeenAt: Date,
  expiresAt: Date,        // TTL index: { expiresAt: 1 }, expireAfterSeconds: 0
  userAgent?: string,
  ip?: string,
}

// OtpCode — one-time login codes
{
  phone: string,          // E.164, e.g. +8801XXXXXXXXX — index { phone, createdAt: -1 }
  codeHash: string,       // SHA-256 of pepper + phone + 6-digit code
  status: 'pending' | 'verified' | 'superseded' | 'failed',
  attempts: number,       // max OTP_MAX_ATTEMPTS (5), then the code is dead
  verifiedAt: Date | null,
  expiresAt: Date,        // now + OTP_TTL_SEC (180 s): the code stops working
  ip: string | null,      // index { ip, createdAt: -1 }, for the per-IP hourly limit
  purgeAt: Date,          // now + 24 h, TTL index (rows feed the hourly limits)
  createdAt: Date,
  updatedAt: Date,
}
```

### 4.4 Flow

1. **`POST /api/auth/otp/request`** `{ phone }`
   - Normalize to E.164. Limits stored in MongoDB: 60 s cooldown per phone (race-safe), 5 codes per phone and 20 per IP per hour; plus in-memory burst limits.
   - Generate a 6-digit code with `crypto.randomInt`, store its hash in `OtpCode`, send it through the `SmsProvider`, then mark older pending codes `superseded`. A failed send marks the row `failed` (doesn't count towards the limits).
   - `SmsProvider` implementations: **`ConsoleSmsProvider`** (`OTP_DEV_MODE=true`, refused in production) and **`BulkSmsBdProvider`** (BulkSMSBD HTTP API).
   - Same answer for every number (no `isNewUser`), so it can't be used to find accounts.
   - **Reviewer test numbers:** `REVIEWER_FREE_PHONE` / `REVIEWER_PREMIUM_PHONE` + fixed `REVIEWER_CODE` from env; no SMS sent.
2. **`POST /api/auth/otp/verify`** `{ phone, code }`
   - Compare hashes with `crypto.timingSafeEqual` against the latest pending code; every attempt is counted atomically; mark the code `verified` on success (single use, also under parallel requests).
   - Upsert the `User` (first login = signup; requires the terms checkbox → `acceptedTermsAt`). A new number with a correct code but no `acceptTerms` gets `TERMS_REQUIRED`; the code stays usable.
   - Create a session: `token = crypto.randomBytes(32).toString('base64url')`, store `sha256(token)`, `expiresAt = now + 30 days`.
   - A **new session is always created on login** (prevents session fixation).
   - Respond with `Set-Cookie: sid=<token>`.
3. **`requireAuth` middleware** (every protected route)
   - Read `sid` cookie → hash → `Session.findOne({ tokenHash, expiresAt: { $gt: now } })`.
     *(The `expiresAt` check is needed because MongoDB's TTL monitor deletes expired rows only about once a minute.)*
   - Load the `User` (`.lean()`), apply the premium-expiry rule (`planExpiresAt` passed → treat as free), attach `req.user`.
   - **Sliding expiry:** if `lastSeenAt` is older than 24 h, push `expiresAt` forward 30 days and update `lastSeenAt` (throttled so most requests are read-only).
4. **`GET /api/auth/me`** → current user, plan and today's remaining quota.
5. **`POST /api/auth/logout`** → delete the current session, clear the cookie.
6. **`POST /api/auth/logout-all`** → `Session.deleteMany({ userId })`. Admin ban uses the same call.

### 4.5 Cookie settings & cross-origin setup

```
Set-Cookie: sid=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

- The frontend (Vercel) and backend (Render) are on different domains. A cookie set by `*.onrender.com` would be a **third-party cookie**, which Safari/iOS blocks and Chrome is restricting.
- **Solution:** the browser only talks to the Vercel domain. `next.config.ts` rewrites `/api/:path*` → `https://<api>.onrender.com/api/:path*`, so the cookie is first-party and `SameSite=Lax` works.
- Express runs with `app.set('trust proxy', 1)` so `Secure` cookies and rate-limit IPs work behind the proxies.
- **Fallback** if the rewrite proxy's timeout is too short for a render: call Render directly with `SameSite=None; Secure` cookies + CORS `credentials: true` restricted to the Vercel origin (works on Chrome/Android, the main target; document the Safari caveat).

### 4.6 CSRF

Cookie-based auth needs CSRF protection:
- `SameSite=Lax` blocks cross-site `POST`/`PATCH`/`DELETE` from sending the cookie.
- **Origin check middleware:** reject state-changing requests whose `Origin` header isn't the app's own origin.
- No state changes on `GET` routes.

---

## 5. Backend — `apps/api`

| Concern | Choice | Notes |
|---|---|---|
| Framework | Express 5 | Required by task.md; native async error handling in v5. |
| Validation | Zod (from `packages/shared`) | One `validate(schema)` middleware for body/query/params. |
| Env config | Zod-validated `process.env` at startup | Crash on boot if a key is missing, not mid-request. |
| Security headers | helmet | |
| CORS | `cors` with an explicit origin allowlist | Only needed for the fallback in §4.5. |
| Rate limiting | express-rate-limit (in-memory store) + stored OTP limits | In-memory burst limits on OTP request, upload, generate and headline suggestions. Login-code limits (cooldown, per phone / IP per hour, attempts) are counted in MongoDB so they hold across Vercel instances. |
| Uploads | multer (memory, 10 MB max, image MIME only) → sharp → Cloudinary | sharp enforces minimum resolution (R6), auto-rotates, strips EXIF/GPS. |
| Quotas | `UsageCounter` + single atomic conditional `$inc` (project-scope §12) | Reserve-then-refund on render failure. Dhaka date via `Intl.DateTimeFormat` with `timeZone: 'Asia/Dhaka'`. |
| Blocklist | Static keyword list in the repo, normalized Bangla/English match | |
| Logging | pino + pino-http | JSON logs, readable on Render. Never log OTP codes outside dev mode. |
| Generation | Synchronous within the request (< 30 s) | No job queue in the MVP. |

### API endpoints (auth changes from task.md)

```
POST   /api/auth/otp/request
POST   /api/auth/otp/verify
POST   /api/auth/logout
POST   /api/auth/logout-all
GET    /api/auth/me

GET    /api/templates
GET    /api/templates/:id

POST   /api/upload
POST   /api/headlines/suggest
POST   /api/posters
GET    /api/posters/me          # replaces /api/posters/user/:userId (IDOR fix)
GET    /api/posters/:id         # owner only
POST   /api/posters/:id/regenerate
DELETE /api/posters/:id
```

---

## 6. Database — MongoDB Atlas + Mongoose

| Collection | Key indexes |
|---|---|
| `users` | `phone` unique |
| `sessions` | `tokenHash` unique, `userId`, TTL on `expiresAt` |
| `otpcodes` | `{ phone, createdAt: -1 }`, `{ ip, createdAt: -1 }`, TTL on `purgeAt` |
| `templates` | `occasionType`, `isActive` |
| `posters` | `{ userId, createdAt: -1 }` (history page) |
| `usagecounters` | `{ userId, date }` unique |
| `generationlogs` | `posterId`, `createdAt` |

- Atlas **M0 free tier** is enough for the demo.
- The atomic quota query relies on the `{ userId, date }` unique index; a duplicate-key error on upsert means "quota exceeded".

---

## 7. AI — Google Gemini

SDK: **`@google/genai`** (the current official Google Gen AI SDK). Check the model list at build time; model names change often.

| Use | When | Model class |
|---|---|---|
| Decorative template backgrounds | **Offline**, once per template, via `scripts/generate-backgrounds.ts`; output committed as assets | Gemini image-generation model (e.g. Gemini Flash Image) |
| Bangla headline suggestions (3–5) | Runtime, on request | Gemini Flash (text), structured JSON output |
| Face bounding box for cropping | Runtime, once per uploaded photo | Gemini Flash (vision), structured JSON output |

- Use **structured output** (`responseMimeType: 'application/json'` + response schema) so replies parse reliably; validate them with Zod.
- **Timeouts + fallbacks:** face-crop failure → center crop; headline failure → the user types their own. Gemini never blocks poster creation.
- Every call is written to `GenerationLog` (model, stage, latency, success).
- Gemini **never renders Bangla text** on the poster (Option B).

---

## 8. Rendering — Puppeteer

| Concern | Choice |
|---|---|
| Engine | Puppeteer with its bundled Chrome (HarfBuzz shapes Bangla conjuncts correctly; node-canvas does not reliably) |
| Templates | Plain HTML/CSS strings built from `layoutConfig` + user data (escaped), with fonts loaded from local files via `@font-face` |
| Fonts | Noto Serif Bengali, Noto Sans Bengali, Hind Siliguri — OFL, bundled in `apps/api/assets/fonts` and inlined as data URIs (no network or file access from Chromium) |
| Text fitting | Measure in the page (`scrollHeight`/`scrollWidth`) and shrink font size to fit per `layoutConfig` rules (R5) |
| Output sizes | 4:5 at 1080×1350 (preview + social); A3 at 3508×4961 rendered at CSS size × `deviceScaleFactor` on download (R9) |
| Browser lifecycle | One shared browser instance, a new page per render, page always closed in `finally`; limit to 1–2 concurrent renders |
| Photos | Cloudinary URLs with a crop transformation from the face box, or `object-position` on a framed `<img>` |
| Watermark | Absolute-positioned overlay in the HTML for free-tier posters |
| Result | PNG buffer → Cloudinary upload → URLs stored on `Poster.outputs` |

---

## 9. File Storage — Cloudinary

- Folders: `uploads/{userId}/`, `posters/{userId}/`, `templates/`.
- User photos and generated posters use **authenticated delivery** (signed URLs with expiry) for privacy (R8); template assets are public.
- Deleting a poster deletes its Cloudinary assets.
- Upload from the server only (the API key never reaches the browser).

---

## 10. Deployment

| Piece | Host | Notes |
|---|---|---|
| Frontend | **Vercel** | Env: `API_ORIGIN` (used by the rewrite). |
| Backend | **Render** web service, **Docker** | Base image `node:24-slim`; Chrome and its system libraries installed with `puppeteer browsers install chrome --install-deps`, so the Chrome version always matches the locked puppeteer version. Blueprint in `render.yaml`. Deploy an empty app on Day 1 (R3). Free tier sleeps and has 512 MB RAM: keep A3 renders to one at a time; upgrade to the Starter plan if the A3 render runs out of memory. |
| Database | **MongoDB Atlas** M0 | Allow Render's outbound IPs (or 0.0.0.0/0 for the demo). |
| Storage | **Cloudinary** free tier | |
| Secrets | Render + Vercel env settings; `.env.example` committed, `.env` git-ignored | |

### Environment variables (`apps/api`)

```
NODE_ENV, PORT
MONGODB_URI
APP_ORIGIN                     # Vercel URL, for Origin check / CORS
SESSION_TTL_DAYS=30
OTP_DEV_MODE=false             # true only locally; refused in production
OTP_PEPPER
OTP_TTL_SEC=180, OTP_RESEND_COOLDOWN_SEC=60, OTP_MAX_ATTEMPTS=5
OTP_MAX_PER_PHONE_PER_HOUR=5, OTP_MAX_PER_IP_PER_HOUR=20
BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID, BULKSMSBD_API_URL
REVIEWER_FREE_PHONE, REVIEWER_PREMIUM_PHONE, REVIEWER_CODE
GEMINI_API_KEY
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
```

---

## 11. Testing

| Area | Tool | What |
|---|---|---|
| Quota logic | Vitest + mongodb-memory-server | Limits, Dhaka day boundary, **5 parallel requests at the limit**, refund on failure |
| Sessions | Vitest + supertest | Login sets cookie, expired/deleted session → 401, logout-all, other user's poster → 404 |
| OTP | Vitest + supertest | Wrong code attempts (also parallel), expiry, single use, resend replaces the old code, cooldown race, hourly limits, SMS failure, no enumeration, reviewer number; BulkSMSBD provider with mocked `fetch` |
| `layoutConfig` | Vitest | Zod schema accepts seeded templates, rejects malformed ones |
| Text fitting / rendering | Vitest + Puppeteer | 60-char name/designation fit; conjunct sample renders (snapshot of dimensions) |

---

## 12. Deliberately Not Used

| Not used | Why |
|---|---|
| JWT | Replaced by database sessions (§4.1) |
| NextAuth / Auth.js, Clerk | Auth lives in Express, not Next.js; custom phone OTP + DB sessions is small and fits the requirement |
| Redis | Single instance: in-memory rate limits and MongoDB sessions are enough |
| Job queue (BullMQ etc.) | Generation is synchronous in the MVP |
| node-canvas | Unreliable Bangla conjunct shaping |
| Background-removal service | Photos are framed, not cut out |
| S3 | Cloudinary chosen for faster setup and built-in transformations |
