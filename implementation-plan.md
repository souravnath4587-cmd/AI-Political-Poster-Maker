# Implementation Plan — AI Political Poster Maker

> Based on `project-scope.md` (v0.5) and `tech-stack.md`, 2026-09-25. Last updated 2026-09-25 (Phase 10: deployed on Vercel; video, phone check and submission left).
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
| 2 — Templates | ✅ 2 templates (বিজয় দিবস, শোক/স্মরণ) × 2 sizes, 1- and 2-leader variants, seeded to Atlas, `GET /api/templates`, 25 tests. AI backgrounds (2.3) not done; CSS gradients in use (the Gemini key is now set, so 2.3 is unblocked). | `0604018` |
| 3 — Auth | ✅ Phone + one-time code, DB sessions (hashed token, httpOnly cookie, sliding expiry), Origin check, reviewer free/premium logins, `/login` from the Superdesign draft with its fixes, 61 tests + browser run at 390 px. | `a95009b` |
| 4 — Uploads | 4.1–4.3 ✅: `POST /api/upload` (sharp: real-format check, EXIF rotation, metadata stripped, size rules + low-res warning), private Cloudinary storage with signed URLs (unsigned/altered → 401), verified against the real account; Chromium renders the private photos. 4.4 ✅ face detection verified with the real key: `gemini-3.1-flash-lite` (prompt limited to the face, “do not guess”, confidence ≥ 0.6) with `gemini-3.8-flash` as busy fallback, 10 s budget, default crop on any failure. 4.5 deploy waiting for a decision. 76 tests. | `d4aeb87`, `1388a30` |
| 5 — Generation | ✅ **Minimum demo works on localhost**, verified end to end in headless Chrome at 390 px: login → dashboard → form (validation, 3 uploads in ~5 s with face detection) → poster in ~7 s → A3 download 3508×4961 @300 DPI (~19 s first time) → edit + regenerate → history. API: create/read/list/download/regenerate with owner-only access, photo ownership + kind checks, watermark for free users, A3 rendered on first download and cached, `?format=json` download links; 57 API tests. Web: dashboard, poster form (photo slots with progress, face badge, low-res warning), result page with downloads and text editing. | `b426595` |
| 6 — Quotas | ✅ Free 3 posters + 2 regenerations/day, premium 10 + 5, reset at Dhaka midnight (18:00 UTC). Counter created first, then one conditional `$inc` below the limit (no race on the first request of the day); reserve-then-refund around render/save, so failed renders and invalid input cost nothing; re-downloads free. `GET /api/quota`; quota card on dashboard, form (submit blocked at the limit) and result page. 83 tests incl. 5 and 6 parallel requests. | `6e9a6f6` |
| 7 — Headlines | ✅ `POST /api/headlines/suggest`: 3–5 short Bangla headlines per occasion, using what the user typed (organization, area, names); party-neutral, respectful, no anniversary numbers; cleaned (Bangla only, ≤ 60 chars, no duplicates). 20/day per user through the Phase 6 quota system, refunded on failure; logged. Web: “এআই পরামর্শ” chips under the headline on the form and the edit panel. Real Gemini: 5 suggestions in ~2–3 s. 109 tests. | `8c4e924` |
| 8 — History & guardrails | ✅ History page with paging (`?before=` cursor), A3/4:5 downloads and in-card delete confirmation; `DELETE /api/posters/:id` removes the poster, its images and source photos no other poster uses. Rate limits (in-memory, per IP / phone / session) on login codes, code checks, uploads, poster writes and suggestions. Keyword blocklist on poster text, suggestion context and suggestions; the form marks the field. Terms page finalized. 132 tests; checked in the browser. | `153119d` |
| 9 — Polish | ✅ except the real-phone check. Emulated phone pass at 360×780 with touch on every page: no sideways scrolling, every tap target ≥ 40 px (13 were smaller: back arrow, logout, reviewer buttons, inline links, suggestion chips, history buttons…). No English visible to users; Bangla messages for every API error code. Render checks now in `pnpm test` with real Chromium (2 templates × 2 sizes × 3 variants + page leaks). Free reviewer account emptied of test data. 145 tests. | `d967842` |
| 10 — Ship & submit | **Deployed on Vercel** (owner's choice, no Render): web `poster-maker-web.vercel.app`, API `poster-maker-api.vercel.app` (Express as one function, `@sparticuz/chromium`, region `sin1`, 60 s limit). Verified live: health + DB, `/api/dev` hidden, reviewer login → 2 uploads (~6 s each with face detection) → poster in 7 s incl. Chromium cold start → A3 3508×4961 @300 DPI (3.6 MB) in 6.5 s → delete. README updated with the live URL and deploy steps. **Waiting for the owner:** demo video, real-phone check, submission. | `4e450f4`, `d31b5e6` |

**Open decisions and follow-ups:**
- **API hosting (4.5):** ✅ resolved by moving the API to Vercel: A3 renders in ~6.5 s within the function limits.
- **Blocklist review:** the starting list in `apps/api/src/services/blocklist.ts` needs the owner's review (project-scope open question 2).
- **Test data:** ✅ the free reviewer account (01999000001) is empty. The premium reviewer account (01999000002) has one poster (“Jhone China”) and 6 uploads that were not made by the automated tests; they were left for the owner to keep or delete. One other user exists in the database (also left as is).
- **Real-phone check (9.1):** the phone pass was emulated in Chrome; try the whole flow once on a real mid-range Android phone before submitting.
- **Flaky test run:** one workspace test run failed once and couldn't be reproduced in 5 later runs (output not captured); likely memory pressure on the dev machine. If it recurs, capture the output.
- **Gemini key:** ✅ set. Face detection and headline suggestions use it; AI backgrounds (2.3) could now be done.

**Dashboard, form and result designs** (Superdesign drafts `6a21b930`, `cb91cd05`, `d9ba6cf1`) were reviewed against the scope and built with these changes:
- Dashboard: only the real templates from the API, with their rendered 4:5 thumbnails in a 2-column grid (not 5 categories with stock photos); neutral “স্বাগতম” greeting with plan badge; premium banner for free users marked “শীঘ্রই আসছে” (premium is 10/day, not unlimited); history from `GET /api/posters/me` with an empty state; no reviewer footer or “V0.5 DRAFT” badge; quota card added in Phase 6.
- Form: template chosen on the dashboard (shown compact with “পরিবর্তন করুন”), leader name fields added in a collapsible section, no separate preview step.
- Result page: no project name or public/private switch (public sharing is out of scope); A3 and 4:5 downloads plus text editing instead.

**Decisions made while building (not in the original plan):**

*Setup and development*
- **Localhost first.** Deploying to Render/Vercel is postponed. `pnpm dev` starts db + api + web; a local MongoDB (the `mongodb-memory-server` binary) starts only when `MONGODB_URI` points at localhost. Atlas is configured in `apps/api/.env`.
- **`DNS_SERVERS`** (optional env): Node on this machine can't resolve `mongodb+srv://` through the local DNS proxy (`querySrv ECONNREFUSED`), so it's set to `8.8.8.8,1.1.1.1`.
- **API dev runs on `node --watch --import tsx`**. `tsx watch` hung silently under `concurrently` on Windows.
- **Dev servers:** if `pnpm dev` is stopped abruptly, `next dev` can be left running and holding port 3000; the next `pnpm dev` then silently serves from the old process. Stop leftover `node` processes before restarting.
- **API tests run in worker threads, 2 at a time:** with child processes, Node on Windows sometimes aborted at process exit (0xC0000409, a libuv handle-closing assertion), and each file starts its own MongoDB.
- **Docker base** is `node:24-slim` + Chrome via `puppeteer browsers install chrome --install-deps` (keeps Chrome matched to the locked Puppeteer version).

*Rendering and templates*
- **Fonts** live in `apps/api/assets/fonts` and are inlined as data URIs; a render fails if a required font doesn't load.
- **Text fitting measures lines × line-height**, not `scrollHeight`: Bangla glyph areas are taller than a tight line-height and caused false overflow.
- **Template thumbnails** are rendered by `pnpm --filter @app/api templates:thumbnails` into `apps/api/assets/thumbnails` (committed) and served at `/api/templates/thumbnails/<slug>.webp`, so the template picker doesn't depend on Cloudinary.

*Login*
- **Login UI** follows the Superdesign draft *Auth Screen with Navigation and Smooth Transitions* (`aa8ce61d-ceae-4d3e-8d35-065c1c2eb587`, v3) with the fixes listed under Phase 3.
- **Login options come from the API** (`GET /api/auth/options`: reviewer numbers, dev mode) instead of a `NEXT_PUBLIC_SHOW_REVIEWER_ACCESS` flag, so the API env is the single switch.
- **Reviewer logins:** `01999000001` (free) and `01999000002` (premium), code `123456`, seeded by `pnpm --filter @app/api seed:users`.

*AI (Gemini)*
- **Models:** `gemini-2.5-flash` is closed to new API keys (404), and `gemini-3.8-flash` often answers 503 “high demand” or hangs. Both face detection and headline suggestions therefore try `GEMINI_VISION_MODEL=gemini-3.1-flash-lite` first (≈2–4 s, reliable, good Bangla) and fall back to `GEMINI_MODEL=gemini-3.8-flash`.
- **One helper** (`services/gemini.ts`) makes every Gemini call: structured JSON, model fallback within a time budget.
- **Face crop fallback:** when Gemini is busy, the default center crop is used; for photos with the person far off-center this can frame the background. A manual “move the crop” control would fix it (see after the deadline).
- **Headline length:** the prompt asks for ≤ 40 characters, but up to 60 are accepted, since Bangla vowel signs count as characters and natural 5–6 word headlines run 41–50.

*Deployment*
- **Everything on Vercel (owner's choice):** the API runs as one Vercel function (`apps/api/api/index.js` → `dist/vercel.js`, built by `tsup` so Vercel never compiles our TypeScript itself; its own compile broke on helmet's CJS types, TS2349). Chromium comes from `@sparticuz/chromium` 153 when `VERCEL` is set. `render.yaml`/Dockerfile are kept as the alternative. `vercel link` writes a root `.env.local` with production secrets and edits `.gitignore`: delete/revert both after linking.
- **Empty settings count as unset:** `KEY=` lines copied from `.env.example` are ignored instead of failing validation (an empty `OTP_PEPPER=` had stopped the API from starting).
- **`render.yaml` holds every non-secret setting**; secrets are entered in the Render dashboard, and Render generates `OTP_PEPPER`.
- ~~`OTP_DEV_MODE=true` in production~~ **Replaced after the deadline (2026-09-26):** real SMS through BulkSMSBD, and the API refuses to start in production with `OTP_DEV_MODE=true`. Before deploying: set `OTP_DEV_MODE=false` and the `BULKSMSBD_*` keys in the Vercel project, keep IP whitelisting off in the BulkSMSBD panel, and run `db:sync-otp-indexes` once against Atlas.
- **`API_ORIGIN` must be set in Vercel before the first build:** the `/api` rewrite is compiled into the build.
- **Sample posters use the placeholder silhouettes**, not photos of real people, so the repo never shows a real person on a political poster.

*Quotas and guardrails*
- **Quota counts come from `GET /api/quota`**, not `/auth/me` as planned: `/me` is cached for session checks, while the counts change after every poster.
- **Blocklist** (`apps/api/src/services/blocklist.ts`) is a small starting list: militant organizations banned in Bangladesh (also caught when spaced out letter by letter) and violent commands (whole words only, so mourning text like “হত্যা করা হয়েছে” passes). No political parties. The owner should review it (open question 2).
- **Login-code hardening (after the deadline, 2026-09-26):** codes keep a `status` (`pending`/`verified`/`superseded`/`failed`) instead of being deleted, live `OTP_TTL_SEC` (180 s, owner chose 3 min over 1 min because BD SMS can take 30–60 s), 60 s resend cooldown (race-safe), 5 codes per phone and 20 per IP per hour counted in MongoDB (holds across Vercel instances). `otp/request` no longer returns `isNewUser` (it let anyone check whether a number has an account); a new number learns it needs the terms only after a correct code (`TERMS_REQUIRED`, code stays usable). Database outages answer 503 `SERVICE_UNAVAILABLE`.
- **Rate limits** (per API instance, in memory): code requests 20/h per IP and 5/h per phone (reviewer numbers exempt), code checks 30/15 min per IP, uploads 40/10 min, poster writes 30/10 min, suggestions 10/min per session. Off in tests except `rateLimits.test.ts`.
- **History is paged by poster `_id`** (index `{ userId, _id }`), which grows with creation time.

## Time budget

| | Planned | Done | Left |
|---|---|---|---|
| P0 | ~27 h | Phases 0–8 except 4.5 | **~5 h**: API deploy (4.5, 45m) and ship & submit (Phase 10, ~4 h) |
| P1 | ~15 h | Everything except 2.3 | Real-phone check (~15m); AI backgrounds (2.3, 45m) optional |
| P2 | ~1 h | 3.11, 8.3 | SMS signup (0.7): after the deadline |

All planned MVP features are built and tested on localhost. What's left is deployment and submission, in this order: **4.5 + 10.1 (deploy) → 10.2–10.5 (check on a real phone, README, video, submit)**. Do 2.3 only if time is left after the README.

| Checkpoint | Target time | If behind |
|---|---|---|
| Render pipeline works (end of Phase 1) | 25 Sep, 14:00 | ✅ Locally. Render check moved to 4.5. |
| Auth + uploads done, **API running on Render** (end of Phase 4) — ✅ locally, Render deploy still open | 25 Sep, 23:00 | Drop face crop (4.4) → center crop only. If Render can't render A3 in 512 MB, move to the Starter plan now, not on Day 2. |
| **Minimum demo works** (end of Phase 5) — ✅ locally | 26 Sep, 11:00 | Drop Phase 7 (headlines) and all P2 tasks |
| Feature freeze — all MVP features done; only polish left | 26 Sep, 18:00 | Ship what works; list the rest in the README |
| **Deployed and submitted** (end of Phase 10) | 26 Sep, 23:59 | Submit the localhost demo video and README if the deploy fails |

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
| 2.3 | `scripts/generate-backgrounds.ts`: Gemini image model → background per template and size → upload to Cloudinary `templates/` | 45m | P1 | ⏸ | 2 backgrounds (plus sizes) uploaded and committed as assets/URLs. *Fallback: hand-made gradient backgrounds* (in use). Gemini key now set, so this is unblocked but not done. |
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

## Phase 4 — Uploads, face-aware crop & first deploy (~3.5 h) · Day 1 evening ✅ (except 4.5)

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 4.1 | `GenerationLog` model (`posterId`, `model`, `stage`, `latencyMs`, `success`, `costEstimate`) | 15m | P1 | ✅ | Model exists |
| 4.2 | `POST /api/upload`: multer (memory, 10 MB, image MIME only) → sharp (min resolution, auto-rotate, strip EXIF/GPS) → Cloudinary `uploads/{userId}/` with authenticated delivery | 60m | P0 | ✅ | Phone photo uploads; too-small photo gets a Bangla error |
| 4.3 | Signed-URL helper for private assets (used by render and download) | 20m | P0 | ✅ | Signed URL loads; unsigned URL is refused |
| 4.4 | Gemini client (`@google/genai`) + face box: structured JSON, Zod-validated, timeout, center-crop fallback, log to `GenerationLog`; crop stored with the upload | 60m | P1 | ✅ | Off-center face ends up centered in the frame; with Gemini disabled, center crop is used |
| 4.5 | *(from 0.6)* Deploy the **API only** to Render with `render.yaml`; temporarily allow `/api/dev/render-test` there (env flag) to measure A3 time and memory; then turn it off | 45m | P0 | ✅ | A3 PNG from Render with correct conjuncts in < 30 s, no out-of-memory restart. *Done on Vercel instead: A3 in 6.5 s.* |

## Phase 5 — Generation end to end (~6.5 h) · Day 2 morning ✅

Goal: **the minimum demo.** Form → generate → preview → download.

Design references in the same Superdesign project: *Expanded Template Library* (`6a21b930`) for 5.6, *Poster Editor* (`cb91cd05`) for 5.7–5.8, *Save & Publish Poster* (`d9ba6cf1`) for 5.8/8.2. Check each against the scope before building, as with the login draft.

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 5.1 | `Poster` model: `userId`, `templateId`, `formData`, `photos[]` (url + crop), `outputs`, `watermarked`, `status`, `renderVersion`, `editCount`, `errorMessage` | 30m | P0 | ✅ | Model exists, `{ userId, _id: -1 }` index (history paging) |
| 5.2 | Poster form Zod schema in `shared` (name, পদবি, party, optional symbol, union/থানা/জেলা, occasion, headline, 3 photo slots with leader 2 optional) | 30m | P0 | ✅ | Same schema used by web form and API |
| 5.3 | `POST /api/posters`: validate → render 4:5 → upload to `posters/{userId}/` → save poster; status and Bangla error on failure | 90m | P0 | ✅ | API call returns a poster with a 4:5 URL in < 30 s |
| 5.4 | Watermark overlay for free-tier users; `watermarked` flag saved | 20m | P1 | ✅ | Free poster has watermark, premium poster doesn't |
| 5.5 | `GET /api/posters/:id` (owner only, else 404) and `GET /api/posters/:id/download?size=a3` (or `social45`): render A3 on first request, cache URL in `outputs` | 60m | P0 | ✅ | A3 downloads at 3508×4961; another user's poster → 404 |
| 5.6 | Web: template picker page (thumbnails, occasion filter) | 45m | P0 | ✅ | Tapping a template opens the form |
| 5.7 | Web: poster form with 3 labeled photo slots, browser-side downscale, upload progress, previews, Bangla validation messages | 90m | P0 | ✅ | Form submits on a phone with real photos |
| 5.8 | Web: preview page with loading state, error + retry, download buttons (A3, 4:5) | 60m | P0 | ✅ | **Minimum demo path works on localhost** |
| 5.9 | `POST /api/posters/:id/regenerate`: edit text fields → re-render, `editCount++`, clear cached A3 | 45m | P1 | ✅ | Changed name appears in the re-rendered poster |

## Phase 6 — Quotas & tiers (~3 h) · Day 2 ✅

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 6.1 | `UsageCounter` model with unique `{ userId, date }` index | 15m | P1 | ✅ | Index exists |
| 6.2 | `dhakaDate()` helper using `Intl` with `Asia/Dhaka` + tests around 23:59/00:00 Dhaka | 20m | P1 | ✅ | Tests pass for 17:59/18:00 UTC |
| 6.3 | Quota service: atomic conditional `$inc` reserve, duplicate-key → "exceeded", `refund()`, limits by plan (free 3+2, premium 10+5) | 45m | P1 | ✅ | Unit tests for both plans pass |
| 6.4 | Wire into create and regenerate; refund when render or upload fails | 30m | P1 | ✅ | Failed render leaves the count unchanged |
| 6.5 | `GET /api/quota` returns today's usage (not `/me`, which is cached); UI shows "আজ আর Nটি পোস্টার বানাতে পারবেন", limit message, "প্রিমিয়াম নিন" (coming soon) | 40m | P1 | ✅ | Remaining count updates after each poster |
| 6.6 | Concurrency test: 5 parallel requests at the limit never exceed it | 30m | P1 | ✅ | Test green |

## Phase 7 — Headline suggestions (~1.5 h) · Day 2 ✅

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 7.1 | `POST /api/headlines/suggest`: Gemini text, structured JSON with 3–5 Bangla headlines per occasion, Zod-validated, 20/day per user, logged | 45m | P1 | ✅ | Returns 3–5 suggestions in < 5 s; 21st call → 429 |
| 7.2 | Web: "AI পরামর্শ" button → suggestion chips that fill the editable headline field | 45m | P1 | ✅ | Picking a chip fills the field; user can still edit |

## Phase 8 — History & guardrails (~3.5 h) · Day 2 ✅

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 8.1 | `GET /api/posters/me` (paginated, newest first) | 30m | P1 | ✅ | Returns only the caller's posters |
| 8.2 | Web: history page with thumbnails and re-download | 60m | P1 | ✅ | Old poster downloads again without using quota |
| 8.3 | `DELETE /api/posters/:id`: delete Cloudinary poster and source photos (R8) | 30m | P2 | ✅ | Assets gone from Cloudinary |
| 8.4 | Rate limits: OTP request (per phone + IP), upload, generate, headlines | 20m | P1 | ✅ | Burst requests get 429 with a Bangla message |
| 8.5 | Blocklist service: static keyword list, normalized match (case, spaces, zero-width chars), applied to all text fields + tests | 45m | P1 | ✅ | Blocklisted term rejected with a clear Bangla message |
| 8.6 | Terms of use page (Bangla) linked from the login checkbox | 20m | P1 | ✅ | Page reachable from login |

## Phase 9 — Polish (~2.5 h) · Day 2 afternoon, before freeze ✅ (real-phone check open)

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 9.1 | Mobile UI pass on a real mid-range Android phone: spacing, tap targets, loading states | 90m | P1 | ✅ | Whole flow comfortable on the phone. *Done emulated (360×780, touch); a check on a real phone is still open.* |
| 9.2 | Review all Bangla copy and error messages | 30m | P1 | ✅ | No English strings visible to users |
| 9.3 | Render tests in `pnpm test`: the `render:sample` checks (exact sizes, 60-char name/designation fit, no overflow, no leaked pages) already run as a script; move them into Vitest with real Chromium | 30m | P1 | ✅ | `pnpm test` green |
| 9.4 | Delete the end-to-end test posters and uploads from the free reviewer account (01999000001), in Atlas and Cloudinary | 10m | P1 | ✅ | Reviewer account history is empty |

**— Feature freeze 26 Sep 18:00 —**

## Phase 10 — Ship & submit (~4 h) · Day 2 evening — in progress

| ID | Task | Est | Pri | Status | Done when |
|---|---|---|---|---|---|
| 10.1 | Deploy web to Vercel (Root Directory `apps/web`, `API_ORIGIN` = Render URL). Render env: `APP_ORIGIN`, `MONGODB_URI`, Cloudinary keys, `OTP_PEPPER`, reviewer numbers + code, `GEMINI_API_KEY` (+ model names), `CHROME_NO_SANDBOX=true`; decide `OTP_DEV_MODE` (needed for non-reviewer logins without an SMS provider, but lets anyone log in as any number). `DNS_SERVERS` not needed there. Seed templates and reviewer users on the production database; Atlas network access; confirm `/api/dev/*` is not mounted | 45m | P0 | ✅ | Production URL works in a private window. *Both apps on Vercel (API as a function, not Render); Atlas data already seeded.* |
| 10.2 | Run the acceptance checklist (`project-scope.md` §9) on a real phone; fix blockers only | 45m | P0 | | All P0 items pass; failures noted |
| 10.3 | README: what it is, architecture diagram, why Option B, why DB sessions, setup (`pnpm dev`, `.env.example`, `DNS_SERVERS` note), reviewer access (free/premium test numbers), quota rules, cut list, known limitations (starting blocklist, in-memory rate limits for one instance, face-crop fallback, dev-mode logins), next steps | 90m | P0 | ✅ | A new reader can log in and run it locally. *Live URL and video link still to be added.* |
| 10.4 | Commit 2–3 sample posters; record a 1–2 min demo video | 45m | P0 | | Files in repo; video link in README. *Samples ✅ in `docs/samples` (placeholder photos, no real people); video pending.* |
| 10.5 | Wake the Render backend, final smoke test, submit | 15m | P0 | | Submitted before 23:59 |

---

## After the deadline (not planned)

- ~~Real SMS provider (depends on 0.7)~~ Done: BulkSMSBD (sender ID approval needed before it sends)
- 1:1 social export (1080×1080)
- Open question 1, option B: free text-only re-renders per poster
- Admin panel, moderation queue, PDF export, bulk/CSV, payments, campaign templates (see `project-scope.md` §4)
- Manual “move the crop” control for photos where face detection fails
- Shared rate-limit store (e.g. Redis) once there is more than one API instance
- Cleanup job for uploads that were never used in a poster
- Blocklist managed by an admin instead of a code file
- AI backgrounds (2.3), if not done before the deadline
- ~~Third template~~ Done: স্বাধীনতা দিবস (`independence-day`, occasion `national_day`, 4:5 + A3, 1 or 2 leaders); shared layout pieces moved to `templates/parts.ts` (বিজয় দিবস output unchanged). Seed it only after the API that knows `national_day` is deployed
- More templates (2026-09-26): শহীদ দিবস — ২১শে ফেব্রুয়ারি (`ekushe-february`, Shaheed Minar on a light paper background), ঈদ মোবারক (`eid-mubarak`, `festival`, crescent/lanterns/mosque skyline at night) and শুভ নববর্ষ (`pohela-boishakh`, `greeting`, scalloped red banner and alpona). Six templates in all, each at 4:5 and A3 with 1 or 2 leaders; 4:5 samples in `docs/samples`. Seeded to the local database only
