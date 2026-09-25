# পোস্টার মেকার — AI Political Poster Maker

Local political workers in Bangladesh fill in a short form, upload a few photos, and get a
**print-ready Bangla poster in seconds**: A3 at 300 DPI for the print shop and 4:5 for Facebook,
in the familiar Bangladeshi poster style (leader photos, flag colours, big Bangla headline,
credit bar with the publisher's name).

| Victory day (4:5) | Mourning, free tier with watermark (4:5) | Victory day (A3, preview) |
|---|---|---|
| ![Victory day poster](docs/samples/victory-day-4x5.png) | ![Mourning poster](docs/samples/mourning-4x5-free-watermark.png) | ![A3 poster](docs/samples/victory-day-A3-preview.png) |

**Live demo:** _URL added after deployment_ · Demo video: _link added after recording_

## Reviewer access

No Bangladeshi SIM needed. On the login page, use the **রিভিউয়ার এক্সেস** panel at the bottom
(or type the number yourself):

| Account | Phone | Code |
|---|---|---|
| Free (3 posters + 2 regenerations a day, watermark) | `01999000001` | `123456` |
| Premium (10 + 5 a day, no watermark) | `01999000002` | `123456` |

The free Render instance sleeps when idle: the first request after a while can take up to a minute.

## What it does

1. **Log in** with a phone number and a one-time code (Bangla or English digits).
2. **Pick a template** — বিজয় দিবস or শোক ও শ্রদ্ধাঞ্জলি.
3. **Fill the form**: name, পদবি, party/organization, area, headline; upload up to two leader
   photos, your own photo and an optional party symbol. Photos are cropped around the detected
   face; low-resolution photos get a warning.
4. **এআই পরামর্শ** suggests 3–5 Bangla headlines for the occasion.
5. **Generate**: the poster is ready in a few seconds. Download **A3 (3508×4961, 300 DPI)** or
   **4:5 (1080×1350)**, edit the text and regenerate, or find it later under **আমার পোস্টার**.

The whole interface is Bangla and built for phones (checked at 360 px).

## Architecture

```mermaid
flowchart LR
  B[Phone browser] -->|/api/* rewrite, first-party cookie| W[Next.js 16 on Vercel]
  W --> A[Express 5 API on Render<br/>Docker]
  A --> M[(MongoDB Atlas<br/>users, sessions, posters, quotas)]
  A --> C[(Cloudinary<br/>private photos + posters)]
  A --> P[Puppeteer / Chromium<br/>HTML template → PNG]
  A --> G[Gemini<br/>face box, headline ideas]
```

- **Monorepo** (pnpm workspaces): `apps/web` (Next.js), `apps/api` (Express), `packages/shared`
  (Zod schemas and types used by both, so the form and the API can't drift apart).
- **Templates are data** (`layoutConfig`): element positions per output size in % of the poster
  width, text rules, colour tokens and layout variants (e.g. one or two leaders), validated by a
  schema. The API turns them into HTML; Chromium renders it.

## Key decisions

- **Bangla text is never drawn by an AI model.** Image models misspell Bangla and break
  conjuncts (যুক্তাক্ষর). Text is rendered by Chromium with bundled OFL fonts (Noto Serif/Sans
  Bengali, Hind Siliguri), so "সংগ্রাম", "শ্রদ্ধাঞ্জলি", "ক্ষ", "ন্ত্র" are always correct. AI only helps
  where it's safe: finding faces for the crop and suggesting headlines the user can edit.
  Long names shrink to fit their box (tested with 60 characters).
- **Database sessions instead of JWT.** A random token in an httpOnly, SameSite=Lax cookie; only
  its SHA-256 hash is stored. A user (or a misuser) can be logged out instantly, plan changes
  apply on the next request, and there is no token in `localStorage`. The web app proxies
  `/api/*` so the cookie is first-party.
- **Quotas are enforced atomically**: one conditional MongoDB update per request, so parallel
  requests can't exceed the limit; failed renders are refunded. Days reset at Dhaka midnight.
- **Private by default**: photos and posters are private Cloudinary assets served through
  signed URLs; photo metadata (GPS, camera) is stripped on upload; users only ever see their own
  posters (other ids return 404).

Details of every decision and trade-off: [`tech-stack.md`](tech-stack.md),
[`project-scope.md`](project-scope.md) and the running log in
[`implementation-plan.md`](implementation-plan.md).

## Quotas and tiers

| | Free | Premium |
|---|---|---|
| New posters per day | 3 | 10 |
| Regenerations (text/photo edits) per day | 2 | 5 |
| AI headline suggestions per day | 20 | 20 |
| Watermark | Small, bottom-right | None |

Re-downloading an existing poster is always free. Premium is assigned by an admin for now
(payments are out of scope); an expired premium plan counts as free.

## Guardrails

- **Keyword blocklist** on all poster text and on headline suggestions: banned militant
  organizations (also caught when spaced out or hidden with zero-width characters) and violent
  commands. It is deliberately small and non-partisan — see known limitations.
- **Rate limits** on login codes (per IP and per phone), code checks, uploads, poster changes and
  suggestions; plus a 45 s wait between codes and 5 attempts per code.
- **Terms of use** accepted at the first login, including an attestation that the user may use
  the photos and names on the poster. Every AI call and render is logged.

## Run it locally

Requirements: Node.js 24, pnpm 11, and (optional) accounts for MongoDB Atlas, Cloudinary and Gemini.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # fill in what you have (see below)
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @app/api seed:templates        # the two templates
pnpm --filter @app/api seed:users            # the two reviewer accounts
pnpm dev                                      # db + api (:4000) + web (:3000)
```

Open http://localhost:3000.

- **No MongoDB account?** Keep `MONGODB_URI=mongodb://127.0.0.1:27017`: `pnpm dev` then starts a
  local MongoDB (data in `apps/api/.data`).
- **Uploads** need Cloudinary keys. **Face crop and headline suggestions** need `GEMINI_API_KEY`;
  without it, photos use a centred crop and the suggestion button explains it's unavailable.
- **`OTP_DEV_MODE=true`** shows login codes in the console and on the login page instead of
  sending SMS (there is no SMS provider yet).
- **`querySrv ECONNREFUSED`** when connecting to Atlas: some local DNS proxies refuse SRV
  lookups. Set `DNS_SERVERS=8.8.8.8,1.1.1.1` in `apps/api/.env`.

Useful scripts:

| Command | What it does |
|---|---|
| `pnpm test` | All tests (145), including real Chromium renders |
| `pnpm typecheck` / `pnpm lint` | Types and lint for all packages |
| `pnpm --filter @app/api render:sample` | Renders every template/size/variant to `apps/api/.data/renders` |
| `pnpm --filter @app/api templates:thumbnails` | Rebuilds template thumbnails after a template change |

## Deploy

- **API → Render** with the Blueprint in [`render.yaml`](render.yaml) (Docker image with Chrome).
  Enter the secrets when prompted: `MONGODB_URI`, Cloudinary keys, `GEMINI_API_KEY`,
  `APP_ORIGIN` (the Vercel URL). `OTP_DEV_MODE` is on for the demo (see known limitations). Then run
  the two seed scripts against the production database.
- **Web → Vercel** with Root Directory `apps/web` and `API_ORIGIN` set to the Render URL
  **before** the first build (the `/api` rewrite is built in).

## What was cut, and why

Scoped for one developer and a two-day deadline (see [`project-scope.md`](project-scope.md)):

- **Campaign templates** — Election Commission rules on campaign posters need checking first.
- **Payments** (bKash/Nagad) — premium exists but is assigned by an admin.
- **Admin panel, moderation queue, PDF export, bulk/CSV generation** — managed by scripts for now.
- **Real SMS** — needs provider onboarding (sender ID/KYC in Bangladesh); dev codes and reviewer
  numbers cover the demo.
- **AI-generated backgrounds** — templates use hand-made CSS gradients.

## Known limitations

- **The blocklist is a starting list** and not a moderation system; what else belongs on it is
  the owner's decision.
- **Rate limits live in memory** — correct for one API instance; a shared store (e.g. Redis) is
  needed to scale out.
- **Face crop falls back to a centred crop** when Gemini is busy; for a person standing far to
  one side this can frame the background. A manual crop control would fix it.
- **With `OTP_DEV_MODE=true` anyone can log in as any number**, since the code is returned to the
  browser. Fine for a demo, not for real users.
- **Print output is RGB PNG without bleed**; print shops may ask for CMYK or a 3 mm bleed.

## Next steps

Real SMS provider · manual crop control · campaign templates after checking EC rules ·
payments · admin panel with moderation queue · shared rate-limit store · cleanup of unused uploads.
