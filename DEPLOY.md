# Deploying UCCS Study Hub to Vercel (with real push notifications)

Works on the **free Vercel (Hobby) plan**. This gets the app onto a permanent
HTTPS URL, installable on your iPhone, with push notifications that fire **even
when the app is closed** (3 days / 1 day / 3 hours before each due date).

Requires **iOS 16.4+** and the app **installed to the home screen** — iOS only
allows web push for installed PWAs.

Your generated secrets are already in `.env.local` (gitignored). You'll copy
those same values into Vercel's environment variables below.

> **Why a separate scheduler?** On the free plan, Vercel's built-in Cron Jobs
> only run **once per day** — not often enough for "3 hours before" reminders.
> So we trigger the dispatcher every 15 minutes with a free external scheduler
> (step 4). No code changes needed; `/api/dispatch` just needs to be pinged.

---

## 1. Add storage (Upstash Redis)

The push scheduler needs to remember your subscription + reminder times. The
free Upstash tier is plenty.

**Easiest / most reliable — create it directly at Upstash:**

1. Go to **https://upstash.com**, sign in (free), **Create Database → Redis**.
2. On the database page, copy **`UPSTASH_REDIS_REST_URL`** and
   **`UPSTASH_REDIS_REST_TOKEN`** (there's usually a copy / `.env` button).
3. You'll paste those two into Vercel in step 2.

_(Alternatively, from the Vercel dashboard top nav: **Storage → Create Database
→ Upstash for Redis**, which injects those two vars automatically. Either way my
code reads the same variable names.)_

## 2. Set environment variables

In **Project → Settings → Environment Variables**, add the following for the
**Production** (and **Preview**) environments. Copy the exact values from your
local `.env.local` file.

| Name | Value | Notes |
|------|-------|-------|
| `VITE_VAPID_PUBLIC_KEY` | from `.env.local` | build-time; client |
| `VITE_APP_TOKEN` | from `.env.local` | build-time; client |
| `VAPID_PUBLIC_KEY` | same as the public key above | server |
| `VAPID_PRIVATE_KEY` | from `.env.local` | **secret** |
| `VAPID_SUBJECT` | `mailto:your-email` | contact for push services |
| `APP_TOKEN` | same value as `VITE_APP_TOKEN` | server side of the token |
| `CRON_SECRET` | from `.env.local` | protects the dispatch endpoint |
| `UPSTASH_REDIS_REST_URL` | from Upstash (step 1) | skip if the integration added it |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash (step 1) | skip if the integration added it |

The `VITE_*` vars are read at **build time**, so set them before deploying (or
redeploy after adding them).

## 3. Deploy

Since the repo is on GitHub, the simplest path is Git-based:

1. In Vercel, **Add New → Project → import `uccs-study-hub`**.
2. It auto-detects Vite (build → `dist`). Add the env vars (step 2) first, then
   deploy. Every push to `main` afterward redeploys automatically.

**Or via CLI:**

```bash
npm i -g vercel
vercel login
vercel --prod
```

Everything in `/api` deploys as serverless functions automatically.

## 4. Set up the reminder scheduler (required on the free plan)

Use a free external cron to ping the dispatcher every 15 minutes.

1. Sign up free at **https://cron-job.org**.
2. **Create cronjob.**
3. **Title:** Study Hub dispatch
4. **URL:** `https://YOUR-APP.vercel.app/api/dispatch`
5. **Schedule:** every 15 minutes.
6. Open the job's **Headers** (Advanced) and add one header:
   - **Name:** `Authorization`
   - **Value:** `Bearer <CRON_SECRET>` (your `CRON_SECRET` from `.env.local`)
7. **Save / enable.**

That's what makes reminders fire on time. (QStash by Upstash, or any cron that
can send a custom header, works equally well.)

## 5. Install on your iPhone

1. Open your Vercel URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open **Study Hub** from the home screen (required — push only works from the
   installed app, not the Safari tab).
4. Go to **Settings → Enable reminders** and allow notifications.

That subscribes your phone and syncs your reminder schedule to the server.

## 6. Test that push works

Manually trigger the dispatcher (this is exactly what cron-job.org does every 15
min):

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" https://YOUR-APP.vercel.app/api/dispatch
```

It returns JSON like `{"sent":N,"due":M,"devices":K}`. To test end to end, add an
assignment due ~3 hours from now (so the "3 hours before" reminder is due
immediately), open the app once to sync, then run the curl — you should get a
banner on your phone.

## Troubleshooting

- **"couldn't subscribe to push" toast** — you're probably in the Safari tab,
  not the installed app. Add to Home Screen and enable from there.
- **Dispatch returns 401** — the `Authorization` header doesn't match
  `CRON_SECRET`. Check the header value in cron-job.org / your curl.
- **`sent:0` with a due assignment** — open the app once after adding it so the
  schedule syncs; confirm reminders are enabled.
- **Reminders late by up to ~15 min** — expected; that's the cron interval. Set
  cron-job.org to a shorter interval if you want tighter timing.
- **Nothing stored** — confirm the two `UPSTASH_*` vars are present in the
  Vercel project.

## Data note

For push to fire while the app is closed, your reminder times + push
subscription are stored server-side in Redis (not just on your device). No
course content or study guides are sent to the server — only the reminder
title/body ("PHYS 1110 · Chapter 3 Quiz", "Due in 3 hours") and when to fire.
