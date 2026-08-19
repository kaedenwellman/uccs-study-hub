// Parse a downloaded Canvas course into importable assignments.
//
// Supports two source formats:
//   1. The `course-data.js` file from a Canvas course-archive download
//      (defines `window.COURSE_DATA = {...}`), which contains an
//      `assignments` array with titles + due dates.
//   2. An `.ics` calendar file exported from Canvas.
//
// Output shape (both parsers): { courseTitle, assignments: [Item] }
//   Item = { name, type, dueDate (ISO string), topic }
//
// Pure string/JSON parsing — no DOM or browser-only APIs — so it can also run
// in Node (used to generate a shareable import link).

const OUR_TYPES = ["homework", "quiz", "test", "project", "other"];

// Map a Canvas title (and optional submission hint) to one of our types.
export function detectType(title = "", submissionTypes = "") {
  const t = `${title} ${submissionTypes}`.toLowerCase();
  if (/\bproject\b/.test(t)) return "project"; // "Final Project" -> project
  if (/\bquiz(z)?\b/.test(t)) return "quiz";
  if (/\b(exam|midterm|final|test)\b/.test(t)) return "test";
  if (/\b(hw|hwk|homework|problem set|pset|assignment|lab)\b/.test(t))
    return "homework";
  return "other";
}

function cleanName(s = "") {
  return s.replace(/\s+/g, " ").trim();
}

function stripHtml(s = "") {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Try to pull a short course code like "ECE 1002" from a long Canvas title.
export function shortCourseName(title = "") {
  const m = title.match(/\b([A-Z]{2,4})\s*-?\s*(\d{3,4})\b/);
  if (m) return `${m[1]} ${m[2]}`;
  return cleanName(title).slice(0, 40);
}

function toItem(raw) {
  const title = raw.title || raw.name || "";
  const due = raw.dueAt || raw.due_at || raw.dueDate || null;
  if (!title || !due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return {
    name: cleanName(title),
    type: detectType(title, raw.submissionTypes || raw.submission_types || ""),
    dueDate: d.toISOString(),
    topic: stripHtml(raw.content || raw.description || raw.message || ""),
  };
}

// ---- Canvas course-data.js -------------------------------------------------

export function parseCanvasCourseData(text) {
  // Strip the `window.COURSE_DATA = ` wrapper (and any trailing semicolon).
  let jsonText = text.trim();
  const eq = jsonText.indexOf("=");
  if (/window\.COURSE_DATA/.test(jsonText.slice(0, eq + 1))) {
    jsonText = jsonText.slice(eq + 1);
  }
  jsonText = jsonText.trim().replace(/;\s*$/, "");

  const data = JSON.parse(jsonText);
  const courseTitle = data.title || "Imported course";

  // Canvas graded items can live in several arrays; merge whatever is present.
  const buckets = [
    data.assignments,
    data.quizzes,
    data.discussion_topics,
  ].filter(Array.isArray);

  const seen = new Set();
  const assignments = [];
  for (const bucket of buckets) {
    for (const raw of bucket) {
      const item = toItem(raw);
      if (!item) continue;
      const key = item.name + "|" + item.dueDate;
      if (seen.has(key)) continue;
      seen.add(key);
      assignments.push(item);
    }
  }

  assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  return { courseTitle, assignments };
}

// ---- .ics calendar ---------------------------------------------------------

export function parseICS(text) {
  // Unfold folded lines (continuations start with a space or tab).
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const assignments = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
    } else if (line === "END:VEVENT") {
      if (cur) {
        const due = cur.DTEND || cur.DTSTART;
        const name = cleanName((cur.SUMMARY || "").replace(/\s*\[[^\]]*\]\s*$/, ""));
        if (name && due) {
          const d = parseICSDate(due);
          if (d) {
            assignments.push({
              name,
              type: detectType(name),
              dueDate: d.toISOString(),
              topic: stripHtml((cur.DESCRIPTION || "").replace(/\\n/g, " ").replace(/\\,/g, ",")),
            });
          }
        }
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).split(";")[0]; // drop params like ;TZID=
      const val = line.slice(idx + 1);
      cur[key] = val;
    }
  }

  assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  return { courseTitle: "Imported calendar", assignments };
}

function parseICSDate(v) {
  // Forms: 20250909T235900Z, 20250909T235900, or 20250909 (all-day).
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "23", mi = "59", s = "00", z] = m;
  if (z) {
    return new Date(
      Date.UTC(+y, +mo - 1, +d, +h, +mi, +s),
    );
  }
  // No 'Z' -> treat as local time.
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

// ---- Auto-detect format ----------------------------------------------------

export function parseCanvasFile(text) {
  const head = text.slice(0, 200);
  if (/BEGIN:VCALENDAR/.test(head) || /BEGIN:VEVENT/.test(text.slice(0, 2000))) {
    return parseICS(text);
  }
  if (/window\.COURSE_DATA/.test(head) || /"assignments"\s*:/.test(text.slice(0, 500))) {
    return parseCanvasCourseData(text);
  }
  // Last resort: maybe it's raw JSON.
  return parseCanvasCourseData(text);
}

// ---- Shareable import link payload ----------------------------------------

export function encodeImportPayload(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeImportPayload(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const json = decodeURIComponent(escape(atob(pad)));
  return JSON.parse(json);
}

export { OUR_TYPES };
