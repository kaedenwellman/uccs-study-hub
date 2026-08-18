# UCCS Study Hub

A personal, installable **Progressive Web App** for tracking assignments across
courses, watching live countdowns to due dates, and generating AI study guides
before quizzes and tests. Built with React + Vite, styled in the UCCS
black/white/gold palette, and designed mobile-first for an iPhone home screen.

## Features

- **Courses** — add / edit / delete courses (auto-assigned editable colors).
  Deleting a course confirms and removes its assignments.
- **Assignments** — name, type (Homework / Quiz / Test / Project / Other), due
  date + time, and a topic field that feeds the AI study guide. Edit, delete,
  and mark complete. Completed items collapse into a section at the bottom.
- **Dashboard** — chronological feed of upcoming assignments with **live
  countdowns** and urgency color coding: gold (3+ days), orange (1–2 days),
  red (< 24h / overdue).
- **AI Study Guides** — on quiz/test cards, generate a focused guide (Key
  Concepts, Quick Summary, tap-to-reveal Practice Questions) via the Anthropic
  API. Guides are cached; "Regenerate" gets a fresh one.
- **Listen (text-to-speech)** — a Listen bar reads the Key Concepts + Quick
  Summary aloud using the browser's built-in `speechSynthesis` (free, offline,
  no extra key). Play / Pause / Resume / Stop plus a speed toggle
  (1× / 1.25× / 1.5× / 0.75×). Works in iOS Safari and the installed PWA.
- **Reminders** — local notifications 3 days / 1 day / 3 hours before due.
- **PWA** — manifest, icons, offline app-shell caching, iOS install detection.
- **Persistence** — everything lives in `localStorage` on the device.

## Getting started

```bash
npm install
npm run dev      # local dev server (http://localhost:5173)
```

Production build + local preview:

```bash
npm run build
npm run preview
```

Regenerate the PWA icons (only needed if you change the monogram):

```bash
npm run icons
```

## The Anthropic API key

Study-guide generation calls the Anthropic API **directly from the browser**
using **your own key**, which you paste into **Settings**. The key is stored
only in this device's `localStorage` and sent directly to Anthropic (via the
`anthropic-dangerous-direct-browser-access` header). This is fine for a personal
app on your own phone — **don't share the installed app with others**, since the
key lives on the device. The model used is `claude-sonnet-4-6`.

Get a key at [console.anthropic.com](https://console.anthropic.com).

If you later want to hide the key, add a small backend proxy that holds it and
point `src/lib/ai.js` at that proxy instead.

## Installing on iPhone (required for notifications)

iOS only allows PWA notifications for apps added to the home screen:

1. Open the deployed URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch **Study Hub** from the home screen.

The app detects when it isn't running as an installed PWA and shows a one-time
install banner.

## Notifications — honest scope

True background push (firing when the app is fully closed) needs a server with
Web Push / VAPID keys — it can't be done purely client-side, and iOS suspends
background timers. What this app does instead: schedule **local** reminders that
fire while the app is open or recently backgrounded, displayed through the
service worker, and **re-armed every time you open the app**. For guaranteed
background reminders, add a push backend (a documented future upgrade).

## Deploying

The app is fully static. `npm run build` outputs `dist/`, which you can host on
any static host over **HTTPS** (required for PWA install + notifications):

- **Netlify / Vercel** — point at the repo; build command `npm run build`,
  publish directory `dist`.
- **GitHub Pages** — deploy `dist/`. For project pages served from a subpath,
  set `base: "/<repo-name>/"` in `vite.config.js` before building.

## Project structure

```
src/
  main.jsx              app entry + service-worker registration
  App.jsx               root: tabs, modals, notifications wiring
  sw.js                 service worker (precache + notifications)
  styles.css            all styling (black/white/gold, mobile-first)
  lib/
    store.js            localStorage data layer + hooks + CRUD
    time.js             countdown formatting + urgency
    palette.js          course color palette
    ai.js               Anthropic study-guide call + response parsing
    speech.js           text-to-speech (Web Speech API) hook
    notifications.js    local reminder scheduling
  components/           Dashboard, Courses, Settings, forms, cards, StudyGuide…
scripts/generate-icons.mjs   builds the SH-monogram icon set
```

## Not built (noted for future upgrades)

Canvas LMS integration, iCal feed import, spaced repetition, study analytics,
and JSON export/backup are intentionally out of scope for this build.
