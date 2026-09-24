# Project Scope — AI Political Poster Maker

> Status: **Draft v0.5** — derived from `task.md` (2026-09-25).
> v0.5 adds reviewer access, the admin-set premium plan, quota rules and atomic quota enforcement, and makes the whole document consistent with the decisions below.
> Items marked **Open** still need a decision. Each has a default so the build isn't blocked.

---

## 1. Problem & Goal

Local political workers in Bangladesh often need posters on short notice: victory day, condolence/tribute, and festival greetings. They currently go to a designer or print shop. This platform lets them fill a short form, upload photos, and get a print-ready poster in the familiar Bangladeshi political-poster style within minutes.

**MVP goal:** a signed-in user picks a template, fills the form, uploads photos, and downloads a correctly spelled, print-ready Bangla poster, with no designer involved.

**Context:** this is an **internship submission**, built by **one developer**, and due **2026-09-26 23:59**. Reviewers will judge the deployed demo, the code quality and the README.

## 2. Target Users

| User | Need |
|---|---|
| Local political workers / committee members | Quick posters for occasions, with their name and designation in the footer |
| Publicity agents | Many posters for different people (drives the later bulk feature) |
| Internship reviewers | Log in without a Bangladeshi phone number and see both the free and premium tiers |
| Admin (internal) | Assign premium plans and control misuse (DB/scripts only in the MVP) |

- **UI language:** Bangla only (labels, errors, SMS text).
- **Device:** mobile-first.

## 3. In Scope — MVP

1. **Auth:** phone number + SMS one-time code, then a JWT.
   - The **dev-mode code** (logged to the console, behind an env flag) is required. Real SMS is a stretch goal (R10).
   - **Reviewer access:** a documented test phone number with a fixed code, plus seeded **free** and **premium** test accounts.
2. **Templates:** **2** party-neutral seeded templates (বিজয় দিবস, শোক/স্মরণ), loaded by a seed script with no admin UI.
3. **Poster form:**
   - name, পদবি, party/organization, optional party symbol upload, union/থানা/জেলা, occasion, Bangla headline
   - 3 labeled photos: Leader 1, Leader 2, and the requester's own photo
4. **AI (Gemini):**
   - (a) Decorative backgrounds, **generated offline once per template** and committed as template assets.
   - (b) **Bangla headline suggestions** (3–5 options the user can edit).
   - (c) **Face-aware cropping:** a face bounding box sets the crop inside the frame, with center crop as the fallback.
5. **Rendering:** the server renders an HTML/CSS template with **Puppeteer** and exports PNG. Bangla text is placed exactly as the user typed it and never passes through an image model.
6. **Photos:** **framed** (circle/rounded). No background removal.
7. **Preview & regenerate:** edit text, then re-render, within the daily quota (§12).
8. **Export:** PNG at **A3 print (3508×4961 at 300 DPI)** and **4:5 social (1080×1350)**. 1:1 (1080×1080) is a stretch goal.
9. **Watermark:** a small watermark on free-tier posters. Premium posters have none.
10. **Poster history:** the user's own posters, available to download again.
11. **Quotas & tiers:** free and premium daily limits, enforced atomically on the server (§12).
12. **Rate limiting** on the auth (code sending), upload, generation and headline-suggestion endpoints.
13. **Minimum guardrail:** a keyword blocklist on text fields, plus a log of every generation (R1).
14. **Deploy:**
    - Frontend on Vercel.
    - Backend on a long-running host such as Render (R3).
    - MongoDB Atlas and Cloudinary.

## 4. Out of Scope — MVP (deferred)

- Admin panel UI (templates and plans are managed by seed script or direct DB edits)
- Content moderation queue and image moderation of uploaded logos
- Background-removal "cutout" photos
- PDF export
- Bulk/CSV generation
- Payment gateway (bKash/Nagad). The premium tier exists, but an admin assigns it (§12).
- Usage analytics dashboard
- Font picker, multiple photo-layout options
- Public sharing / public poster gallery
- Campaign (নির্বাচনী প্রচার) templates, until the current election rules are verified (R2)
- Party-specific templates and pre-loaded party logos
- Async job queue / status polling (generation is synchronous in the MVP)

## 5. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Generation approach | **Option B** (AI-assisted + HTML render) | Bangla text from image models is unreliable. Option B gives exact spelling and conjuncts. |
| Stack | Next.js + Express (TS), MongoDB/Mongoose | Stated in task.md |
| Renderer | **Puppeteer** | Chromium shapes Bangla conjuncts (যুক্তাক্ষর) correctly through HarfBuzz. node-canvas has known problems with complex scripts. |
| Storage | **Cloudinary** | Quick setup, with image transformations included |
| Gemini's role | Offline template backgrounds, headline suggestions, face-aware crop | Visible AI value. AI never renders the Bangla text on the poster. |
| Party support | **Party-neutral templates**; users upload their own symbol | Least legal and political exposure |
| Photo slots | **2 leaders (top) + 1 requester (footer)**, all **framed** | Matches the sample layout without needing background removal |
| Output formats | **A3 at 300 DPI + 4:5**; 1:1 as a stretch goal | Print shops need A3; Facebook is the main sharing channel |
| Campaign templates | **Deferred** | Avoids shipping non-compliant election material |
| Auth | **Phone + SMS one-time code**, with a required dev-code mode and a reviewer test number | Target users are phone-first, and reviewers can't receive BD SMS |
| UI language | **Bangla only** | Target users |
| Tiers | **Free** (watermarked) and **Premium** (no watermark), with premium **set by an admin** | Payments are deferred |
| Quotas | Free: 3 posters + 2 regenerations/day. Premium: 10 + 5/day. Reset at Dhaka midnight. | See §12 |
| Generation mode | **Synchronous** (render within the request, under 30 s) | A job queue isn't worth it at this scale or on this timeline |
| Poster history API | `GET /api/posters/me` (user taken from the JWT) | Avoids the IDOR bug in `GET /api/posters/user/:userId`, where one user could read another's posters |

## 6. Issues Found in task.md (and how they're resolved)

| # | Issue | Resolution |
|---|---|---|
| 1 | Admin panel and PDF export are listed as MVP in §3 but deferred in §7 | Deferred (§4) |
| 2 | "Watermark removal for paid tier", but no watermark or paid tier in the MVP | Free posters are watermarked; the premium tier is admin-assigned (§12) |
| 3 | "min 1200×1600px" is called print-ready, but that's only about 4×5 in at 300 DPI | A3 at 3508×4961 |
| 4 | Gemini's role in Option B was thin (colors/crops) | Defined as backgrounds, headlines and face crop |
| 5 | `GET /api/posters/user/:userId` invites an IDOR bug | `GET /api/posters/me` |
| 6 | "Status polling" implies async jobs, but no job runner is specified | Synchronous render in the MVP |
| 7 | "Deadline" is mentioned with no date | 2026-09-26 23:59 |

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Misuse**: defamation, fake endorsements, photos used without consent, banned-organization content. Uploaded logos can't be screened by template design. | Terms of use with an attestation checkbox. Keyword blocklist on text fields. Log every generation. Watermark on free posters for traceability. |
| R2 | **Election law**: the Bangladesh EC code of conduct has historically restricted campaign posters (color, size, whose photos may appear), and printed material may need an imprint | Campaign templates are deferred. Verify the **current** rules before adding them. |
| R3 | **Puppeteer on Vercel**: Chromium is large, and serverless size/duration limits are tight | Run the backend on Render (a long-running process). Deploy an empty backend on Day 1 to catch problems early. |
| R4 | **Bangla font rendering and licensing** | Bundle OFL fonts (e.g. Noto Sans/Serif Bengali, Hind Siliguri) on the server. Check the license before using any commercial font. |
| R5 | **Variable text length** overflows the template | `layoutConfig` defines max characters, auto-shrink and wrapping per text slot. Test with the longest realistic inputs. |
| R6 | **Low-res phone photos** stretched to A3 | Enforce a minimum resolution on upload and warn the user in the preview |
| R7 | **Gemini cost/availability** | Backgrounds are offline, so runtime calls are only headlines and face crop. Quotas plus a headline rate limit. Center-crop fallback if Gemini fails. |
| R8 | **Privacy**: photos of real people | Delete source photos when a poster is deleted. Serve images through signed URLs. |
| R9 | **A3 render cost**: a 3508×4961 screenshot is memory-heavy | Render at CSS size with `deviceScaleFactor`. Show the 4:5 preview first and render A3 on download. |
| R10 | **SMS onboarding**: BD gateways often need KYC or sender-ID approval, which can take days | Self-serve provider (e.g. Firebase Phone Auth / Twilio Verify; check BD delivery). Sign up on Day 1. Dev-code mode is required. |
| R11 | **Deadline**: one person, about 46 h | Follow the cut list and build order in §11 strictly. Minimum-demo fallback defined. |
| R12 | **Reviewers locked out**: no BD number, SMS never arrives, or Render cold start | Test phone number + fixed code, seeded free/premium accounts documented in the README, backend woken before submitting, and a screen recording as backup |
| R13 | **Quota race condition**: two fast requests both pass a check-then-increment and exceed the limit | Single atomic conditional `$inc` (§12) |

## 8. Open Questions

**Open**
1. **Regeneration quota is tight.** Free users get 2 regenerations per day across all posters, so a typo on the 3rd poster may be unfixable.
   - *Option A:* keep it as specified.
   - *Option B (recommended):* text-only edits and re-renders of an existing poster are free (max 5 per poster). Only new posters use the daily poster quota, and the regeneration quota applies only when the template or photos change.
   - *Default: A, as specified, until you decide.*
2. **Blocklist ownership:** who writes and maintains the keyword list? *Default: a small static list in the repo, documented in the README as a known limitation.*
3. **Can a poster have only 1 leader?** *Default: yes. The second leader slot is optional and the layout re-centers.*
4. **Print specifics:** do print shops need a 3 mm bleed or CMYK? *Default: RGB PNG with no bleed. Mention it in the README as a next step.*
5. **Does one generation include all sizes?** *Default: yes. One poster quota covers A3 + 4:5 (+ 1:1).*
6. **Data retention:** how long are photos and posters kept? *Default: until the user deletes them. State this in the README.*
7. **Which SMS provider?** *Default: Firebase Phone Auth, which also provides native test numbers.*

**Resolved:** party support, photo slots, auth method, Gemini's role, background removal (not needed), meaning of "regenerate", print size, social sizes, watermark, deadline/team, UI language, quotas, how users become premium. See §5.

## 9. MVP Acceptance Criteria

- [ ] A reviewer can log in with the documented test number/code, without a real SMS.
- [ ] A user can log in and create a poster from each template on a mid-range Android phone.
- [ ] Bangla conjuncts (e.g. "সংগ্রাম", "শ্রদ্ধাঞ্জলি", "ক্ষ", "ন্ত্র") render correctly in the export.
- [ ] A 60-character name and a 60-character designation fit without overflow.
- [ ] Generation finishes in under 30 s, or shows a clear Bangla error with a retry option.
- [ ] Exports are produced at 3508×4961 (A3) and 1080×1350 (4:5), with nothing important cropped out.
- [ ] Free posters carry the watermark; premium posters don't.
- [ ] Free users are blocked after 3 posters / 2 regenerations in a day, and premium users after 10 / 5. The UI shows what's left.
- [ ] Quotas reset at 00:00 Asia/Dhaka.
- [ ] Firing 5 parallel generate requests at a user's quota edge doesn't exceed the limit.
- [ ] Failed renders don't use up quota.
- [ ] A user can see and download only their own posters.
- [ ] Blocklisted terms are rejected with a clear Bangla message.

## 10. Data Model (additions to task.md)

- **`User`**
  - `phone` (unique), `isVerified`, `role` (user/admin)
  - `plan`: `'free' | 'premium'` (default `'free'`), `planExpiresAt?`
  - `acceptedTermsAt`
- **`Template.layoutConfig`**: define a JSON schema up front covering:
  - slots (x, y, w, h per output size)
  - text rules (font, min/max size, max lines, alignment)
  - photo frame shape (circle/rounded) and whether the slot is optional
  - color tokens and background asset per output size

  This is the core design artifact.
- **`Poster`**: add `outputs` (`{ a3Url, social45Url, social11Url? }`), `watermarked`, `renderVersion` (to reproduce old posters after template changes), `editCount` and `errorMessage`.
- **`UsageCounter`** (new): `{ userId, date: 'YYYY-MM-DD' (Asia/Dhaka), posters, regenerations }`, with a unique index on `(userId, date)`.
- **`GenerationLog`**: `posterId`, `model`, `stage` (`headline | face-crop | render`), `latencyMs`, `success`, `costEstimate`.

## 11. Delivery Plan (deadline 2026-09-26 23:59, one developer)

About 46 hours remain as of this writing, and some of that is sleep. This section is the real plan.

### Cut list

| Feature | MVP plan | Why |
|---|---|---|
| Templates | **2** (বিজয় দিবস, শোক/স্মরণ) | Each template needs multiple layouts |
| Export sizes | **A3 + 4:5**; 1:1 only if time allows | 4:5 covers Facebook feeds |
| Photos | **Framed**, not cut out | Removes the background-removal integration |
| AI backgrounds | **Generated offline once** by a script and committed as assets | Zero runtime cost and no runtime failure path |
| Headline suggestions | One Gemini text call → 3–5 suggestions | Cheap, fast, visibly AI |
| Face-aware crop | Gemini face box → `object-position`/crop; center-crop fallback | One call per photo |
| SMS one-time code | **Dev-code + test number required**; real SMS is a stretch goal | SMS onboarding is the biggest external risk |
| Premium | `User.plan` set by seed script; "প্রিমিয়াম নিন" button marked coming soon | No payments needed |
| Regenerate | Edit text and re-render, counted against the daily quota (§12) | Rendering is deterministic, so no extra AI work |
| Generation | **Synchronous** | No queue needed |
| Rate limiting | `express-rate-limit`, in memory | About 10 minutes of work |

### Build order (each step leaves something that can be demoed)

**Day 1 — 25 Sep**
1. Repo setup: Next.js + Express (TS), MongoDB Atlas, Cloudinary, env config. Deploy an empty backend to Render **right away**. Start the SMS provider signup so approval runs in parallel.
2. **Render pipeline first (riskiest part):** a hard-coded HTML template, Bangla font, Puppeteer → A3 PNG. Check that conjuncts render correctly.
3. `layoutConfig` schema + 2 templates, with backgrounds generated offline by Gemini.
4. Upload endpoint, then face-crop through Gemini.
5. Auth: phone + dev-code + JWT, plus the test number. Seed script for the free and premium reviewer accounts.

**Day 2 — 26 Sep**
6. Form → generate → preview → download (end to end), plus the watermark for the free tier.
7. `UsageCounter` + atomic quota enforcement + "what's left" in the UI.
8. Headline suggestions.
9. History page, rate limits, keyword blocklist.
10. Mobile UI pass (Bangla copy throughout).
11. **Feature freeze at 18:00.** Deploy to production, test on a real phone, write the README, record the demo video, fix bugs. Use the buffer until 23:59.

### Absolute minimum for the demo, if things go wrong
Login (dev code/test number) → pick 1 template → form + 3 photos → A3 PNG with correct Bangla → download. Everything else is extra.

### Internship submission deliverables
Plan about 2–3 h on Day 2 for these.
- **Deployed URL** that works on first open. Render's free tier sleeps, so wake it up before submitting, and note this in the README.
- **Reviewer access, documented in the README:**
  - the test phone number and fixed code
  - one **free** and one **premium** test account
- **README:**
  - what it is, and an architecture diagram
  - why Option B (the Bangla-text reasoning)
  - setup steps and `.env.example`
  - quota rules
  - what was cut and why, and next steps

  Your scope decisions are a selling point, so show them.
- **2–3 sample output posters** in the repo, plus a 1–2 min screen recording in case the deployment is down during review.
- **Clean git history:** small commits with clear messages. Never commit API keys.
- **Tests where they matter most:** quota logic (including the concurrency case), `layoutConfig` validation, and Bangla text fitting.

## 12. Quotas & Tiers

| | Free | Premium |
|---|---|---|
| New posters / day | 3 | 10 |
| Regenerations / day | 2 | 5 |
| Watermark | Yes | No |
| How to get it | Default on signup | **Set by an admin** (`User.plan = 'premium'` via seed script or DB update) |

**Rules:**
- **Day boundary:** resets at **00:00 Asia/Dhaka (UTC+6)**. Compute `date` in Dhaka time, not server UTC, or quotas reset at 6 AM local.
- **Only successful renders count.** Failed Gemini or render calls don't use quota. Use a reserve-then-refund pattern: increment atomically, then decrement if the render fails.
- **Regenerations are per user per day,** not per poster. This is as specified; see Open Question 1 for the recommended alternative.
- **Headline suggestions** don't count against quotas but have their own rate limit (e.g. 20/day per user) to cap Gemini cost.
- **Re-downloading** an existing poster from history is free and unlimited.
- **Atomic enforcement** means one conditional `$inc` query, never a separate check and then an increment:
  ```ts
  UsageCounter.findOneAndUpdate(
    { userId, date, posters: { $lt: limit } },
    { $inc: { posters: 1 } },
    { upsert: true, new: true }
  )
  ```
  A duplicate-key error on upsert means the limit was reached, so treat it as "quota exceeded".
- **The UI shows what's left** ("আজ আর ২টি পোস্টার বানাতে পারবেন") and shows a clear Bangla message plus the "প্রিমিয়াম নিন" button when the limit is reached.
- **Premium expiry:** if `planExpiresAt` has passed, treat the user as free (checked on each request, with no cron job).
