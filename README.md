# THE LAST CHECKPOINT

A browser-based, online **1v1 zombie deception game**. One player is **the Guard** at the gate of the last safe building. The other is **the Infiltrator**, a zombie wearing a stolen human face, hidden among six visitors who come to the Guard's window one by one. They play from separate phones or computers, anywhere, over a private invitation link.

> **Status — please read.** Version 2 is the first-person "anomaly checkpoint" design. The game engine is covered by automated tests (19 passing, including hidden-information and answer-timing leak checks), and every screen was rendered and clicked through in a headless browser. **Online multiplayer has not been tested live yet**, because it needs your Supabase project. The frontend also hasn't been through a full `vite build` yet: it was written in an environment without npm access. Follow *Setup* below, then run `npm run build` and `npm run test:multiplayer` to verify. Fix-ups, if any, should be small.

---

## Contents

1. [How the game plays](#how-the-game-plays)
2. [Architecture](#architecture)
3. [Security model](#security-model)
4. [Project structure](#project-structure)
5. [Setup (Supabase)](#setup-supabase)
6. [Run locally](#run-locally)
7. [Put it on GitHub](#put-it-on-github)
8. [Deploy to Vercel](#deploy-to-vercel)
9. [Test a match on two devices](#test-a-match-on-two-devices)
10. [Tests](#tests)
11. [Tuning the balance](#tuning-the-balance)
12. [Troubleshooting](#troubleshooting)
13. [What's next](#whats-next)

---

## How the game plays

**One night shift, 6 visitors, about 8–12 minutes. Roles are random every match.**

### The Guard: first-person booth
You sit in a checkpoint booth. A big window fills the middle of the screen, and visitors walk up to it **one at a time**. Their words appear as subtitles. Your desk sits along the bottom, and every object on it is interactive:

| Desk object | What it does | Cost |
|---|---|---|
| **ID card** | The visitor's card, with a photo. Compare it to the face in the window | free |
| **Computer** | Search the resident registry: occupation, emergency contact, status (ACTIVE / **MISSING** / no record) | 1 action |
| **Phone** | Call the registered emergency contact | 2 actions |
| **Intercom** | Ask preset questions, **type your own question**, or give orders: *take off your sunglasses / open your mouth / hands on the glass / remove that bandage* | 1 action each |
| **Tools** | Thermometer, flashlight (pupil reaction) | 1 action each |
| **Guide** | Field guide to the signs of infection, including the innocent look-alikes | free |
| **Stamps** | **APPROVE** or **DENY** | ends the visit |

You get **6 actions per visitor**. Signs of infection are visual, anomaly-style: clouded eyes, grey skin, black gums, grey nails, a bite on the neck, a cold body, an ID photo that doesn't match. Innocent people come with their own red herrings: sunglasses for an eye injury, a bandaged cut, a fever, chills from the rain, yellow teeth, dirty nails, an expired card with an old photo, no registry record, a contact who doesn't pick up, or a shy refusal.

### The Infiltrator: a real player the whole shift
1. **Steal a face.** Choose one of 3 identities, each with a different risk: an *active resident* whose ID photo doesn't quite match you, a *missing person* who matches perfectly but is flagged MISSING, or an *unregistered refugee* with nothing to check against.
2. **Hide your rot.** You get 3 random anomalies and can cover 2 of them: sunglasses, makeup, a heat pack or a bandage. You can also wear a cover as a decoy.
3. **Choose your moment.** Watch the Guard work on other visitors, then step into line whenever you like. The Guard never knows which visitor you are. Visitor #1 is always human, and you must arrive by visitor #6.
4. **Sabotage** (once each, hits the next visit): cut the phone line, crash the database, or set off an alarm that costs 2 actions. Use it on yourself, or waste the Guard's tools on an innocent.
5. **At the window, you choose every word.** Your stolen memory is full of holes: you know what's printed on the card, but not always your old job or your emergency contact. For orders, you **comply** (they see it) or **refuse** with an excuse. Humans refuse sometimes too.

### Keeping the bluff fair
- NPCs and the Infiltrator speak from the **same pool of lines**. Typed questions are understood by keyword, so NPCs answer them too, with small talk when the question isn't recognised.
- **Answer timing is hidden.** NPC answers are held back on the server for a random human-like delay. A zombie who answers instantly is also held back. The Guard's view is byte-identical before and after the zombie answers until the reveal moment (this is a test in `tests/engine.test.ts`).
- If the Infiltrator lets the 15-second timer run out, their disguise mumbles a deflection, or refuses an order.

### Winning
| Guard wins | Infiltrator wins |
|---|---|
| **DENY** the infected | Gets stamped **APPROVE** |
| | Trust hits 0. Every innocent you deny costs 25 trust, so denying everyone loses |

## Architecture

```
 Browser (Guard)                         Browser (Infiltrator)
 React + Vite + Tailwind + Framer        React + Vite + Tailwind + Framer
   │  RPC: create/join/leave room          │
   │  POST /functions/v1/game (actions)    │
   │  Realtime: own player_views row       │
   ▼                                       ▼
 ┌──────────────────────── Supabase ─────────────────────────┐
 │ Auth: anonymous guest sessions (persist across refresh)   │
 │ Postgres:                                                 │
 │   rooms         (RLS: members only)                       │
 │   matches       (RLS: members only)                       │
 │   player_views  (RLS: player_id = auth.uid())  ◄─ Realtime │
 │   match_secrets (RLS on, NO policies → service role only) │
 │ Edge Function `game`  ── runs the authoritative engine ── │
 │   supabase/functions/_shared/engine/*.ts                   │
 └───────────────────────────────────────────────────────────┘
```

- **One authoritative engine** (`supabase/functions/_shared/engine/`), pure TypeScript and deterministic from a server-side random seed. It runs only in the Edge Function. The frontend imports its *types and constants* only.
- Every action goes `client → game function → validate role & rules → apply → write state (optimistic version check, auto-retry) → write role-filtered views`.
- Each player subscribes to **their own** `player_views` row over Realtime. Both see the same events (visitors arriving, tool results, answers, orders, sabotage, decisions) in real time, through their own filtered lens.
- Timers (answer reveal delays, the zombie's 15 s answer limit) are enforced on the server. While an answer is pending, the Guard's client sends a lightweight `tick`; the server reveals answers only when their time has come.
- Presence (Supabase Realtime) shows who is connected. A heartbeat RPC lets the server verify a 90-second reconnection window before anyone can claim a forfeit win.

## Security model

- **The Guard's browser never receives the Infiltrator's identity.** The full state (which visitor is infected, anomalies, disguise items, red herrings, registry records, memory, answer options, reveal times) lives only in `match_secrets`. Players can't read it under RLS. The Guard gets a `GuardView` built by `buildView(state, 'guard')`, and tests assert it contains none of the secret fields.
- NPC answers are computed instantly but **held back for a random delay**, and the zombie's answers are held back too. Response timing can't reveal who is human. Appearance changes (sunglasses off, mouth open) also apply only at reveal time.
- A player's view row is only rewritten when *their* view changes. The Infiltrator's private actions (building the disguise, stepping into line, arming sabotage, choosing an answer) never trigger a realtime event on the Guard's side.
- Every action is validated on the server: role, phase, actions per visitor, one use per tool per visitor, which orders are possible, disguise limits and sabotage charges. **Client state is never trusted.**
- **Duplicate protection:** each action carries an `actionId`. The server ignores repeats, and concurrent writes use optimistic versioning.
- **Rooms:** 6-character codes from a 31-symbol alphabet using cryptographically secure randomness. A room holds only 2 players, can't be joined once a match is running, and expires after inactivity. Non-members can't see a room at all, and creating rooms is rate-limited.
- **Keys:** the frontend uses only the public anon/publishable key, which RLS protects. The **service-role key is only ever read inside the Edge Function** (Supabase injects it automatically). Never put it in a `VITE_` variable.
- **Known trade-off:** Realtime presence channels are named after the room's UUID, which only members know. Presence carries only user ids.

## Project structure

```
the-last-checkpoint/
├─ index.html · vite.config.ts · tailwind.config.js · postcss.config.js · tsconfig.json
├─ vercel.json                 SPA rewrites so /join/CODE and /room/CODE work
├─ .env.example
├─ public/favicon.svg
├─ src/
│  ├─ main.tsx · App.tsx       tiny router: /, /join, /join/:code, /room/:code
│  ├─ index.css                Tailwind + game UI primitives
│  ├─ lib/                     supabase client & guest session, API calls, synth sound, utils
│  ├─ hooks/                   useRoom (room row + presence + heartbeat), useMatchView (own view, realtime)
│  ├─ components/              Portrait (procedural faces + anomalies), DeskIcons, Atmosphere, UI widgets
│  ├─ screens/                 MainMenu, JoinScreen, Lobby, RoleReveal, GuardBooth (first-person),
│  │                           ZombieScreen, ResultScreen (+ stats), RoomPage
│  └─ preview/                 offline hot-seat preview (both roles on one screen)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/20261109000000_init.sql   tables, RLS, realtime, RPCs
│  └─ functions/
│     ├─ game/index.ts                     authoritative Edge Function
│     └─ _shared/engine/                   types.ts · data.ts · engine.ts · index.ts
└─ tests/
   ├─ engine.test.ts           rules, wins, hidden-info and timing leaks, duplicates (no network)
   └─ multiplayer.test.ts      live end-to-end against your Supabase project
```

All art (the procedurally drawn visitors, the booth, the desk objects, rain and fog) is drawn in code, and all sound is synthesized with the Web Audio API, so there are no assets to license.

---

## Setup (Supabase)

You need: a free [Supabase](https://supabase.com) account, [Node.js 20+](https://nodejs.org), and the Supabase CLI (used through `npx`, no global install needed).

1. **Create a project** at supabase.com → *New project*. Pick a region near you and your friends (e.g. Frankfurt for Israel/Europe). Save the database password.
2. **Enable guest sessions:** *Authentication → Sign In / Providers → Allow anonymous sign-ins → ON*. Save.
3. **Get your keys:** *Project Settings → API* (or *API Keys*). Copy the **Project URL** and the **anon / publishable** key. Do **not** copy the service-role key anywhere.
4. **Install and link** (from the project folder):
   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF    # the ref is the xxxx in https://xxxx.supabase.co
   ```
5. **Create the database schema:**
   ```bash
   npx supabase db push
   ```
   *Alternative without the CLI:* open *SQL Editor* in the dashboard, paste the whole file `supabase/migrations/20261109000000_init.sql` and click **Run**.
6. **Deploy the game server (Edge Function):**
   ```bash
   npx supabase functions deploy game
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function automatically. You don't set them yourself.
7. **Check Realtime:** *Database → Publications → supabase_realtime* should list `rooms`, `matches` and `player_views` (the migration adds them).
8. *(Optional)* Clean up expired rooms automatically: enable the `pg_cron` extension and run
   `select cron.schedule('cleanup-rooms', '*/30 * * * *', 'select public.cleanup_expired_rooms()');`

## Run locally

```bash
cp .env.example .env        # then put your Project URL and anon key into the VITE_ lines
npm install
npm run dev                 # http://localhost:5173
```

`npm run dev` listens on your network too. To test from your phone on the same Wi-Fi, open the `Network:` address Vite prints.

**Fully offline development** (optional, needs Docker): `npx supabase start` runs Postgres, Auth, Realtime and Edge Functions locally. Then `npx supabase db reset` applies the migration, `npx supabase functions serve game` starts the function, and you put the local URL and anon key that `supabase start` prints into `.env`. This is still real multiplayer (two browsers against the local stack), not a simulation.

Without credentials, the app shows a clear "Online multiplayer is not configured" banner. It never fakes online play.

## Put it on GitHub

**Option A — website, no git needed**
1. github.com → **New repository** → name it `the-last-checkpoint` → *Create*. Leave "Add a README" unchecked.
2. On the empty repo page click **uploading an existing file**.
3. Unzip this project and drag **everything inside the folder** (including the `src`, `supabase`, `tests` and `public` folders) into the upload area.
4. Make sure no `.env` file is included (only `.env.example`). Click **Commit changes**.

> Hidden files like `.gitignore` and `.env.example` may not show in Finder/Explorer. On macOS press `Cmd + Shift + .` to show them; on Windows enable *View → Hidden items*.

**Option B — git**
```bash
cd the-last-checkpoint
git init
git add .
git commit -m "THE LAST CHECKPOINT: initial release"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/the-last-checkpoint.git
git push -u origin main
```

## Deploy to GitHub Pages (alternative to Vercel)

GitHub Pages can't run the source files directly (that's what causes a **white page**). The included workflow `.github/workflows/deploy-pages.yml` builds the game for you on every push.

1. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repo → **Settings → Secrets and variables → Actions → New repository secret**. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Push or upload any change (or go to **Actions → Deploy to GitHub Pages → Run workflow**). After about a minute the game is live at `https://<your-user>.github.io/<repo-name>/`.

Make sure the `.github` folder is uploaded. It's hidden in Finder, so press `Cmd + Shift + .` to see it.

## Deploy to Vercel

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New… → Project** → import `the-last-checkpoint`.
2. The framework is detected as **Vite** (`vercel.json` sets the build and SPA rewrites).
3. Under **Environment Variables** add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon / publishable key
4. **Deploy.** You get a URL like `https://the-last-checkpoint.vercel.app`. Invite links look like `https://the-last-checkpoint.vercel.app/join/ABC123`.
5. *(Recommended)* In Supabase → *Authentication → URL Configuration*, set **Site URL** to your Vercel URL.

After changing an environment variable, redeploy (*Deployments → ⋯ → Redeploy*), because Vite bakes `VITE_` variables in at build time.

## Test a match on two devices

1. **Device 1** (e.g. your laptop): open the Vercel URL → enter a callsign → **Create Game**.
2. The lobby shows the room code and **Copy link / Share invite**. Send the link over WhatsApp or Discord.
3. **Device 2** (e.g. your phone on mobile data, not your Wi-Fi, to prove it works across networks): open the link → enter a callsign → you're in the lobby. Both screens show **Player 1 Connected / Player 2 Connected**.
   - Or open the site → **Join Game** → type the 6-character code.
4. On Device 1 press **Start Game**. Each device shows a *different* random role.
5. Check, in order:
   - [ ] The Infiltrator picks an identity and 2 disguise items, then presses **Step into line**.
   - [ ] The Guard stamps visitor #1 and presses **Next visitor**. The Infiltrator's phone shows "You are at the window".
   - [ ] The Guard asks a question on the intercom → answer options pop up on the Infiltrator's phone → the Guard sees the answer as subtitles a few seconds later.
   - [ ] The Guard orders "Take off your sunglasses" → the Infiltrator complies → the eyes appear in the Guard's window.
   - [ ] Sabotage: the Infiltrator cuts the phone line → on the next visit the Guard's phone shows "dead".
   - [ ] Refresh either browser mid-match → it reconnects to the same match and role.
   - [ ] Close one tab → the other sees "Opponent disconnected… 90s". After 90s it offers **Claim victory**.
   - [ ] A third device opening the same link gets "Room is full".
   - [ ] Finish → Victory/Defeat, the truth about every visitor, statistics → **Rematch** (host) re-rolls roles.

## Tests

```bash
npm test                    # engine: rules, all win conditions, leak & timing checks, duplicate actions
npm run test:multiplayer    # live: needs SUPABASE_URL and SUPABASE_ANON_KEY in your shell or .env
npm run build               # type-check + production build
```

`test:multiplayer` signs in three anonymous users against your real project and checks: create → join by code → third player rejected → non-members can't see the room → only the host can start → secrets unreadable → can't read the opponent's view → Guard view has no secret fields → server rejects wrong-role actions → the zombie prepares, queues and arrives at the window → duplicate `actionId` ignored → a question syncs over Realtime only after the reveal delay → forfeit ends the match.

## Tuning the balance

Every number lives in `supabase/functions/_shared/engine/data.ts` (`CONFIG`, `TOOLS`, red-herring weights in `engine.ts`). Redeploy the function after changing them (`npx supabase functions deploy game`). Good first levers: `actionsPerVisitor` (6), `zombieAnomalies` (3) vs `zombieCovers` (2), `denyInnocent` (−25 trust), and the NPC answer delay range.

## Offline preview

`src/preview/` is a hot-seat preview: both roles on one screen with a switch, and the engine running in the browser. It's only for showing and testing the game. Real matches always run on the server, with each player on their own device.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Online multiplayer is not configured" | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing. Check `.env` locally or Vercel env vars (then redeploy) |
| "Anonymous sign-ins are disabled" | Supabase → Authentication → Providers → enable anonymous sign-ins |
| "Could not find the function public.create_room" | The migration wasn't applied. Run `npx supabase db push` or paste the SQL in the editor |
| Start button → "Failed to send a request to the Edge Function" | Function not deployed: `npx supabase functions deploy game` |
| Moves only appear after a few seconds | Realtime isn't delivering, so the app is falling back to polling. Check that the publication includes `player_views` (Setup step 7) |
| `/join/ABC123` shows a 404 on Vercel | `vercel.json` is missing from the repo |

## What's next

- Sound and visual polish pass after playtesting; more survivor archetypes, questions and events.
- Spectator mode, best-of-3 series with automatic role swap, an optional text chat.
- Rate limiting at the edge and CAPTCHA on anonymous sign-in for public launch (Supabase supports both).
