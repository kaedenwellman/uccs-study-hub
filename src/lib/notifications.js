// Local notification scheduling.
//
// Honest limitation: true background push (firing when the app is fully closed)
// needs a server with Web Push/VAPID keys. What this does is schedule in-app
// timers that fire while the app is open or recently backgrounded, and display
// them through the service worker so an installed iOS PWA treats them as real
// notifications. Reminders re-arm every time the app is opened.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// setTimeout overflows past ~24.8 days (2^31 ms) and would fire immediately.
const MAX_TIMEOUT = 2 ** 31 - 1;

// Offsets before the due date at which to remind.
const OFFSETS = [
  { ms: 3 * DAY, label: "3 days" },
  { ms: 1 * DAY, label: "1 day" },
  { ms: 3 * HOUR, label: "3 hours" },
];

let timers = [];

// Build the flat list of future reminders from assignments + courses.
// Shared by the in-app timer scheduler and the server push sync.
// Returns [{ key, title, body, fireAt }] with fireAt in epoch ms, future only.
export function buildReminders(assignments, courses, now = Date.now()) {
  const courseName = (id) => courses.find((c) => c.id === id)?.name || "Course";
  const out = [];
  for (const a of assignments) {
    if (a.completed || !a.dueDate) continue; // skip undated assignments
    const due = new Date(a.dueDate).getTime();
    if (Number.isNaN(due)) continue;
    for (const offset of OFFSETS) {
      const fireAt = due - offset.ms;
      if (fireAt <= now) continue; // reminder time already passed
      out.push({
        key: `${a.id}:${offset.ms}`,
        title: `${courseName(a.courseId)} · ${a.name}`,
        body: `Due in ${offset.label}`,
        fireAt,
      });
    }
  }
  return out;
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function clearAll() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

async function fire(title, body, tag) {
  const reg = await navigator.serviceWorker?.ready.catch(() => null);
  if (reg) {
    // Prefer the SW so installed PWAs show a proper notification.
    reg.active?.postMessage({ type: "SHOW_NOTIFICATION", title, body, tag });
    try {
      await reg.showNotification(title, {
        body,
        tag,
        renotify: true,
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png",
      });
      return;
    } catch {
      /* fall through to page-level notification */
    }
  }
  if (notificationPermission() === "granted") {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag });
  }
}

// Rebuild every timer from the current assignment + course data.
export function scheduleAll(assignments, courses, settings) {
  clearAll();
  if (!settings?.notificationsEnabled) return;
  if (notificationPermission() !== "granted") return;

  const now = Date.now();
  const courseName = (id) =>
    courses.find((c) => c.id === id)?.name || "Course";

  for (const a of assignments) {
    if (a.completed || !a.dueDate) continue; // skip undated assignments
    const due = new Date(a.dueDate).getTime();
    if (Number.isNaN(due)) continue;

    for (const offset of OFFSETS) {
      const fireAt = due - offset.ms;
      const delay = fireAt - now;
      if (delay <= 0) continue; // reminder time already passed
      if (delay > MAX_TIMEOUT) continue; // too far out; re-armed on next open

      const title = `${courseName(a.courseId)} · ${a.name}`;
      const body = `Due in ${offset.label}`;
      const tag = `${a.id}:${offset.ms}`;
      const id = setTimeout(() => fire(title, body, tag), delay);
      timers.push(id);
    }
  }
}
