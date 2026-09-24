Task Description

1. Overview
   A web platform where users (local political workers, committee members, publicity agents) generate ready-to-print political posters — victory day posters, condolence/tribute posters, campaign posters — by filling a form (name, designation, party, photo, occasion) and letting AI (Gemini) compose/edit the poster layout automatically, in the style of typical Bangladeshi political posters (leader photos, flag motifs, floral borders, Bangla headline text, footer credit line).

Reference style (from sample posters): large Bangla headline (e.g. "মহান বিজয় দিবস", "টেক ব্যাক বাংলাদেশ"), 2–3 leader photo cutouts along the top, party symbol/flag graphic, decorative background (rice paddy, doves, national flag colors), and a footer bar with the requester's name, designation, and organization — printed by a "প্রচারে" credit line.

2. Tech Stack

- Frontend: Next.js (TypeScript)

- Backend: Express.js (TypeScript)

- Database: MongoDB (Mongoose)

- AI: Google Gemini API (image generation/editing + text placement)

- File storage: Cloudinary or S3-compatible bucket for uploaded photos & generated posters

- Auth: JWT (email/phone + password, or OTP)

3. Core Features (MVP)
1. Template library — curated poster templates categorized by occasion (বিজয় দিবস, শোক/স্মরণ, নির্বাচনী প্রচার, শুভেচ্ছা, ঈদ/উৎসব).

1. User input form — name, designation/পদবি, party/organization, union/থানা/জেলা, occasion type, headline text (Bangla), up to 3 photo uploads.

1. AI poster generation — send template + user data + photos to Gemini, get back a composed poster image (or generate layout instructions Gemini fills, rendered via HTML/Canvas → image export).

1. Preview & regenerate — user can preview, tweak text, and regenerate if not satisfied (limited retries).

1. Download/export — high-res PNG/JPG (print-ready, min 1200×1600px) and PDF.

1. Poster history — saved posters per user account, re-downloadable.

1. Admin panel — manage templates, review usage, moderate content (flag/block prohibited party symbols, hate content, etc.).

Stretch features

- Multiple photo layout options (2-up, 3-up grid)

- Bangla font selection for headline

- Watermark removal for paid tier

- Bulk generation (CSV of names → batch posters) for local committees

- Payment gateway (bKash/Nagad) for premium templates or high-res export

4. Suggested DB Schema (MongoDB)
   User

- name, email/phone, passwordHash, role (user/admin), createdAt

Template

- title, occasionType, thumbnailUrl, layoutConfig (JSON: photo slots, text slots, color scheme), isActive

Poster

- userId (ref), templateId (ref), formData (name, designation, party, district, etc.), uploadedPhotoUrls[], generatedImageUrl, status (draft/generating/completed/failed), createdAt

GenerationLog (optional, for AI cost tracking)

- posterId, geminiPromptUsed, tokensUsed, latencyMs, success

5. API Endpoints (Express)

```

POST /api/auth/register

POST /api/auth/login

GET /api/templates # list templates (filter by occasion)

GET /api/templates/:id

POST /api/posters # create poster request (form + photos)

GET /api/posters/:id # get status/result

GET /api/posters/user/:userId # user's poster history

POST /api/posters/:id/regenerate

DELETE /api/posters/:id

POST /api/upload # photo upload (returns URL)

# Admin

POST /api/admin/templates

PATCH /api/admin/templates/:id

DELETE /api/admin/templates/:id

GET /api/admin/posters # moderation queue


6. Gemini Integration Approach
Two viable approaches — pick one for MVP:

Option A — Direct image generation/editing: Send Gemini the template reference image + user's uploaded photo(s) + text fields, prompt it to compose a new poster image matching the reference style. Fastest to build, but less precise text rendering (Bangla text inside AI-generated images can be unreliable).

Option B — AI-assisted layout + HTML/Canvas render (recommended for MVP): Use Gemini only to (a) suggest/crop photo placement and (b) generate a color/decoration scheme matching the occasion, then render the actual poster server-side via an HTML/CSS template (Puppeteer or node-canvas) with the user's exact Bangla text placed precisely, and export to PNG/PDF. This guarantees clean, correctly-spelled Bangla text (a common failure point for AI image gen) while still using AI for the creative/visual parts.

7. Task Breakdown
Scope trimmed to a shippable MVP core: auth, 2–3 seed templates, poster form, AI generation pipeline, preview/export. Admin panel, moderation queue, and analytics moved to post-deadline follow-up (noted at the end).

Setup + Template System
Init Next.js + Express + TS project structure, MongoDB connection

Mongoose models: User, Template, Poster

Auth (register/login, JWT middleware)

File upload endpoint (Cloudinary/S3) for user photos

Seed 2–3 templates matching the sample poster styles (schema + static assets, no admin UI yet — seed via script)

Generation Core
Poster request form (Next.js): name, designation, party/org, occasion, photo upload

Gemini API integration — prompt design for layout/decoration suggestion (Option B from Section 6)

HTML/Canvas (Puppeteer or node-canvas) render pipeline: template + user photos + Bangla text → composed poster image

Export to PNG (print-res); wire generation endpoint end-to-end (POST /api/posters → status polling)

User Flow, Polish, Deploy
Preview screen + regenerate (limited retries)

Poster history page (list past posters, download again)

Basic rate limiting on generation endpoint

Responsive UI pass on form/preview pages

Deploy: frontend (Vercel) + backend (Vercel/ render) + MongoDB Atlas

Deferred to post-MVP (optional):
Admin panel for template CRUD (use seed script instead for now)

Content moderation queue

Usage analytics

PDF export, bulk/CSV generation, payment gateway

8. Key Risks / Notes
Bangla text accuracy is the biggest risk with pure AI image generation — recommend Option B above.

Content moderation is important: political poster tools can be misused (defamatory content, unauthorized use of others' photos/symbols) — add a review/flag step before public sharing if this becomes multi-tenant.

Gemini cost control: cache/reuse template-level AI outputs (background/decoration) instead of regenerating per-user every time.
```
