# ✅ |✅ |✅ |⏸ |✅ |✅ |Implementation Plan — AI Political Poster Maker

> Based on `project-scope.md` (v0.5) and `tech-stack.md`, 2026-09-25. Last updated 2026-09-25 (after Phase 3).
> Deadline: **2026-09-26 23:59**, one developer. **Feature freeze: 2026-09-26 18:00.**

## How to read this plan

- **Tasks are small** (15–90 min). Each ends in one commit with a clear message.
- **Priority**
  - **P0:** needed for the *absolute minimum demo*: login → pick template → form + 3 photos → A3 PNG with correct Bangla → download.
  - **P1:** the rest of the MVP in the scope document.
  - **P2:** cut first if behind schedule.
- **Done when:** the check that closes the task. Don't start the next task until it passes.
- **Status:** ✅ done · ⏸ deferred · blank = not started.
- Phases run in order. Inside a phase, tasks run top to bottom unless marked *(parallel)*.

## Progress

| Phase | Status | Commit |
|---|---|---|
| 0 — Foundation | ✅ Done locally. Deploy (0.6) deferred to 4.5; SMS signup (0.7) not started. | `f40807c` |
| 1 — Render pipeline | ✅ Done locally: conjuncts correct, A3 3508×4961 @300 DPI in ~2 s, 4:5 in ~0.6 s, no leaked pages. Not yet measured on Render (4.5). | `ad3f941` |
| 2 — Templates | ✅ 2 templates (বিজয় দিবস, শোক/স্মরণ) × 2 sizes, 1- and 2-leader variants, seeded to Atlas, `GET /api/templates`, 25 tests. AI backgrounds (2.3) waiting for a Gemini key; CSS gradients used meanwhile. | `0604018` |
| 3 — Auth | ✅ Phone + one-time code, DB sessions (hashed token, httpOnly cookie, sliding expiry), Origin check, reviewer free/premium logins, `/login` from the Superdesign draft with its fixes, 61 tests + browser run at 390 px. | uncommitted |
| 4–10 | Not started | |

**Decisions made while building (not in the original plan):**
- **Localhost first.** Deploying to Render/Vercel is postponed. `pnpm dev` starts db + api + web; a local MongoDB (the `mongodb-memory-server` binary) starts only when `MONGODB_URI` points at localhost. Atlas is configured in `apps/api/.env`.
- **`DNS_SERVERS`** (optional env): Node on this machine can't resolve `mongodb+srv://` through the local DNS proxy (`querySrv ECONNREFUSED`), so it's set to `8.8.8.8,1.1.1.1`.
- **API dev runs on `node --watch --import tsx`**. `tsx watch` hung silently under `concurrently` on Windows.
- **Docker base** is `node:24-slim` + Chrome via `puppeteer browsers install chrome --install-deps` (keeps Chrome matched to the locked Puppeteer version).
- **Fonts** live in `apps/api/assets/fonts` and are inlined as data URIs; a render fails if a required font doesn't load.
- **Template thumbnails** are rendered by `pnpm --filter @app/api templates:thumbnails` into `apps/api/assets/thumbnails` (committed) and served at `/api/templates/thumbnails/<slug>.webp`, so the template picker doesn't depend on Cloudinary.
- **Text fitting measures lines × line-height**, not `scrollHeight`: Bangla glyph areas are taller than a tight line-height and caused false overflow.
- **Login options come from the API** (`GET /api/auth/options`: reviewer numbers, dev mode) instead of a `NEXT_PUBLIC_SHOW_REVIEWER_ACCESS` flag, so the API env is the single switch.
- **Reviewer logins:** `01999000001` (free) and `01999000002` (premium), code `123456`, seeded by `pnpm --filter @app/api seed:users`.
- **Login UI** follows the Superdesign draft *Auth Screen with Navigation and Smooth Transitions* (`aa8ce61d-ceae-4d3e-8d35-065c1c2eb587`, v3) with the fixes listed under Phase 3.

## Time budget

| | Hours |
|---|---|
| P0 tasks | ~27 h (~7 h done) |
| P0 + P1 | ~42 h |
| All (incl. P2) | ~43 h |

P0 + P1 is more than the realistic working time left in the ~46 h after sleep. Plan to finish **all P0 plus as much P1 as fits**, in this order: quotas → watermark → history → blocklist/rate limits → headlines → face crop. Use the checkpoints below to decide what to cut.

| Checkpoint | Target time | If behind |
|---|---|---|
| Render pipeline works (end of Phase 1) | 25 Sep, 14:00 | ✅ Locally. Render check moved to 4.5. |
| Auth + uploads done, **API running on Render** (end of Phase 4) | 25 Sep, 23:00 | Drop face crop (4.4) → center crop only. If Render can't render A3 in 512 MB, move to the Starter plan now, not on Day 2. |
| **Minimum demo works** (end of Phase 5) | 26 Sep, 11:00 | Drop Phase 7 (headlines) and all P2 tasks |
| Feature freeze | 26 Sep, 18:00 | Ship what works; list the rest in the README |

---

## Phase 0 — Foundation (~3 h) · Day 1 morning ✅

Goal: an empty app that runs end to end locally.

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 0.1 | Init pnpm workspace: root `package.json`, `pnpm-workspace.yaml`, base `tsconfig`, ESLint, Prettier, `.gitignore`, `.env.example` | 30m | P0 | ✅ | `pnpm -r lint` runs clean |
| 0.2 | `packages/shared`: Zod dependency, build/exports config, one sample schema used by both apps | 20m | P0 | ✅ | Both apps import from `@app/shared` |
| 0.3 | `apps/api`: Express 5, dev script, helmet, pino-http, error handler, Zod-validated env, `GET /api/health` | 40m | P0 | ✅ | `curl localhost:4000/api/health` → 200 |
| 0.4 | `apps/web`: Next.js App Router, Tailwind v4, shadcn/ui init, Hind Siliguri + Noto Serif Bengali via `next/font`, `/api/*` rewrite to `API_ORIGIN` | 40m | P0 | ✅ | Home page shows Bangla text; `/api/health` works through the rewrite |
| 0.5 | MongoDB Atlas cluster and Cloudinary account; `config/db.ts`, `config/cloudinary.ts`; local dev database script | 20m | P0 | ✅ | API logs "Mongo connected" on boot |
| 0.6 | `apps/api/Dockerfile` (`node:24-slim` + Chrome via `puppeteer browsers install --install-deps`), `render.yaml`; deploy | 45m | P0 | ⏸ | Files written; **deploy moved to 4.5** (API) and 10.1 (web) |
| 0.7 | *(parallel)* Start SMS provider signup (Twilio Verify / BD gateway) so approval runs in the background | 10m | P2 | | Signup submitted |

## Phase 1 — Render pipeline spike (~3 h) · Day 1 ✅

Goal: prove the riskiest part first. Correct Bangla conjuncts in an A3 PNG.

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 1.1 | Bundle OFL fonts in `apps/api/assets/fonts`; hard-coded HTML poster containing "সংগ্রাম", "শ্রদ্ধাঞ্জলি", "ক্ষ", "ন্ত্র" | 45m | P0 | ✅ | Conjuncts correct in the rendered PNG |
| 1.2 | `services/render.ts`: one shared browser, new page per render, page closed in `finally`, concurrency limit (`RENDER_CONCURRENCY`) | 45m | P0 | ✅ | 10 renders in a row with no leaked pages |
| 1.3 | Export 4:5 (1080×1350) and A3 (3508×4961 via `deviceScaleFactor`, 300 DPI); dev-only `/api/dev/render-test`; `render:sample` script | 45m | P0 | ✅ | A3 PNG at exact size, render < 30 s (locally ~2 s). *Measuring on Render: 4.5.* |
| 1.4 | In-page text fitting: shrink font until text fits the slot's box and max lines (R5) | 45m | P1 | ✅ | 60-char name and designation fit without overflow |

## Phase 2 — Templates & layoutConfig (~4 h) · Day 1 ✅

Goal: the two templates exist in the database and render from data, not hard-coded HTML.

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 2.1 | `layoutConfig` Zod schema in `shared`: slots per output size, text rules (font, min/max size, max lines, align), frame shape, optional slot, color tokens, background per size | 60m | P0 | ✅ | Schema compiles; one example config passes |
| 2.2 | `Template` Mongoose model (`title`, `occasionType`, `thumbnailUrl`, `layoutConfig`, `isActive`) | 20m | P0 | ✅ | Model saves a validated config |
| 2.3 | `scripts/generate-backgrounds.ts`: Gemini image model → background per template and size → upload to Cloudinary `templates/` | 45m | P1 | ⏸ | 2 backgrounds (plus sizes) uploaded and committed as assets/URLs. *Fallback: hand-made gradient backgrounds* (in use; needs `GEMINI_API_KEY`). |
| 2.4 | HTML builder: `layoutConfig` + form data (escaped) + photo URLs → HTML string; author বিজয় দিবস and শোক/স্মরণ configs for 4:5 and A3 (separate layouts per size — the Phase 1 poster leaves a gap on A3) | 90m | P0 | ✅ | Both templates render with sample data in both sizes |
| 2.5 | `scripts/seed-templates.ts`; `GET /api/templates` (filter by occasion) and `GET /api/templates/:id` | 30m | P0 | ✅ | Seed runs twice without duplicates; endpoints return 2 templates |
| 2.6 | Tests: `layoutConfig` accepts both seeded templates and rejects malformed ones | 20m | P1 | ✅ | `pnpm test` green |

## Phase 3 — Auth with database sessions (~6 h) · Day 1 ✅

Goal: phone + one-time code login, opaque session cookie, sessions stored in MongoDB (`tech-stack.md` §4), and a login screen based on the Superdesign draft.

**Login design (Superdesign draft `aa8ce61d`, v3) — build it with these fixes:**

| Draft shows | Build instead |
|---|---|
| Phone and code on one screen, separated by "অথবা" | Two steps: phone → code, with a fade between them (like the earlier *OTP Verification* draft `074aa68d`) |
| 4-digit code | 6-digit code (matches `tech-stack.md` §4.4); reviewer code is also 6 digits |
| "এই ফোন নম্বর নিবন্ধিত নয়" error | Not possible: the first login creates the account. Show the terms checkbox for a new number instead. Keep the red alert for real errors (wrong code, expired, too many attempts, rate limited) |
| One reviewer test number | Two: **free** and **premium**, each with a "ব্যবহার করুন" button that fills the phone field; panel shown only when `NEXT_PUBLIC_SHOW_REVIEWER_ACCESS=true` |
| "ডেভেলপার কোড" toggle | Shows `devCode` from the API, which is only returned when `OTP_DEV_MODE=true` |
| Fixed footer covers the "লগইন করুন" button on a 390×844 phone | Footer in normal page flow |
| "V0.5 DRAFT" badge, title "রাজনীতি পোস্টার মেকার" | No badge; use the app name "পোস্টার মেকার" everywhere |
| Font family written as `'Hind+Siliguri'` (falls back) | Hind Siliguri via `next/font` (already set up) |

Kept from the draft: dark navy header with shield icon and "সুরক্ষিত প্রবেশ", `+৮৮০` prefix inside the phone field, SMS hint text, emerald primary button, "কোডটি পাঠানো হয়েছে" confirmation, resend countdown, dark "লগইন করুন" button.

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 3.1 | `User` model: `phone` (unique), `isVerified`, `role`, `plan`, `planExpiresAt`, `acceptedTermsAt` | 20m | P0 | ✅ | Indexes created |
| 3.2 | `OtpCode` and `Session` models with TTL indexes; `Session.tokenHash` unique, `userId` indexed | 30m | P0 | ✅ | Indexes visible in Atlas |
| 3.3 | `SmsProvider` interface + `ConsoleSmsProvider`; OTP service: 6-digit `randomInt` code, SHA-256 + pepper, 5-min expiry, max 5 attempts, `timingSafeEqual`; reviewer free/premium phones + fixed 6-digit code from env | 60m | P0 | ✅ | Code appears in the console; wrong code 5× invalidates it |
| 3.4 | Session service: `create` (32-byte token, store hash), `validate` (checks `expiresAt > now`), sliding refresh throttled to once per 24 h, `destroy`, `destroyAllForUser` | 45m | P0 | ✅ | Unit tests for create/validate/expire pass |
| 3.5 | Routes: `otp/request` → `{ isNewUser, resendAfterSec, devCode? }`; `otp/verify` (upsert user, require terms when `isNewUser`, new session every login); `logout`; `me`. Errors as codes (`INVALID_PHONE`, `CODE_INVALID`, `CODE_EXPIRED`, `TOO_MANY_ATTEMPTS`, `RATE_LIMITED`, `TERMS_REQUIRED`). Cookie `HttpOnly; Secure; SameSite=Lax`; `trust proxy` | 45m | P0 | ✅ | Login through `localhost:3000` sets the cookie; `/me` returns the user |
| 3.6 | Middleware: `requireAuth` (loads user, applies premium expiry), `requireAdmin`, `originCheck` for non-GET requests | 30m | P0 | ✅ | Protected route without cookie → 401; wrong Origin → 403 |
| 3.7 | Web login components (from the draft): `AuthHeader`, `PhoneInput` (`+৮৮০` prefix, Bangla digits → ASCII, `1[3-9]XXXXXXXX` check), `OtpInput` (shadcn `InputOTP`, 6 boxes, paste, `autocomplete="one-time-code"`, numeric keyboard), `ResendTimer`, `ErrorAlert`; error code → Bangla message map | 45m | P0 | ✅ | Components render at 360 px and 390 px width with no overflow |
| 3.8 | Web login page `/login`: phone step → code step with fade, terms checkbox for new users, loading states, `useMe()` hook, redirect guard for protected pages, logout | 60m | P0 | ✅ | Full login and logout in the browser on mobile width |
| 3.9 | `ReviewerAccessCard`: free + premium test numbers with "ব্যবহার করুন", dev-code toggle showing `devCode`; hidden unless `NEXT_PUBLIC_SHOW_REVIEWER_ACCESS=true` | 30m | P0 | ✅ | A reviewer logs in as free and as premium using only what's on screen |
| 3.10 | `scripts/seed-users.ts`: reviewer **free** and **premium** accounts | 15m | P0 | ✅ | Both accounts log in with their test numbers |
| 3.11 | `POST /api/auth/logout-all` | 15m | P2 | ✅ | All sessions for the user deleted |
| 3.12 | Tests: OTP expiry/attempts/reviewer code; session cookie, expired or deleted session → 401 | 45m | P1 | ✅ | `pnpm test` green |

## Phase 4 — Uploads, face-aware crop & first deploy (~3.5 h) · Day 1 evening

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 4.1 | `GenerationLog` model (`posterId`, `model`, `stage`, `latencyMs`, `success`, `costEstimate`) | 15m | P1 | | Model exists |
| 4.2 | `POST /api/upload`: multer (memory, 10 MB, image MIME only) → sharp (min resolution, auto-rotate, strip EXIF/GPS) → Cloudinary `uploads/{userId}/` with authenticated delivery | 60m | P0 | | Phone photo uploads; too-small photo gets a Bangla error |
| 4.3 | Signed-URL helper for private assets (used by render and download) | 20m | P0 | | Signed URL loads; unsigned URL is refused |
| 4.4 | Gemini client (`@google/genai`) + face box: structured JSON, Zod-validated, timeout, center-crop fallback, log to `GenerationLog`; crop stored with the upload | 60m | P1 | | Off-center face ends up centered in the frame; with Gemini disabled, center crop is used |
| 4.5 | *(from 0.6)* Deploy the **API only** to Render with `render.yaml`; temporarily allow `/api/dev/render-test` there (env flag) to measure A3 time and memory; then turn it off | 45m | P0 | | A3 PNG from Render with correct conjuncts in < 30 s, no out-of-memory restart |

## Phase 5 — Generation end to end (~6.5 h) · Day 2 morning

Goal: **the minimum demo.** Form → generate → preview → download.

Design references in the same Superdesign project: *Expanded Template Library* (`6a21b930`) for 5.6, *Poster Editor* (`cb91cd05`) for 5.7–5.8, *Save & Publish Poster* (`d9ba6cf1`) for 5.8/8.2. Check each against the scope before building, as with the login draft.

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 5.1 | `Poster` model: `userId`, `templateId`, `formData`, `photos[]` (url + crop), `outputs`, `watermarked`, `status`, `renderVersion`, `editCount`, `errorMessage` | 30m | P0 | | Model exists, `{ userId, createdAt: -1 }` index |
| 5.2 | Poster form Zod schema in `shared` (name, পদবি, party, optional symbol, union/থানা/জেলা, occasion, headline, 3 photo slots with leader 2 optional) | 30m | P0 | | Same schema used by web form and API |
| 5.3 | `POST /api/posters`: validate → render 4:5 → upload to `posters/{userId}/` → save poster; status and Bangla error on failure | 90m | P0 | | API call returns a poster with a 4:5 URL in < 30 s |
| 5.4 | Watermark overlay for free-tier users; `watermarked` flag saved | 20m | P1 | | Free poster has watermark, premium poster doesn't |
| 5.5 | `GET /api/posters/:id` (owner only, else 404) and `GET /api/posters/:id/download?size=a3|social45`: render A3 on first request, cache URL in `outputs` | 60m | P0 | | A3 downloads at 3508×4961; another user's poster → 404 |
| 5.6 | Web: template picker page (thumbnails, occasion filter) | 45m | P0 | | Tapping a template opens the form |
| 5.7 | Web: poster form with 3 labeled photo slots, browser-side downscale, upload progress, previews, Bangla validation messages | 90m | P0 | | Form submits on a phone with real photos |
| 5.8 | Web: preview page with loading state, error + retry, download buttons (A3, 4:5) | 60m | P0 | | **Minimum demo path works on localhost** |
| 5.9 | `POST /api/posters/:id/regenerate`: edit text fields → re-render, `editCount++`, clear cached A3 | 45m | P1 | | Changed name appears in the re-rendered poster |

## Phase 6 — Quotas & tiers (~3 h) · Day 2

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 6.1 | `UsageCounter` model with unique `{ userId, date }` index | 15m | P1 | | Index exists |
| 6.2 | `dhakaDate()` helper using `Intl` with `Asia/Dhaka` + tests around 23:59/00:00 Dhaka | 20m | P1 | | Tests pass for 17:59/18:00 UTC |
| 6.3 | Quota service: atomic conditional `$inc` reserve, duplicate-key → "exceeded", `refund()`, limits by plan (free 3+2, premium 10+5) | 45m | P1 | | Unit tests for both plans pass |
| 6.4 | Wire into create and regenerate; refund when render or upload fails | 30m | P1 | | Failed render leaves the count unchanged |
| 6.5 | `/me` returns remaining quota; UI shows "আজ আর Nটি পোস্টার বানাতে পারবেন", limit message, "প্রিমিয়াম নিন" (coming soon) | 40m | P1 | | Remaining count updates after each poster |
| 6.6 | Concurrency test: 5 parallel requests at the limit never exceed it | 30m | P1 | | Test green |

## Phase 7 — Headline suggestions (~1.5 h) · Day 2

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 7.1 | `POST /api/headlines/suggest`: Gemini text, structured JSON with 3–5 Bangla headlines per occasion, Zod-validated, 20/day per user, logged | 45m | P1 | | Returns 3–5 suggestions in < 5 s; 21st call → 429 |
| 7.2 | Web: "AI পরামর্শ" button → suggestion chips that fill the editable headline field | 45m | P1 | | Picking a chip fills the field; user can still edit |

## Phase 8 — History & guardrails (~3.5 h) · Day 2

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 8.1 | `GET /api/posters/me` (paginated, newest first) | 30m | P1 | | Returns only the caller's posters |
| 8.2 | Web: history page with thumbnails and re-download | 60m | P1 | | Old poster downloads again without using quota |
| 8.3 | `DELETE /api/posters/:id`: delete Cloudinary poster and source photos (R8) | 30m | P2 | | Assets gone from Cloudinary |
| 8.4 | Rate limits: OTP request (per phone + IP), upload, generate, headlines | 20m | P1 | | Burst requests get 429 with a Bangla message |
| 8.5 | Blocklist service: static keyword list, normalized match (case, spaces, zero-width chars), applied to all text fields + tests | 45m | P1 | | Blocklisted term rejected with a clear Bangla message |
| 8.6 | Terms of use page (Bangla) linked from the login checkbox | 20m | P1 | | Page reachable from login |

## Phase 9 — Polish (~2.5 h) · Day 2 afternoon, before freeze

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 9.1 | Mobile UI pass on a real mid-range Android phone: spacing, tap targets, loading states | 90m | P1 | | Whole flow comfortable on the phone |
| 9.2 | Review all Bangla copy and error messages | 30m | P1 | | No English strings visible to users |
| 9.3 | Render tests: 60-char name/designation fit, conjunct sample renders without error | 30m | P1 | | `pnpm test` green |

**— Feature freeze 26 Sep 18:00 —**

## Phase 10 — Ship & submit (~4 h) · Day 2 evening

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 10.1 | Deploy web to Vercel (Root Directory `apps/web`, `API_ORIGIN` = Render URL); production env vars on Render (`APP_ORIGIN`, `DNS_SERVERS` not needed there), Atlas network access; confirm `/api/dev/*` is not mounted | 45m | P0 | | Production URL works in a private window |
| 10.2 | Run the acceptance checklist (`project-scope.md` §9) on a real phone; fix blockers only | 45m | P0 | | All P0 items pass; failures noted |
| 10.3 | README: what it is, architecture diagram, why Option B, why DB sessions, setup (`pnpm dev`, `.env.example`, `DNS_SERVERS` note), reviewer access (free/premium test numbers), quota rules, cut list, next steps | 90m | P0 | | A new reader can log in and run it locally |
| 10.4 | Commit 2–3 sample posters; record a 1–2 min demo video | 45m | P0 | | Files in repo; video link in README |
| 10.5 | Wake the Render backend, final smoke test, submit | 15m | P0 | | Submitted before 23:59 |

---

## After the deadline (not planned)

- Real SMS provider (depends on 0.7)
- 1:1 social export (1080×1080)
- Open question 1, option B: free text-only re-renders per poster
- Admin panel, moderation queue, PDF export, bulk/CSV, payments, campaign templates (see `project-scope.md` §4)
