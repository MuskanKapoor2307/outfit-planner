# CLAUDE.md: Outfit Planner

Context for Claude Code working in this repo. Read this before making changes.

## What this app is

An **invite-only** outfit planner for a small group of friends and family (max ~15 accounts).
The owner is a non-developer who mostly uses the app on her phone. Explain anything she has to do
herself (Supabase SQL, Vercel settings) in **simple, step-by-step language**.

Core ideas:
- **Account → profiles.** One login can hold several style profiles (Me, Mom, Arjun…). Each profile has its own wardrobe, trips, theme and try-on photo.
- **Trips → days → sections → looks.**
  - A trip (e.g. "Goa") spans dates. Each day has **sections the user names herself**, of kind `time` ("Morning"), `event` ("Pool party") or `place` ("Baga beach").
  - Each section holds **several looks (options)**; one can be starred as the **final pick**.
- **Wardrobe:** clothing photos. Background removal is optional, free, and runs **in the browser**.
- **Shopping list per trip:** link, price in ₹, tick when bought, then **Move to wardrobe**.
- **Free try-on board (no AI):** a full-length photo per profile, with the look's cut-outs dragged, resized and tilted on top like a paper doll.
- **Optional AI stylist:** the user picks or uploads pieces and asks for a complete look, footwear, accessories, or hair and makeup (or grooming).
  - Providers: Gemini (free key), Claude, OpenAI, or **"My chat app"** (copy-paste into the Claude/ChatGPT app, which uses the person's subscription).
  - AI can be switched off entirely, and the app must remain fully usable as a plain planner.

## Stack (all free tiers, keep it that way)

- **Next.js 16** (App Router, TypeScript, React 19). Almost every page is a **client component** that talks to Supabase directly. Deployed on **Vercel** (auto-deploys on push to `main`).
- **Supabase:**
  - Postgres with **Row Level Security on every table**
  - Auth: email + password, **public sign-up disabled**
  - Storage: private buckets `wardrobe` and `people`
- **PWA:** `public/manifest.webmanifest`, installed via "Add to Home Screen". No app-store build.
- **Libraries:**
  - `@imgly/background-removal`: on-device background removal. It is **AGPL** licensed, so the repo must stay public.
  - `jszip`: data export.
- No Tailwind. Plain CSS in `app/globals.css` with design tokens (see Design system).

Do **not** add paid services, a separate backend, or new heavy dependencies without asking.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # must pass before you finish a task
npm run lint       # = tsc --noEmit
```

The owner develops on **Windows / PowerShell**. Paths with `[` `]` (e.g. `app/p/[pid]`) need `-LiteralPath` in PowerShell. Mention that whenever you give her commands touching those folders.

## Environment variables (never commit real values)

| Name | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | e.g. `https://xxxx.supabase.co`, with no path |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser | public anon/publishable key; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | bypasses RLS. Only in `lib/supabaseAdmin.ts` (guarded by `import 'server-only'`) |
| `APP_URL` | server | used to build invite/reset links; never derive from request headers |
| `MAX_USERS` | server | account cap, default 15 |

`.env.example` holds dummy values only. `.env.local` is git-ignored. Never print, log or ask for the service key.

## Project layout

```
app/
  layout.tsx                 root; loads Google Fonts; await headers() so every page gets a CSP nonce
  globals.css                ALL styles + theme tokens
  page.tsx                   home: "Who's planning?" profile tiles (⋯ edit/delete)
  login/  welcome/           login; invite + password-reset landing (token used only on button tap)
  p/[pid]/layout.tsx         profile shell: theme, paper sheet, topbar, bottom tabs
  p/[pid]/page.tsx           trips list (⋯ edit/delete per trip)
  p/[pid]/trip/[tid]/page.tsx  trip: Outfits tab (days → sections → looks) + Shopping list tab
  p/[pid]/wardrobe/page.tsx  wardrobe grid, search, Select mode for bulk delete
  p/[pid]/style/page.tsx     profile settings: name/icon/theme/style_for, try-on photo, links to settings
  settings/ai/page.tsx       AI provider + keys (device only)
  account/  admin/           password, export zip, delete account; admin invites (admin only)
  api/admin/*  api/account/delete   the ONLY server routes; they use the service key
components/                  Sheet (animated <dialog>), Feedback (toasts + confirm/ask), Menu (⋯),
                             ItemSheet, OutfitSheet, SectionSheet, TripSheet, LookCard, LookBoard,
                             AiStylistSheet, TryOnSheet, BodyPhotoCard, ShoppingList/Sheet, ThemePicker, Icon…
lib/
  supabase.ts                browser client + apiFetch (adds Bearer token for our API routes)
  supabaseAdmin.ts           server-only admin client, requireUser/requireAdmin, deleteUserCompletely
  auth.tsx                   AuthProvider, RequireAuth
  profile.tsx                ProfileCtx (current profile + reload)
  image.ts                   photo pipeline: downscale → optional bg removal → trim → WebP (strips EXIF/GPS)
  signedUrls.ts              cached 1-hour signed URLs, per bucket
  themes.ts  types.ts  constants.ts
  ai/settings.ts             AI settings + API keys in browser storage (plain / PIN-encrypted AES-GCM / session)
  ai/providers.ts            direct browser calls to Gemini / Claude / OpenAI; Gemini auto-falls back to Flash-Lite on 429
  ai/stylist.ts              prompt builder + STRICT reply parser (untrusted JSON → known fields only)
  ai/images.ts  ai/useAi.ts
proxy.ts                     Next 16 "proxy" (middleware): per-request CSP nonce
supabase/                    SQL migrations, run by hand in the Supabase SQL Editor, in order
```

## Data model (see `supabase/*.sql`)

- `app_admins(user_id)`: admin list. No write policies; changed only via SQL editor.
- `invites`: server-only, with no RLS policies.
- `style_profiles`:
  - `name`, `emoji`
  - `theme` (check constraint list)
  - `style_for` (`women|men|any`)
  - `body_photo_path`, `body_photo_consent_at`
- `wardrobe_items`:
  - `profile_id`, `image_path`, `name`
  - `category` (check constraint list in SQL **and** `CATEGORIES` in `lib/constants.ts`)
  - `color`, `tags[]`
- `trips`: `profile_id`, `name`, `destination`, `start_date`, `end_date` (≤31 days), `notes`.
- `sections`: `trip_id`, `day` (must be within the trip dates at write time), `name`, `kind`, `position`.
- `outfits`:
  - `trip_id`, `section_id`, `title`
  - free-text fields: `aesthetic`, `footwear`, `accessories`, `hairstyle`, `notes`
  - `is_pick`, `ai_generated`
  - `tryon` jsonb: an array of `{item_id,x,y,w,r,z}` in % of the board
- `outfit_items(outfit_id, item_id, position)`
- `shopping_items`:
  - `trip_id`, `name`
  - `url` (http/https only), `price`, `category`, `notes`
  - `status` (`to_buy|bought|in_wardrobe`), `wardrobe_item_id`

Every user table has `owner_id uuid default auth.uid()` and policy `owner_id = auth.uid()` plus ownership checks on parents.
Row limits are enforced by the `enforce_row_limit` trigger.

**Storage:**
- Bucket `wardrobe`: private, 2 MB, ≤450 files per user.
- Bucket `people` (try-on photos): private, 4 MB, ≤20 files per user.
- Paths are always `<user-id>/<random>.webp`, and the storage policies check the first folder equals `auth.uid()`.

### Migrations: how to change the database

1. **Never edit an existing numbered SQL file.** Add the next one, e.g. `supabase/005_<what>.sql`.
2. Make it **idempotent**: use `if not exists`, `drop policy if exists`, and `drop constraint if exists` before re-adding.
3. Any new table must have: `owner_id … default auth.uid()`, `enable row level security`, an owner policy with parent ownership checks in `with check`, `revoke all … from anon`, and a row-limit trigger.
4. In your final message, tell the owner plainly: *"Before merging, open Supabase → SQL Editor → New query, paste `supabase/005_….sql`, press Run."*
5. Update the README's setup/update section.

## Security rules (do not weaken these)

- **RLS on every table and bucket.** Never use the service key in browser code, never add `NEXT_PUBLIC_` to it, and never disable RLS to "make something work".
- **Server routes** (`app/api/**`) must call `requireUser` or `requireAdmin` first. They authenticate with the `Authorization: Bearer` token, not cookies.
- **AI keys live only on the device** (`lib/ai/settings.ts`). They are never sent to our server or database. Calls go browser → provider directly. Don't add server-side proxies for keys.
- **AI replies are untrusted.**
  - Parse them through `parseResult` (known fields, length caps, wardrobe codes must exist).
  - Render as plain text only. **Never use `dangerouslySetInnerHTML`** anywhere.
- **External links:** validate with `safeLink` (http/https only) and open with `target="_blank" rel="noopener noreferrer"`.
- **CSP:** `proxy.ts` allows connections only to Supabase, `staticimgly.com` (bg-removal model), the three AI providers, and Google Fonts. If a feature needs a new domain, add it there deliberately and say why. Don't loosen `script-src`. One deliberate exception: `'unsafe-eval'` is allowed **only on `/p/*` pages**, because the background remover's `ndarray` dependency uses `new Function()`. Keep it scoped that way.
- **Photos:**
  - Always go through `prepareImage`, which re-encodes them and strips location data.
  - Try-on photos stay in the `people` bucket, need a consent tick, and are **never sent to AI**.
  - When deleting a profile or account, remove its storage files too (see `deleteUserCompletely` and the profile delete code).
- **Invite-only:** don't add sign-up pages. Invite and reset links are created by the admin API and land on `/welcome`, which verifies the token **only on button tap**, so link previews can't consume it.
- **Data rights:** keep "Download my data" (zip) and "Delete my account" working when adding new data.

## Design system: "scrapbook style book"

Inspired by the owner's Pinterest pins: a patterned backdrop with a paper page on top, washi tape, sticker cut-outs with white edges, typewriter labels, script headings.

- **Themes** are set per profile via `html[data-theme]`. There are 9 of them, listed in `lib/themes.ts` and the SQL check constraint:
  - **For her:** picnic, stylebook, vloset, matcha, happiness
  - **For him:** denim, kraft, varsity
  - **For anyone:** darkroom (dark)
  - The neutral `studio` theme is used outside profiles (home, login, settings).
- **Tokens** (in `app/globals.css`):
  - `--page`: patterned backdrop
  - `--bg`: paper colour
  - colours: `--surface`, `--ink`, `--muted`, `--accent`, `--accent-ink`, `--accent-2`
  - board background: `--swatch`
  - tape strip: `--tape`
  - sticker edge colour: `--sticker`
  - fonts: `--font-h1` (script/display), `--font-display` (h2/h3), `--font-body`, `--font-mono`
  - shapes: radii, `--card-shadow`
  - **Always use tokens**, never hard-coded colours, so every theme works, including the dark one.
- **Layout:** each screen sits in `.sheet-page`, the paper with tape; per-theme edges are drawn in its `::after`. The bottom tab bar is fixed on phones.
- **AI must always look like AI.**
  - Use the `.ai-badge` / `<AiBadge/>`, `.btn.ai`, `.add-tile.ai` and `.ai-panel` styles, which share the same violet→cyan gradient in every theme.
  - Looks made by AI get `ai_generated = true` and show "AI idea".
  - Non-AI features must not use these styles.
- **Motion:**
  - entrances: `paper-in`, `rise`, `stick` (stickers pop on), `stamp` (selected day)
  - accents: `twinkle`, `wiggle`
  - Entry animations use `backwards` fill, so hover transforms still work afterwards.
  - Respect `prefers-reduced-motion`; it's already handled globally.
- **UX conventions:**
  - Use `useFeedback()` for `toast`, `confirm` (supports `typeToConfirm`) and `ask`. **Never use `alert/confirm/prompt`.**
  - Destructive actions live in a `⋯` `<Menu>` and need confirmation. Deleting trips or profiles requires typing the name.
  - Use loading skeletons (`.skel`), not "Loading…" text.
  - Copy is short, friendly and plain. Avoid jargon in anything the owner reads.
- **Mobile first:** test at ~390px wide. Touch targets ≥ 40px.

## AI details

- **Default models** are in `DEFAULT_MODELS` (`lib/ai/settings.ts`). Users can edit them in AI settings, because providers rename models.
- **One request per click.** Count requests with `countRequest`.
- **Before the first request to each provider,** show the consent dialog explaining what's sent: selected photos plus a *text-only* wardrobe list.
- **Gemini free-tier quota** resets around midnight US Pacific (≈12:30–1:30 PM IST). On quota errors, offer the "My chat app" copy-paste mode.
- **Image generation (AI try-on) is not built.** It would be paid (Gemini image models have no free tier). If asked to build it:
  - make it opt-in, using a paid key or the copy-paste mode,
  - show the cost first,
  - never use the `people` photo without an explicit tap,
  - block it for under-18s.

## Working style for this repo

- Keep changes focused. Run `npm run build` before finishing, and fix all type errors.
- After a change, the end message should include:
  1. what changed, in plain words;
  2. any **SQL file to run first**, or **Vercel env var** to add;
  3. how to test it on the Vercel preview link from a phone.
- Don't rename routes, tables or theme ids without a migration and a mapping for existing data.
- Don't commit `.env*` files (other than `.env.example`), `node_modules`, or `.next`.

## Ideas backlog (owner has expressed interest)

- **Pinterest inspiration on a look:** paste a pin link or screenshot, and "Style it like this" with AI using own wardrobe. The Pinterest API can't search all of Pinterest, so don't promise that.
- **Android share target:** "Share → Outfit Planner" from the Pinterest app. Use `share_target` in the manifest; iPhone doesn't support it.
- **Packing list** from final picks across a trip.
- **Weather per trip day** via Open-Meteo (free, no key; add to CSP).
- **AI try-on** (see AI details): opt-in and paid.
- **Product-link image import:** needs a server route with SSRF protection (https only, block private IPs, size and time limits, per-user rate limit).
