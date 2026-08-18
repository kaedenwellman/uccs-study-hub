// Countdown formatting + urgency classification.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Urgency thresholds (ms remaining until due):
//   >= 3 days  -> gold   (#CFB87C)
//   24h - 72h  -> orange (#E8913A)
//   < 24h      -> red    (#D94040)
//   <= 0       -> overdue (red)
// Muted, earthy urgency scale (not neon). Expressed on the countdown itself.
export const URGENCY = {
  gold: { key: "gold", color: "#9c7a25" }, // 3+ days
  orange: { key: "orange", color: "#b06520" }, // 1-2 days
  red: { key: "red", color: "#9c3527" }, // under 24h / overdue
};

export function urgencyFor(dueDate, now = Date.now()) {
  const diff = new Date(dueDate).getTime() - now;
  if (diff < 24 * HOUR) return URGENCY.red; // covers overdue too
  if (diff < 72 * HOUR) return URGENCY.orange;
  return URGENCY.gold;
}

// Format the countdown string.
//   > 1 day  -> "4d 12h"
//   > 1 hour -> "8h 30m"
//   > 0      -> "45m"
//   <= 0     -> "OVERDUE"
export function formatCountdown(dueDate, now = Date.now()) {
  const diff = new Date(dueDate).getTime() - now;
  if (diff <= 0) return "OVERDUE";

  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const minutes = Math.floor((diff % HOUR) / MIN);

  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 0)}m`;
}

export function isOverdue(dueDate, now = Date.now()) {
  return new Date(dueDate).getTime() - now <= 0;
}

// Human-friendly absolute due date, e.g. "Mon, Sep 15 · 2:00 PM".
export function formatDueDate(dueDate) {
  const d = new Date(dueDate);
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

// Convert a Date to the value shape a <input type="datetime-local"> expects
// (local time, no timezone suffix): "YYYY-MM-DDTHH:mm".
export function toDatetimeLocalValue(date) {
  const d = date ? new Date(date) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
