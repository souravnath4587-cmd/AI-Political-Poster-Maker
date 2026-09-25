# Implementation Plan — AI Political Poster Maker

> Based on `project-scope.md` (v0.5) and `tech-stack.md`, 2026-09-25.
> Deadline: **2026-09-26 23:59**, one developer. **Feature freeze: 2026-09-26 18:00.**

## How to read this plan

- **Tasks are small** (15–90 min). Each ends in one commit with a clear message.
- **Priority**
  - **P0:** needed for the *absolute minimum demo*: login → pick template → form + 3 photos → A3 PNG with correct Bangla → download.
  - **P1:** the rest of the MVP in the scope document.
  - **P2:** cut first if behind schedule.
- **Done when:** the check that closes the task. Don't start the next task until it passes.
- Phases run in order. Inside a phase, tasks run top to bottom unless marked *(parallel)*.

## Time budget

| | Hours |
|---|---|
| P0 tasks | ~26 h |
| P0 + P1 | ~41 h |
| All (incl. P2) | ~42 h |

P0 + P1 is more than the realistic working time left in the ~46 h after sleep. Plan to finish **all P0 plus as much P1 as fits**, in this order: quotas → watermark → history → blocklist/rate limits → headlines → face crop. Use the checkpoints below to decide what to cut.

| Checkpoint | Target time | If behind |
|---|---|---|
| Render pipeline works on Render (end of Phase 1) | 25 Sep, 14:00 | Stop and fix. Everything depends on it. |
| Auth + uploads done (end of Phase 4) | 25 Sep, 23:00 | Drop face crop (4.4) → center crop only |
| **Minimum demo works** (end of Phase 5) | 26 Sep, 11:00 | Drop Phase 7 (headlines) and all P2 tasks |
| Feature freeze | 26 Sep, 18:00 | Ship what works; list the rest in the README |

---

## Phase 0 — Foundation & early deploy (~3 h) · Day 1 morning

Goal: an empty app that deploys end to end, so hosting problems show up on day one (R3).

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 0.1 | Init pnpm workspace: root `package.json`, `pnpm-workspace.yaml`, base `tsconfig`, ESLint, Prettier, `.gitignore`, `.env.example` | 30m | P0 | `pnpm -r lint` runs clean |
| 0.2 | `packages/shared`: Zod dependency, build/exports config, one sample schema used by both apps | 20m | P0 | Both apps import from `@app/shared` |
| 0.3 | `apps/api`: Express 5, `tsx` dev script, helmet, pino-http, error handler, Zod-validated env, `GET /api/health` | 40m | P0 | `curl localhost:4000/api/health` → 200 |
| 0.4 | `apps/web`: Next.js App Router, Tailwind v4, shadcn/ui init, Hind Siliguri + Noto Serif Bengali via `next/font`, `/api/*` rewrite to `API_ORIGIN` | 40m | P0 | Home page shows Bangla text; `/api/health` works through the rewrite |
| 0.5 | Create MongoDB Atlas M0 cluster and Cloudinary account; `config/db.ts`, `config/cloudinary.ts` | 20m | P0 | API logs "Mongo connected" on boot |
| 0.6 | `apps/api/Dockerfile` (`node:24-slim` + Chrome via `puppeteer browsers install --install-deps`), `render.yaml`; deploy API to Render, web to Vercel | 45m | P0 | Vercel URL `/api/health` → 200 from Render |
| 0.7 | *(parallel)* Start SMS provider signup (Twilio Verify / BD gateway) so approval runs in the background | 10m | P2 | Signup submitted |

## Phase 1 — Render pipeline spike (~3 h) · Day 1

Goal: prove the riskiest part first. Correct Bangla conjuncts in an A3 PNG, rendered on Render.

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 1.1 | Bundle OFL fonts in `render/fonts`; hard-coded HTML poster containing "সংগ্রাম", "শ্রদ্ধাঞ্জলি", "ক্ষ", "ন্ত্র" | 45m | P0 | HTML looks right in local Chrome |
| 1.2 | `services/render.ts`: one shared browser, new page per render, page closed in `finally`, concurrency limit 1–2 | 45m | P0 | 10 renders in a row with no leaked pages or growing memory |
| 1.3 | Export 4:5 (1080×1350) and A3 (3508×4961 via `deviceScaleFactor`); temporary `/api/dev/render-test` route; measure time and memory on Render | 45m | P0 | A3 PNG downloaded from Render, conjuncts correct, render < 30 s |
| 1.4 | In-page text fitting: shrink font until text fits the slot's box and max lines (R5) | 45m | P1 | 60-char name fits without overflow |

## Phase 2 — Templates & layoutConfig (~4 h) · Day 1

Goal: the two templates exist in the database and render from data, not hard-coded HTML.

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 2.1 | `layoutConfig` Zod schema in `shared`: slots per output size, text rules (font, min/max size, max lines, align), frame shape, optional slot, color tokens, background per size | 60m | P0 | Schema compiles; one example config passes |
| 2.2 | `Template` Mongoose model (`title`, `occasionType`, `thumbnailUrl`, `layoutConfig`, `isActive`) | 20m | P0 | Model saves a validated config |
| 2.3 | `scripts/generate-backgrounds.ts`: Gemini image model → background per template and size → upload to Cloudinary `templates/` | 45m | P1 | 2 backgrounds (plus sizes) uploaded and committed as assets/URLs. *Fallback: hand-made gradient backgrounds.* |
| 2.4 | HTML builder: `layoutConfig` + form data (escaped) + photo URLs → HTML string; author বিজয় দিবস and শোক/স্মরণ configs for 4:5 and A3 | 90m | P0 | Both templates render with sample data in both sizes |
| 2.5 | `scripts/seed-templates.ts`; `GET /api/templates` (filter by occasion) and `GET /api/templates/:id` | 30m | P0 | Seed runs twice without duplicates; endpoints return 2 templates |
| 2.6 | Tests: `layoutConfig` accepts both seeded templates and rejects malformed ones | 20m | P1 | `pnpm test` green |

## Phase 3 — Auth with database sessions (~5 h) · Day 1

Goal: phone + one-time code login, opaque session cookie, sessions stored in MongoDB (`tech-stack.md` §4).

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 3.1 | `User` model: `phone` (unique), `isVerified`, `role`, `plan`, `planExpiresAt`, `acceptedTermsAt` | 20m | P0 | Indexes created |
| 3.2 | `OtpCode` and `Session` models with TTL indexes; `Session.tokenHash` unique, `userId` indexed | 30m | P0 | Indexes visible in Atlas |
| 3.3 | `SmsProvider` interface + `ConsoleSmsProvider`; OTP service: `randomInt` code, SHA-256 + pepper, 5-min expiry, max 5 attempts, `timingSafeEqual`; reviewer phone/code from env | 60m | P0 | Code appears in the console; wrong code 5× invalidates it |
| 3.4 | Session service: `create` (32-byte token, store hash), `validate` (checks `expiresAt > now`), sliding refresh throttled to once per 24 h, `destroy`, `destroyAllForUser` | 45m | P0 | Unit tests for create/validate/expire pass |
| 3.5 | Routes: `otp/request`, `otp/verify` (upsert user, require terms on first login, new session every login), `logout`, `me`; cookie `HttpOnly; Secure; SameSite=Lax`; `trust proxy` | 45m | P0 | Login through the Vercel URL sets the cookie; `/me` returns the user |
| 3.6 | Middleware: `requireAuth` (loads user, applies premium expiry), `requireAdmin`, `originCheck` for non-GET requests | 30m | P0 | Protected route without cookie → 401; wrong Origin → 403 |
| 3.7 | Web: login page (phone → code steps), terms checkbox, `useMe()` hook, redirect guard for protected pages | 60m | P0 | Full login and logout in the browser on mobile width |
| 3.8 | `scripts/seed-users.ts`: reviewer **free** and **premium** accounts | 15m | P0 | Both accounts log in with the test number(s) |
| 3.9 | `POST /api/auth/logout-all` | 15m | P2 | All sessions for the user deleted |
| 3.10 | Tests: OTP expiry/attempts/reviewer code; session cookie, expired or deleted session → 401 | 45m | P1 | `pnpm test` green |

## Phase 4 — Uploads & face-aware crop (~2.5 h) · Day 1 evening

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 4.1 | `GenerationLog` model (`posterId`, `model`, `stage`, `latencyMs`, `success`, `costEstimate`) | 15m | P1 | Model exists |
| 4.2 | `POST /api/upload`: multer (memory, 10 MB, image MIME only) → sharp (min resolution, auto-rotate, strip EXIF/GPS) → Cloudinary `uploads/{userId}/` with authenticated delivery | 60m | P0 | Phone photo uploads; too-small photo gets a Bangla error |
| 4.3 | Signed-URL helper for private assets (used by render and download) | 20m | P0 | Signed URL loads; unsigned URL is refused |
| 4.4 | Gemini client (`@google/genai`) + face box: structured JSON, Zod-validated, timeout, center-crop fallback, log to `GenerationLog`; crop stored with the upload | 60m | P1 | Off-center face ends up centered in the frame; with Gemini disabled, center crop is used |

## Phase 5 — Generation end to end (~6.5 h) · Day 2 morning

Goal: **the minimum demo.** Form → generate → preview → download.

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 5.1 | `Poster` model: `userId`, `templateId`, `formData`, `photos[]` (url + crop), `outputs`, `watermarked`, `status`, `renderVersion`, `editCount`, `errorMessage` | 30m | P0 | Model exists, `{ userId, createdAt: -1 }` index |
| 5.2 | Poster form Zod schema in `shared` (name, পদবি, party, optional symbol, union/থানা/জেলা, occasion, headline, 3 photo slots with leader 2 optional) | 30m | P0 | Same schema used by web form and API |
| 5.3 | `POST /api/posters`: validate → render 4:5 → upload to `posters/{userId}/` → save poster; status and Bangla error on failure | 90m | P0 | API call returns a poster with a 4:5 URL in < 30 s |
| 5.4 | Watermark overlay for free-tier users; `watermarked` flag saved | 20m | P1 | Free poster has watermark, premium poster doesn't |
| 5.5 | `GET /api/posters/:id` (owner only, else 404) and `GET /api/posters/:id/download?size=a3|45`: render A3 on first request, cache URL in `outputs` | 60m | P0 | A3 downloads at 3508×4961; another user's poster → 404 |
| 5.6 | Web: template picker page (thumbnails, occasion filter) | 45m | P0 | Tapping a template opens the form |
| 5.7 | Web: poster form with 3 labeled photo slots, browser-side downscale, upload progress, previews, Bangla validation messages | 90m | P0 | Form submits on a phone with real photos |
| 5.8 | Web: preview page with loading state, error + retry, download buttons (A3, 4:5) | 60m | P0 | **Minimum demo path works on the deployed URL** |
| 5.9 | `POST /api/posters/:id/regenerate`: edit text fields → re-render, `editCount++`, clear cached A3 | 45m | P1 | Changed name appears in the re-rendered poster |

## Phase 6 — Quotas & tiers (~3 h) · Day 2

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 6.1 | `UsageCounter` model with unique `{ userId, date }` index | 15m | P1 | Index exists |
| 6.2 | `dhakaDate()` helper using `Intl` with `Asia/Dhaka` + tests around 23:59/00:00 Dhaka | 20m | P1 | Tests pass for 17:59/18:00 UTC |
| 6.3 | Quota service: atomic conditional `$inc` reserve, duplicate-key → "exceeded", `refund()`, limits by plan (free 3+2, premium 10+5) | 45m | P1 | Unit tests for both plans pass |
| 6.4 | Wire into create and regenerate; refund when render or upload fails | 30m | P1 | Failed render leaves the count unchanged |
| 6.5 | `/me` returns remaining quota; UI shows "আজ আর Nটি পোস্টার বানাতে পারবেন", limit message, "প্রিমিয়াম নিন" (coming soon) | 40m | P1 | Remaining count updates after each poster |
| 6.6 | Concurrency test: 5 parallel requests at the limit never exceed it | 30m | P1 | Test green |

## Phase 7 — Headline suggestions (~1.5 h) · Day 2

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 7.1 | `POST /api/headlines/suggest`: Gemini text, structured JSON with 3–5 Bangla headlines per occasion, Zod-validated, 20/day per user, logged | 45m | P1 | Returns 3–5 suggestions in < 5 s; 21st call → 429 |
| 7.2 | Web: "AI পরামর্শ" button → suggestion chips that fill the editable headline field | 45m | P1 | Picking a chip fills the field; user can still edit |

## Phase 8 — History & guardrails (~3.5 h) · Day 2

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 8.1 | `GET /api/posters/me` (paginated, newest first) | 30m | P1 | Returns only the caller's posters |
| 8.2 | Web: history page with thumbnails and re-download | 60m | P1 | Old poster downloads again without using quota |
| 8.3 | `DELETE /api/posters/:id`: delete Cloudinary poster and source photos (R8) | 30m | P2 | Assets gone from Cloudinary |
| 8.4 | Rate limits: OTP request (per phone + IP), upload, generate, headlines | 20m | P1 | Burst requests get 429 with a Bangla message |
| 8.5 | Blocklist service: static keyword list, normalized match (case, spaces, zero-width chars), applied to all text fields + tests | 45m | P1 | Blocklisted term rejected with a clear Bangla message |
| 8.6 | Terms of use page (Bangla) linked from the login checkbox | 20m | P1 | Page reachable from login |

## Phase 9 — Polish (~2.5 h) · Day 2 afternoon, before freeze

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 9.1 | Mobile UI pass on a real mid-range Android phone: spacing, tap targets, loading states | 90m | P1 | Whole flow comfortable on the phone |
| 9.2 | Review all Bangla copy and error messages | 30m | P1 | No English strings visible to users |
| 9.3 | Render tests: 60-char name/designation fit, conjunct sample renders without error | 30m | P1 | `pnpm test` green |

**— Feature freeze 26 Sep 18:00 —**

## Phase 10 — Ship & submit (~4 h) · Day 2 evening

| ID | Task | Est | Pri | Done when |
|---|---|---|---|---|
| 10.1 | Production env vars on Render and Vercel, Atlas network access, remove `/api/dev/*` routes, final deploy | 45m | P0 | Production URL works in a private window |
| 10.2 | Run the acceptance checklist (`project-scope.md` §9) on a real phone; fix blockers only | 45m | P0 | All P0 items pass; failures noted |
| 10.3 | README: what it is, architecture diagram, why Option B, why DB sessions, setup + `.env.example`, reviewer access (test number, free/premium accounts), quota rules, cut list, next steps | 90m | P0 | A new reader can log in and run it locally |
| 10.4 | Commit 2–3 sample posters; record a 1–2 min demo video | 45m | P0 | Files in repo; video link in README |
| 10.5 | Wake the Render backend, final smoke test, submit | 15m | P0 | Submitted before 23:59 |

---

## After the deadline (not planned)

- Real SMS provider (depends on 0.7)
- 1:1 social export (1080×1080)
- Open question 1, option B: free text-only re-renders per poster
- Admin panel, moderation queue, PDF export, bulk/CSV, payments, campaign templates (see `project-scope.md` §4)
