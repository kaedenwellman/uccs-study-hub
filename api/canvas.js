// POST /api/canvas — server-side proxy to the Canvas LMS REST API.
// Browsers can't call Canvas directly (CORS), and a token should never ride in
// a raw browser request, so this forwards the user's Canvas token server-side.
// The token is used only to make the request and is never stored or logged.
//
// Body: { baseUrl, canvasToken, action: "courses" | "assignments", courseId? }
// Guarded by the x-app-token header (same shared token as the other endpoints).

const MAX_PAGES = 25; // safety cap on pagination
const MAX_DESC = 4000; // cap each description to bound payload size

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.APP_TOKEN || req.headers["x-app-token"] !== process.env.APP_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const { baseUrl, canvasToken, action, courseId } = body;

  const origin = validateCanvasOrigin(baseUrl);
  if (!origin) {
    return res.status(400).json({ error: "Enter a valid Canvas web address (https)." });
  }
  if (!canvasToken || typeof canvasToken !== "string") {
    return res.status(400).json({ error: "Missing Canvas access token." });
  }

  try {
    if (action === "courses") {
      const list = await canvasGetAll(
        origin,
        "/api/v1/courses?enrollment_state=active&per_page=100",
        canvasToken,
      );
      const courses = list
        .filter((c) => c && c.id && c.name && !c.access_restricted_by_date)
        .map((c) => ({ id: c.id, name: c.name, code: c.course_code || "" }));
      return res.status(200).json({ courses });
    }

    if (action === "assignments") {
      if (!courseId) return res.status(400).json({ error: "Missing courseId." });
      const list = await canvasGetAll(
        origin,
        `/api/v1/courses/${encodeURIComponent(courseId)}/assignments?per_page=100`,
        canvasToken,
      );
      const assignments = list
        .filter((a) => a && a.name)
        .map((a) => ({
          name: a.name,
          due_at: a.due_at || null,
          submission_types: a.submission_types || [],
          description: (a.description || "").slice(0, MAX_DESC),
          points_possible: a.points_possible ?? null,
        }));
      return res.status(200).json({ assignments });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    const status = err.status || 502;
    return res.status(status).json({ error: err.message || "Canvas request failed." });
  }
}

// Validate and normalize the Canvas base URL to a bare https origin, rejecting
// anything that could be used to reach internal services (SSRF).
function validateCanvasOrigin(input) {
  if (!input || typeof input !== "string") return null;
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return null;
  }
  // Reject IP-literal hosts (v4/v6) — Canvas is always a domain name.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
  if (!host.includes(".")) return null;
  return `https://${u.host}`;
}

async function canvasGetAll(origin, path, token) {
  let url = origin + path;
  const out = [];
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      const msg =
        resp.status === 401
          ? "Canvas rejected the token. Check the token and URL."
          : `Canvas returned ${resp.status}.`;
      throw Object.assign(new Error(msg), { status: resp.status === 401 ? 401 : 502 });
    }
    const chunk = await resp.json();
    if (Array.isArray(chunk)) out.push(...chunk);
    url = nextLink(resp.headers.get("link"));
    // Only follow same-origin next links (defense-in-depth).
    if (url && !url.startsWith(origin)) url = null;
  }
  return out;
}

function nextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (m) return m[1];
  }
  return null;
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
