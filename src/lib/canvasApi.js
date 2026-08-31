// Client for the Canvas API proxy (/api/canvas). Fetches the user's courses and
// their assignments (with full descriptions) and maps them to our assignment
// shape for import.
import { detectType, cleanName, stripHtml } from "./canvasImport.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");
const APP_TOKEN = import.meta.env.VITE_APP_TOKEN || "";

export function canvasConfigured(settings) {
  return Boolean(settings?.canvasUrl && settings?.canvasToken);
}

async function call(payload) {
  let res;
  try {
    res = await fetch(`${API_BASE}/canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-token": APP_TOKEN },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = await res.json();
      if (d?.error) msg = d.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchCanvasCourses(settings) {
  const { courses } = await call({
    action: "courses",
    baseUrl: settings.canvasUrl,
    canvasToken: settings.canvasToken,
  });
  return courses || [];
}

export async function fetchCanvasAssignments(settings, courseId) {
  const { assignments } = await call({
    action: "assignments",
    baseUrl: settings.canvasUrl,
    canvasToken: settings.canvasToken,
    courseId,
  });
  return (assignments || [])
    .map((a) => ({
      name: cleanName(a.name),
      type: detectType(a.name, (a.submission_types || []).join(" ")),
      dueDate: a.due_at || null,
      topic: stripHtml(a.description || ""),
    }))
    .sort((x, y) => {
      const dx = x.dueDate ? new Date(x.dueDate).getTime() : Infinity;
      const dy = y.dueDate ? new Date(y.dueDate).getTime() : Infinity;
      return dx - dy;
    });
}
