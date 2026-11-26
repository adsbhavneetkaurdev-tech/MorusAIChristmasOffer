# Christmas Gift Drop · Brar Mortgages × Morus AI

A festive "scan, unwrap, win" web app for a live event. Guests scan a QR code on the projector, tap to unwrap a gift on their phone, see what they won and claim it. Their unique gift code is then emailed to them. You control prizes, odds and timing from an admin dashboard.

| Page | Who uses it |
|---|---|
| `/` | Guests' phones (the QR code points here) |
| `/screen` | Projector / TV (1920×1080, scales to any 16:9 screen) |
| `/admin` | You (password protected) |
| `/preview` | You: every phone screen and state side by side |

The Morus AI logo lives at `public/morus-logo.png` (cropped, transparent PNG). To change it, replace that file and keep the same name.

---

## 1. Deploy to Vercel (step by step)

You need free accounts on **GitHub** and **Vercel**.

1. **Put the code on GitHub.** Unzip `christmas-gift-drop.zip`. On github.com click **New repository**, name it `christmas-gift-drop`, make it **Private**, create it. Then click **uploading an existing file** and drag in *everything inside* the unzipped folder (not the folder itself). Click **Commit changes**.
2. **Import into Vercel.** On vercel.com click **Add New → Project**, pick the `christmas-gift-drop` repository and click **Import**. Don't deploy yet; first expand **Environment Variables** (step 4). If it already deployed, that's fine: add the variables later and redeploy.
3. **Add the database (Upstash Redis, free).** In your Vercel project open **Storage** (or **Marketplace**) → **Upstash** → **Redis** → **Create**. Choose the free plan and a region close to your event (e.g. *us-west-1* for Western Canada), then **Connect** it to this project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you automatically.
4. **Add the environment variables** (Project → **Settings → Environment Variables**):

   | Name | What to put |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | Your site address, e.g. `https://christmas-gift-drop.vercel.app` (no slash at the end). The QR code points here. |
   | `ADMIN_PASSWORD` | The password for `/admin`. Pick something strong. |
   | `ADMIN_SESSION_SECRET` | Any long random text, 32+ characters (e.g. mash the keyboard). |
   | `EMAIL_FROM` | `Morus AI <info@morusai.com>` |
   | `RESEND_API_KEY` | Optional, see section 2. |

5. **Deploy.** Go to **Deployments**, then on the latest one click **⋯ → Redeploy** (needed after adding variables). When it's done, open `https://YOUR-SITE/admin` and sign in.
6. Check the admin page: if you see a yellow box saying **"Storage: in-memory"**, the Redis step didn't connect. Redo step 3 and redeploy.

> If you use a custom domain later, update `NEXT_PUBLIC_SITE_URL` and redeploy, or the QR code will point to the old address.

## 2. Optional: send real emails (Resend)

Without this, the app still works: claims are saved and shown in the admin, but the email is only written to the Vercel log (admin shows "Logged only").

1. Create a free account at resend.com.
2. **Domains → Add domain → `morusai.com`**. Resend shows a few DNS records (TXT/MX/CNAME). Add them where morusai.com's DNS is managed (GoDaddy, Cloudflare, etc.). Wait until Resend shows **Verified** (minutes to a few hours).
3. **API Keys → Create API key** (sending access). Copy it.
4. In Vercel add `RESEND_API_KEY` with that value and redeploy.
5. Test: do a rehearsal claim with your own email. The admin "Email sent" column should say **Sent**. If it says **Failed**, hover it to see why, fix, and click **Resend**.

Free Resend allows 100 emails/day, enough for 120 guests if you don't rehearse heavily on the same day (or upgrade for a month).

## 3. Event-day checklist

1. On your phone or laptop open **`/admin`** and sign in.
2. **Check the prizes**: names, quantities, chances (must show "Chances: 100% ✓"), jackpot turn number, fallback. Click **Save changes** if you edited anything.
3. Click **Simulate 120 guests** to sanity-check how prizes will split.
4. Make sure the drop is **Waiting** with 0 unwrapped. If not, click **Reset for rehearsal**.
5. On the **projector laptop**, sign into `/admin` once (so the sound button appears), then open **`/screen`** (use the **Open projector screen** button).
6. On the projector screen click the small **Enable sound** button (bottom-right). Browsers block audio until you click on the page.
7. Press **F** for fullscreen. It shows "Get ready…" until you start.
8. Scan the QR code with your own phone to confirm it opens the gift page ("The gift drop starts soon").
9. At the right moment press **Start gift drop** on the admin page (from your phone is fine). Every phone and the projector switch to live within ~3 seconds.
10. During the drop you can **Pause / Resume**, add **+1 min**, or **End now**. Watch claims come in live.
11. Afterwards click **Export CSV** to download all leads.

Tips: keep the projector laptop plugged in and stop it from sleeping. Guests who don't finish the form before time runs out can still claim their gift later on the same phone.

## 4. Rehearse and reset

- Run through the whole thing with a few phones beforehand. To test many unwraps from one phone, turn **One gift per phone** off (remember to turn it back on).
- **Reset for rehearsal** clears all turns and claims and restores every quantity; your prize settings are kept. Phones that already unwrapped start fresh automatically. **Export the CSV first if you want to keep anything.**
- **Reset to defaults** (in the Prizes panel) restores the original prizes, rules and event details.
- `/preview` shows every screen without touching real data.

## 5. How prizes work

- Each unwrap gets the next **turn number** (1, 2, 3…).
- If a prize lists that turn under **Always won at turn #** and has stock, it wins (the jackpot is at turn 7 by default). Stock for future guaranteed turns is held back, so the jackpot can't be won early by chance.
- Otherwise a prize is picked by **chance %** (or **weighted by what's left**, if you choose that). Prizes at 0% or sold out are skipped and the rest re-balanced.
- When everything runs out, the **fallback** prize is given without limit, or guests see "All gifts have been claimed".
- One gift per phone: refreshing never re-rolls.
- Allocation runs atomically inside Redis, so 100 people tapping at the same moment can never oversell a prize or create two jackpots.

---

## For the developer

### Run locally

```bash
npm install
npm run dev      # http://localhost:3000, admin password "admin" in dev if ADMIN_PASSWORD is unset
npm test         # prize engine + Redis Lua parity tests
npm run build
```

Without `KV_REST_API_URL`/`KV_REST_API_TOKEN`, the app uses an in-memory store (single process, dev only). Without `RESEND_API_KEY`, emails are printed to the console.

### Structure

```
app/                    pages + API routes (App Router)
  api/session           public status (polled by phones and projector, 1s per-instance cache)
  api/unwrap, api/claim, api/device, api/unsubscribe
  api/admin/*           config, session actions, stats, claims (+ .csv), simulate, resend, login/logout
components/phone        Screens.tsx (presentational) + GiftApp.tsx (state machine)
components/projector    ProjectorScreen.tsx
components/admin        AdminDashboard.tsx, LoginForm.tsx
emails/GiftEmail.ts     table-based HTML + plain text
lib/engine.ts           pure prize-choice logic + simulator
lib/service.ts          business logic (unwrap, claim, session)
lib/store/              GiftStore interface + redisStore + memoryStore + allocate Lua script
lib/sound.ts            Web Audio synthesized sounds
lib/email.ts            sendGiftEmail() (Resend or console)
tests/                  vitest: engine rules, concurrency, Lua parity (runs the Lua in fengari)
```

### Data model (`lib/types.ts`)

- **Config**: `prizes[]` (`id, name, active, offerType, value, quantity, chancePercent, guaranteedTurns[], isJackpot`), `pickMode`, `fallbackPrizeId`, `offerSubject`, `offerDescription`, `countdownMinutes`, `expectedGuests`, `onePerDevice`, `projectorSounds`, `hostName`, `bookingUrl`, `contactEmail`.
- **SessionState**: `status (waiting|live|paused|closed)`, `endsAt`, `pausedRemainingMs`, `startedAt`, `runId` (changes on reset).
- **Allocation**: `allocId` (= deviceId, or `deviceId#turn` when one-per-device is off), `deviceId`, `turn`, `prizeId`, `at`.
- **Claim**: allocation fields + `name, email, company, phone, consent, code, emailStatus, emailError, unsubscribed, createdAt`.
- "Remaining" is never stored: the store keeps a **given** count per prize, and remaining = quantity − given. Editing a quantity therefore never needs a data migration.

Redis keys (`gd:` prefix) are documented at the top of `lib/store/redisStore.ts`.

### Swapping the database

Implement `GiftStore` from `lib/store/types.ts` and return it from `getStore()` in `lib/store/index.ts`. Everything else talks only to that interface. The one hard requirement: **`allocate()` must be atomic.** It reads the stock, calls the same rules as `choosePrize()` in `lib/engine.ts`, increments the turn counter and the given count, and saves the allocation as one indivisible step. In Postgres, for example: a transaction that `SELECT … FOR UPDATE`s a single counters row, calls `choosePrize()` in application code, then writes the allocation (unique on `alloc_id`) and updated counts. `createClaim` and `reserveCode` must be insert-if-absent (unique constraints). The tests in `tests/engine.test.ts` take any store; point them at yours to verify (200 concurrent unwraps must never oversell).

### Notes

- Countdown: every client computes `endsAt − (Date.now() + offset)`, where `offset` comes from `serverNow` in `/api/session`, corrected for round-trip time.
- Rate limits: unwrap 15/min per device and 300/min per IP (event Wi-Fi often shares one IP); claim 10/min per device.
- Upstash free-tier usage: ~120 phones polling for 10 minutes is roughly 100–150K commands. Fine for the event plus a few rehearsals, but keep an eye on it if you rehearse a lot on the free plan.
- Unsubscribe: the link in the email opens `/unsubscribe?code=…` with a confirm button (mail-scanner safe); the `List-Unsubscribe` header supports one-click unsubscribe from Gmail and others. Unsubscribed claims are flagged in the admin and the CSV.
