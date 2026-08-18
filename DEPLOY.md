# Deploying UCCS Study Hub to Vercel (with real push notifications)

This gets the app onto a permanent HTTPS URL, installable on your iPhone, with
push notifications that fire **even when the app is closed** (3 days / 1 day /
3 hours before each due date).

Requires **iOS 16.4+** and the app **installed to the home screen** — iOS only
allows web push for installed PWAs.

Your generated secrets are already in `.env.local` (gitignored). You'll copy
those same values into Vercel's environment variables below.

---

## 1. Add storage (Upstash Redis)

The push scheduler needs to remember your subscription + reminder times.

1. In the Vercel dashboard, open your project (or create it first — step 3).
2. Go to **Storage → Marketplace → Upstash (Redis)** and add it to the project
   (the free plan is plenty).
3. This automatically injects `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` into the project's environment variables. Nothing
   to copy by hand.

_(If your project already has the older Vercel KV integration, that works too —
the code reads `KV_REST_API_URL` / `KV_REST_API_TOKEN` as a fallback.)_

## 2. Set environment variables

In **Project → Settings → Environment Variables**, add the following for the
**Production** (and **Preview**) environments. Copy the exact values from your
local `.env.local` file.

| Name | Value (from `.env.local`) | Notes |
|------|---------------------------|-------|
| `VITE_VAPID_PUBLIC_KEY` | `VITE_VAPID_PUBLIC_KEY` | build-time; client |
| `VITE_APP_TOKEN` | `VITE_APP_TOKEN` | build-time; client |
| `VAPID_PUBLIC_KEY` | same as the public key above | server |
| `VAPID_PRIVATE_KEY` | `VAPID_PRIVATE_KEY` | **secret** |
| `VAPID_SUBJECT` | `mailto:your-email` | contact for push services |
| `APP_TOKEN` | same value as `VITE_APP_TOKEN` | server side of the token |
| `CRON_SECRET` | `CRON_SECRET` | protects the cron endpoint |

The `VITE_*` vars are read at **build time**, so set them before deploying (or
redeploy after adding them).

## 3. Deploy

**Fastest (CLI):**

```bash
npm i -g vercel
vercel login
vercel          # first run links/creates the project
vercel --prod   # production deploy (do this after env vars are set)
```

**Or Git-based (auto-redeploy on every change):** push this folder to a GitHub
repo, then in Vercel choose **Add New → Project → import the repo**. Every push
to the main branch redeploys automatically. (`git init` is already set up here;
just add a remote and push.)

Vercel auto-detects Vite (build → `dist`) and deploys everything in `/api` as
serverless functions. The cron job in `vercel.json` runs `/api/dispatch` every
15 minutes.

## 4. Install on your iPhone

1. Open your Vercel URL (e.g. `https://your-app.vercel.app`) in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open **Study Hub** from the home screen (this is required — push only works
   from the installed app, not the Safari tab).
4. Go to **Settings → Enable reminders** and allow notifications.

That subscribes your phone and syncs your reminder schedule to the server.

## 5. Test that push works

From your computer, manually trigger the dispatcher (normally the cron does
this every 15 min):

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" https://your-app.vercel.app/api/dispatch
```

It returns JSON like `{"sent":N,"due":M,"devices":K}`. To test end to end, add
an assignment whose due date is ~3 hours from now (so the "3 hours before"
reminder is due immediately), open the app once to sync, then run the curl — you
should get a banner on your phone.

## Troubleshooting

- **"couldn't subscribe to push" toast** — you're probably in the Safari tab,
  not the installed app. Add to Home Screen and enable from there.
- **Cron returns 401** — the `Authorization` header doesn't match `CRON_SECRET`.
  Vercel Cron sends this automatically once `CRON_SECRET` is set in env.
- **`sent:0` even with a due assignment** — open the app once after adding it so
  the schedule syncs to the server; confirm reminders are enabled.
- **Nothing stored** — check the Upstash integration is attached and its env
  vars are present in the project.

## Data note

For push to fire while the app is closed, your reminder times + push
subscription are stored server-side in Redis (not just on your device). No
course content or study guides are sent to the server — only the reminder
title/body ("PHYS 1110 · Chapter 3 Quiz", "Due in 3 hours") and when to fire.
