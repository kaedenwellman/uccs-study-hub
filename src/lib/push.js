// Web Push client: subscribes the installed PWA to push and syncs the reminder
// schedule to the server so notifications fire even when the app is closed.
//
// Requires the app to be served over HTTPS and (on iOS) installed to the home
// screen. Configured via build-time env vars:
//   VITE_VAPID_PUBLIC_KEY  - public VAPID key (safe to expose)
//   VITE_APP_TOKEN         - shared token guarding the API (semi-public)
//   VITE_API_BASE          - optional; defaults to same-origin "/api"
import { buildReminders } from "./notifications.js";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const APP_TOKEN = import.meta.env.VITE_APP_TOKEN || "";
const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

// A stable per-install id so each device only receives its own reminders
// (keeps notifications isolated between different people using the same backend).
function getInstallId() {
  const KEY = "uccs-install-id";
  let id = null;
  try {
    id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem(KEY, id);
    }
  } catch {
    id = id || "u-ephemeral";
  }
  return id;
}

// Push is only available when a VAPID key was baked in at build time.
export function pushConfigured() {
  return Boolean(VAPID_PUBLIC);
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function api(body) {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-token": APP_TOKEN,
    },
    body: JSON.stringify({ uid: getInstallId(), ...body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Server error (${res.status})${text ? ": " + text : ""}`);
  }
  return res.json().catch(() => ({}));
}

async function getSubscription(reg) {
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  return sub;
}

// Subscribe this device and push the current reminder schedule to the server.
// Returns { ok: true } or { ok: false, error }.
export async function pushEnable(assignments, courses) {
  if (!pushConfigured()) return { ok: false, error: "Push is not configured." };
  if (!pushSupported()) return { ok: false, error: "Push isn't supported here." };
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await getSubscription(reg);
    await api({
      subscription: subscription.toJSON(),
      reminders: buildReminders(assignments, courses),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Could not enable push." };
  }
}

// Update the server-side reminder schedule (call on assignment/course changes).
export async function pushSync(assignments, courses) {
  if (!pushConfigured() || !pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return; // not subscribed yet; nothing to sync
    await api({
      subscription: sub.toJSON(),
      reminders: buildReminders(assignments, courses),
    });
  } catch (err) {
    console.warn("Push sync failed:", err);
  }
}

// Unsubscribe this device and clear its schedule server-side.
export async function pushDisable() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api({ unsubscribe: true, endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch (err) {
    console.warn("Push disable failed:", err);
  }
}
