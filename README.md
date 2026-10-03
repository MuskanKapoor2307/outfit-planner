# Outfit Planner

An invite-only app to plan trip outfits day by day, using your own wardrobe, with optional AI styling.
It works on a laptop and can be added to a phone's home screen like an app.

## What's included

- **Invite-only accounts.** You create one-time invite links and send them yourself.
- **Profiles** inside each account (Me, Mom, Arjun…). Each has its own wardrobe, trips and one of 9 scrapbook themes:
  - **For her:** Picnic, Stylebook, Vloset, Matcha, Happiness
  - **For him:** Denim, Kraft, Varsity
  - **For anyone:** Darkroom
- **Free try-on board (no AI).** Add one full-length photo per profile in the **Profile** tab. Then on any look, choose **⋯ → Try it on me** and drag, resize and tilt the pieces over your photo like a paper doll.
  - Save the layout, or save it as an image.
  - The photo lives in a separate private storage area (`people`) and is never sent to any AI.
- **Trips** (for example "Goa"), split by day. Each day has **sections you name yourself**: a time of day ("Morning"), an event ("Pool party") or a place ("Baga beach").
  Each section can hold **several looks**, and you can star one as the **final pick**.
- **Wardrobe.** Add a photo. Background removal is **optional and free**, because it runs on your device and never uses AI credits.
- **Look builder.** Pick pieces from your wardrobe and add footwear, accessories, hair or grooming, and notes.
- **Optional AI stylist.** Pick or upload pieces (a top, jeans, a jacket…) and ask for the complete look, just footwear, accessories, or hair and makeup or grooming.
  - Anything that uses AI has a colourful **"✦ AI"** badge.
  - Looks made by AI are labelled "AI idea".
  - You can switch AI off completely in **AI settings**.
- **Shopping list per trip.** Add items with a product link and price. Tick them off when bought, then **Move to wardrobe**. Things the AI says are worth buying can be added with one tap.
- **Delete anything** from its **⋯** menu: trips (from the trip list or inside the trip), sections, single looks, wardrobe pieces (one at a time, or with **Select** for several).
- **Account page.** Change your password, download all your data as a zip, or delete your account. Settings live in each profile's **Profile** tab.

---

## One-time setup (about 30–40 minutes)

Everything below uses free plans. No card is needed.

### 1. Create the database (Supabase)

1. Sign up at supabase.com and create a **new project**. Pick the **Mumbai** region if you're in India.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and press **Run**.
   Then, one at a time in new queries, run `supabase/002_sections_themes_ai.sql`, `supabase/003_shopping_list.sql` and `supabase/004_scrapbook_tryon.sql`.
3. Go to **Authentication → Sign In / Providers** and set the following:
   - Turn **off** "Allow new users to sign up". *This is what makes the app invite-only. Don't skip it.*
   - Turn **off** "Allow anonymous sign-ins" if it's on.
   - Keep the **Email** provider on.
   - Under the Email provider, set the **email OTP expiry** to `86400`. This makes invite links last 24 hours, the maximum Supabase allows.
   - Set the **minimum password length** to `10`.
4. Create **your own** login: **Authentication → Users → Add user → Create new user**.
   Enter your email and a strong password, and tick **Auto confirm user**.
5. Make yourself the admin. In the SQL Editor, run (with your email):
   ```sql
   insert into public.app_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
6. Go to **Project Settings → API keys** and note three values:
   - the **Project URL**
   - the **anon / publishable** key (public)
   - the **service_role / secret** key (**secret**: never share it, never put it in chat, never commit it)

### 2. Run it on your computer (optional but recommended)

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local     # then fill in the values from step 1.6
npm run dev
```

Open http://localhost:3000 and log in with the account from step 1.4.

### 3. Put it online (Vercel)

1. Push this folder to a GitHub repository. A **public** repo is fine, and it also handles the licence point below.
   The `.gitignore` already keeps `.env.local` (your secrets) out of Git.
2. On vercel.com, choose **Add New → Project** and import the repository.
3. Under **Environment Variables**, add the same five values as `.env.example`.
   For `APP_URL`, use the address Vercel gives you, for example `https://my-outfits.vercel.app` (no slash at the end).
4. Deploy. If you only learned the address after deploying, update `APP_URL` and click **Redeploy**.
5. Back in Supabase, open **Authentication → URL Configuration** and set **Site URL** to the same address.

### 4. Install it on a phone

- **Android (Chrome):** open the site, tap the **⋮** menu, then **Add to Home screen** (or **Install app**).
- **iPhone (Safari):** open the site, tap **Share**, then **Add to Home Screen**.

---

## Updating to the scrapbook + try-on version

Run `supabase/004_scrapbook_tryon.sql` once in the **SQL Editor**. It switches profiles to the new scrapbook themes and adds the private `people` storage area for try-on photos. Then restart the app, or push to GitHub so Vercel redeploys.

## Updating to the shopping-list version

Run `supabase/003_shopping_list.sql` once in the **SQL Editor**, then restart the app (or push to GitHub, and Vercel redeploys).

## Updating from the first version

If you already ran `schema.sql` earlier, you only need to:

1. Run `supabase/002_sections_themes_ai.sql` once in the **SQL Editor**. Existing Morning, Afternoon, Evening and Night outfits are moved into sections automatically, and old themes are switched to their closest new ones.
2. Stop the app with `Ctrl + C` and start it again with `npm run dev`.

---

## Using AI (optional)

Open **AI** (top right on the profile screen), or go to **Account → AI settings**. Then choose one of these:

| Option | Cost | What you need |
|---|---|---|
| Google Gemini | Free, with a daily limit | A free key from Google AI Studio. No card needed. |
| Claude | Pay per use | An Anthropic API key, which is separate from a Claude Pro subscription |
| OpenAI | Pay per use | An OpenAI API key, which is separate from ChatGPT Plus |
| My chat app | Your existing subscription | Nothing. You copy a ready prompt and your photos into the Claude or ChatGPT app, then paste the reply back. |

How it works:

- **Keys stay on your device.** They're saved only in this browser on this device, never in the database or on the server. Requests go straight from your device to the AI company.
- **Three ways to keep a key:**
  - on this device,
  - on this device but locked with a PIN (the key is encrypted), or
  - only until you close the tab.
- **When the free Gemini limit runs out,** the app automatically tries the lighter Flash-Lite model. If that's also used up, it offers to switch to your chat app for that request.
- **Before your first request to each AI,** the app explains what will be sent: your selected photos and a text list of your wardrobe (names, colours and tags, no photos).
- **AI replies are treated as untrusted.** Only known fields are read, they're shown as plain text, and pieces are only linked if they really exist in your wardrobe.
- **Model names change over time.** If a provider renames its models, update the model name in AI settings.

To use the app purely as a planner, turn off **Show AI features** in AI settings.

---

## Inviting people

1. Log in, then tap **Invites** (only the admin sees this).
2. Type their email and tap **Create invite link**.
3. Copy the link and send it to them yourself, or use **Send on WhatsApp**.
4. They open it, tap **Accept invite**, and choose a password.

Things to know:

- **No emails are sent by the app.** You share links yourself, so you don't need an email service.
- **Links work once and expire after 24 hours.** If one expires, tap **New link** next to their name.
- **Link previews can't use up the invite.** WhatsApp and email previews often "open" links, so the code is only used when the person taps **Accept invite** themselves.
- **Forgotten password:** tap **Reset link** next to their name and send them the new link.
- **Removing someone:** tap **Remove**. This deletes their photos and plans permanently.
- **Account limit:** the app allows at most `MAX_USERS` accounts (15 by default), counting you.

---

## Security checklist: do this **before** inviting anyone

1. **Public sign-up is really off.** In a terminal, run this with your values:
   ```bash
   curl -s -X POST "https://YOUR-PROJECT.supabase.co/auth/v1/signup" \
     -H "apikey: YOUR_ANON_KEY" -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpassword123"}'
   ```
   The reply must say that sign-ups are **not allowed**. If it creates a user, go back to step 1.3.

2. **Every table is locked.** In the SQL Editor, run:
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public';
   ```
   Every row must show `true`. Then open **Advisors → Security Advisor** in Supabase. It should show no errors.

3. **One person can't see another person's data.**
   - Invite a second email address that you own, log in as that account, and add a profile and one wardrobe photo.
   - Note the profile's address in the browser bar (`/p/…`).
   - Log out, log in as yourself, and paste that address. You must see **"Profile not found"**.

4. **Photos are private.** In **Storage**, the `wardrobe` bucket must **not** be marked Public.

5. **The secret key isn't in the app's code.** After `npm run build`, run:
   ```bash
   grep -rl "PASTE_THE_FIRST_20_CHARACTERS_OF_YOUR_SERVICE_KEY" .next/static
   ```
   It must print nothing.

6. **Security headers are on.** Open your live site, press F12, open **Network**, click the page request, and look under **Response headers**.
   You should see `content-security-policy`, `x-frame-options: DENY` and `referrer-policy: no-referrer`.

---

## What's protected, and how

| Risk | Protection |
|---|---|
| Strangers signing up | Public sign-up is off. Only admin-made invite links create accounts. |
| Reading someone else's data | Row Level Security on every table and on photo storage, keyed to the logged-in user. |
| Someone making themselves admin | The admin table has no write rules, so it can only be changed in the SQL Editor. |
| Leaked secret key | The service key is used only in server routes. The `server-only` guard fails the build if browser code imports it. |
| Malicious scripts on the page | A strict security policy (CSP) with a fresh code per request. The page can only talk to your Supabase project, the background-remover download site, Google Fonts, and the three AI providers. |
| Clickjacking, leaky links | The app can't be embedded in other sites, and no referrer is sent, so invite codes don't leak. |
| Hidden GPS location in photos | Photos are re-drawn and re-saved on the device, which strips location data. |
| Filling up the free quota | 2 MB per photo, 450 photos per account, and limits on profiles, trips and outfits. |
| Link previews using up invites | The invite code is only used when the person taps **Accept invite**. |
| AI keys leaking from the server | There's nothing to leak there. Keys never reach the server or database; they stay on the person's device, optionally PIN-encrypted. |
| A stolen AI key running up bills | Guidance in the app: use a separate key, prepaid credits and spending limits, and remove keys on shared devices. |
| Try-on photos | Kept in a separate private bucket that only the owner can read. Adding one needs a consent tick, and it's deleted with the profile or account and included in the data download. It's never sent to AI. |
| AI replies injecting content | Replies are parsed strictly, shown as plain text (never HTML), and only real wardrobe pieces are linked. |

---

## Honest limits and heads-ups

- **The background remover is downloaded once per device** (roughly 40–80 MB) from IMG.LY's servers the first time it's used. After that it's cached. Your photo itself never leaves your device during removal.
- **Licence:** the background remover is **AGPL-3.0** licensed. Because invited people use the app over the internet, the simplest way to comply is to keep this repository **public**. It contains no secrets.
- **You can see everyone's data in the Supabase dashboard,** even though the app blocks it. The Account page tells your invitees this.
- **Free Supabase projects pause after about a week with no activity.** Your data stays; press **Restore** in the dashboard.
- **The free plan has no proper backups.** Use **Account → Download my data** once a month.
- **Invite and reset links last at most 24 hours** (a Supabase limit). Generate a new one any time.
- **Photos load through temporary links** that expire after 1 hour and are refreshed automatically.

## Troubleshooting

- **"Server is missing Supabase settings":** an environment variable is missing on Vercel. Add it and redeploy.
- **Invite link says it expired immediately:** check the email OTP expiry from step 1.3 and that `APP_URL` matches your real address.
- **Creating an invite fails with a sign-up error:** tell me the exact message. Admin invites are supposed to work while public sign-up is off.
- **Background removal fails on an old phone:** turn off **Remove background** and save the photo as it is.

## Project layout

```
app/                 screens (login, welcome, profiles, trips, wardrobe, admin, account, AI settings)
app/api/             server routes that use the secret key (invites, removals, account deletion)
components/          shared pieces (sheets, look board, theme picker, item editor…)
lib/                 Supabase clients, image processing, themes, helpers
lib/ai/              AI settings and key storage (device only), providers, prompt and reply checking
proxy.ts             security policy (CSP) added to every page
supabase/schema.sql  tables, limits, Row Level Security and storage rules
supabase/002_….sql   sections, final pick, AI flag, new themes, extra categories
supabase/003_….sql   shopping list per trip
supabase/004_….sql   scrapbook themes, try-on photo and layouts
```
