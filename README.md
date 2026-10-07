# BNI Dheeras Chapter App

Chapter app for BNI Dheeras (Madurai):

- **Attendance:** self-scan of a rotating QR, PALMS summary and absence alerts.
- **Members:** profiles and a nearest-to-farthest map.
- **Chapter life:** calendar, 1-to-1 dance cards with PDF, weekly recognitions, birthday and anniversary celebrations, suggestions and feedback to the Head Table.

The design, loophole list and decisions are in [docs/PLAN.md](docs/PLAN.md).

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16.3 (App Router, Turbopack, React Compiler), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix), BNI brand colours |
| Database | Neon Postgres in production; [PGlite](https://pglite.dev) locally. Same `pg` driver for both, via Drizzle ORM. |
| Auth | Better Auth: mobile number (or email) and password. Members start on the chapter's default password and set their own at the first sign-in; the Head Table resets forgotten ones. No email service, no self sign-up. |
| Images | Neon Object Storage, S3-compatible, in the same Neon project (Cloudflare R2 also works). Images are compressed to WebP in the browser and checked by the server. |
| Maps | Leaflet + OpenStreetMap (free), address search via Nominatim |
| Email (optional) | Resend, only for email copies of alerts; everything also appears in-app |
| Hosting | Any Node.js host. Put it in or near Singapore, next to the Neon database. |

## Run it locally

Needs Node.js 22+.

```bash
npm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET
npm run db:local                # terminal 1: local Postgres (PGlite) on port 5433, keep it running
npm run db:migrate              # terminal 2: create the tables
npm run seed                    # optional: demo chapter (12 members, venue, meetings)
npm run dev                     # http://localhost:3000
```

- **Signing in locally:** every demo member starts on the demo default password `Dheeras@2026`.
  - Admin: `9840010000` or `admin@dheeras.test`.
  - President Arun: `9840010001`.
  - The first sign-in asks you to choose your own password.

### How members sign in

- **Login ID:** the member's mobile number (or email). The password field has a show/hide toggle for phones.
- **First time:** members start on the chapter's **default password**.
  - Where it lives: Admin → Settings → Member sign-in. It's generated on first use, and admins can change it.
  - After that first sign-in, the app makes them choose their own password before anything else.
  - On Admin → Members, a *default password* badge shows who hasn't done this yet.
  - **Password** next to a member shows their login details with **Send on WhatsApp**.
- **Staying signed in:** members stay signed in until they sign out. Every visit extends the session; it only lapses after 400 days without opening the app (the browser cookie limit). Changing your own password (My profile → Password) keeps you signed in.
- **Forgot password:** the President, VP or Secretary taps **Password → Reset to default password**, on the member's profile or in Admin → Members.
  - The member signs in with the default and chooses a new password.
  - A Head Table member can't reset someone who has more access than they do. For example, a VP can't reset the President or the Secretary, because that would let them sign in as that person. Only the President or an admin can reset those.
- **Guessing limits:** 8 wrong passwords for one login ID, or 30 from one network, in 15 minutes block further tries for 15 minutes.
- **Emergency:** there is no recovery page. If no admin or President can sign in, the password has to be reset in the database — any admin who can still sign in should do it from Admin → Members instead.

### Testing on a real phone

The camera, the device key (WebCrypto) and GPS for Near me only work over HTTPS. The easiest way is a staging deployment, or an HTTPS tunnel to the dev server (`npx localtunnel --port 3000`).

On iPhone, use **Share → Add to Home Screen** first, then register the phone from the installed app. iPhone keeps the Home-Screen app's storage separate from Safari's.

## Deploy (production)

1. **Neon:** create a project in **AWS Singapore**.
   - Copy the *pooled* connection string (host contains `-pooler`).
   - Create the tables once:
     ```bash
     DATABASE_URL="postgres://…-pooler…/neondb?sslmode=require" npx drizzle-kit migrate
     ```
2. **Neon Object Storage** (photos and logos), in the same Neon project:
   - Branch → **Object storage** → **New bucket**. Keep it **private**: the app serves photos itself, only to signed-in members and the paired venue screen.
   - **Connect → Storage** → *Reveal credential*. The ID starts with `nak_live_`, the secret with `nsk_live_`; copy both.
   - Set `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID` and `STORAGE_SECRET_ACCESS_KEY`.
   - Check them before deploying: put the values in `.env` and run `node scripts/check-storage.mjs <bucket>`.
   - No CORS setup is needed: uploads (`/api/uploads`) and reads (`/api/media`) both go through the app, which checks each upload is a real image.
3. **Email (optional):** sign-in doesn't need email. Only if you want email copies of alerts and the Monday report, set `RESEND_API_KEY` and `EMAIL_FROM`.
4. **The host:** point it at the repository and add the variables from [.env.example](.env.example).
   - `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` are **required**: nothing else tells the app which origin it is served from. Production is <https://darkred-locust-154312.hostingersite.com> — set both to it, with no trailing slash, or sign-in is rejected as an untrusted origin.
   - Build command: `npm run build` — it applies any pending database migrations, then builds.
     - It passes `--webpack`, because Next's native SWC/Turbopack binaries need glibc 2.29+ and some shared hosts are older. The command is written this way, rather than as a separate script, because hosts like Hostinger only offer `npm run build`. For a quick local build without migrations, use `npm run build:local`.
     - The build needs `devDependencies` (TypeScript, Tailwind, the React Compiler plugin, drizzle-kit), so don't install with `--omit=dev`.
     - `DATABASE_URL` and `NEXT_PUBLIC_APP_URL` must be set at **build** time, not only at runtime.
   - Start command: `npm start`.
   - Weekly housekeeping: set `CRON_SECRET` and have the host's scheduler call the endpoint every Monday, e.g.
     `curl -H "Authorization: Bearer $CRON_SECRET" https://darkred-locust-154312.hostingersite.com/api/cron/monday-report`.
5. **First admin:** created in the database, not in the app — there is no setup page. On a fresh database, insert one member row with `is_admin = true` and a password hash, or run `npm run seed` against it and delete the demo members afterwards.
6. **Optional:** `NOMINATIM_EMAIL`, a contact address for OpenStreetMap's address search.

## Chapter rollout checklist

1. **Admin → Venues:** the meeting hall's name and address. There's no geofence: check-in doesn't use location.
2. **Admin → Meetings → Weekly series:** day and time. There's no grace period: a check-in after the start time is Late. Weeks that already have a meeting are skipped.
3. **Admin → Members → Import CSV:** BNI Connect roster saved as CSV, or add members one by one.
   - The mobile number is each member's login ID.
   - Everyone starts on the default password (Admin → Settings → Member sign-in). Share it with the chapter, or send each member their details from **Password → Send on WhatsApp**.
   - An account that only runs the app, such as "BNI Dheeras Admin", must have **Chapter member** unticked (Edit). It then never checks in and is left out of PALMS, absences, the directory, recognitions and celebrations.
4. **Admin → Roles & terms:**
   - President, VP, Secretary/Treasurer, LVH Team, Attendance Coordinator. The eye icon next to a role shows what it can do.
   - The President of the current term gets the same full access as an Admin. When a new term starts, it moves to the new President.
   - The app refuses to give anyone else both device-approval and manual check-in roles.
5. **Device-setup meeting:**
   - every member installs the app on their own phone (Add to Home Screen) and opens it;
   - they sign in there with their mobile number and the default password, choose their own password, and tap *Register this phone*. On iPhone, the installed app doesn't share sign-in with Safari, so they sign in inside the installed app;
   - the Attendance Coordinator approves each phone face-to-face by matching the 4-digit code.
6. **LVH desk → Pair a venue screen:** pair the projector laptop and open the meeting's QR.
7. **Shadow run:** run two meetings alongside the current method, compare PALMS, then switch over.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run db:local` | Local PGlite Postgres on port 5433 (data in `.data/`) |
| `npm run db:generate` | New SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run seed` | Demo data (local databases only) |
| `npm test` | Unit tests (QR tokens, late rule, device signatures, distances, pagination, celebrations…) |
| `npm run typecheck` / `npm run lint` | Checks |
| `npm run build` | What the host runs: migrations, then a webpack production build |
| `npm run build:local` | Quick local production build — Turbopack, no migrations |

## Where things are

| Path | Contents |
|---|---|
| `src/lib/attendance/` | Check-in rules:<br>• `service.ts`: the six checks, LVH pass scan, manual check-in, finalize<br>• `qr-token.ts`: rotating HMAC token<br>• `device-crypto.ts`: device-key signatures |
| `src/lib/device-key.ts` | The phone's non-extractable signing key (browser side) |
| `src/actions/` | Server actions. Every one checks the session and the caller's capability. |
| `src/lib/permissions.ts` | Roles → capabilities, separation-of-duties rule |
| `src/app/kiosk/` | Venue screen (rotating QR, welcome wall) |
| `src/app/(app)/lvh/` | LVH desk and live board |
| `src/db/schema.ts` | All tables; migrations are in `drizzle/` |
| `docs/brand/` | `bni-dheeras-logo.png` (in-app logo and browser-tab icon) and `bni-dheeras-app-icon.png` (the installed app's home-screen icon). After replacing either, run `python scripts/make-icons.py` (needs Pillow). |

## Known limits

- **Proxy check-ins can't be fully blocked.** There's no geofence (PLAN D9), so someone in the room can send a photo of the live QR to an absent member, who has 30 seconds to scan it. A member can also hand their phone to someone in the room. These cases are made visible instead: names on the venue screen, flags, and the headcount check before finalize (see PLAN §1 and §4.3). With no geofence and no selfie check, this visibility is the only control. Watch the headcount mismatches during the shadow run.
- **Tamil text in the dance-card PDF:** the PDF prints in the card's own font (Helvetica). Tamil letters and emoji come out as "?", and the form warns about this; ₹ prints as "Rs.". To change the card, replace `docs/dance-card-template.pdf`, run `node scripts/embed-dance-card-template.mjs` and update the line positions in `src/lib/dance-card.ts`.
- **OpenStreetMap's public tile server** is fine for a chapter. For heavier use, set `NEXT_PUBLIC_MAP_TILE_URL` to another tile provider.
