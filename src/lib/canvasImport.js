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
  if (/\blab\b/.test(t) || /\blab[\s-]?\d/.test(t)) return "lab";
  if (/\b(hw|hwk|homework|problem set|pset|assignment)\b/.test(t))
    return "homework";
  return "other";
}

// From a Canvas module's name, decide if its file items should be pulled in as
// (undated) trackable assignments, and which type they are.
function moduleCategory(name = "") {
  const n = name.toLowerCase();
  if (/\blab/.test(n)) return "lab";
  if (/home\s*work|homework/.test(n)) return "homework";
  return null; // lectures, schedules, solution keys, etc. are skipped
}

// Pull undated homework/lab items from modules, deduped by their number so the
// many files per lab (instructions, sign-off, program) collapse into one entry.
function extractModuleItems(data) {
  const out = [];
  for (const mod of data.modules || []) {
    const type = moduleCategory(mod.name || "");
    if (!type) continue;
    const numRe =
      type === "lab"
        ? /\blab\s*-?\s*(\d+)/i
        : /\b(?:hwk|homework|hw)\s*-?\s*(\d+)/i;
    const seen = new Set();
    for (const it of mod.items || []) {
      const title = it.title || it.name || "";
      const m = title.match(numRe);
      if (!m) continue; // skip templates, sign-offs, misc files with no number
      const key = type + "-" + m[1];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: type === "lab" ? `Lab ${m[1]}` : `HWK ${m[1]}`,
        type,
        dueDate: null,
        topic: "",
      });
    }
  }
  // Group by type (homework, then labs), each in natural number order.
  const num = (s) => parseInt((s.name.match(/\d+/) || [0])[0], 10) || 0;
  const order = { homework: 0, lab: 1 };
  out.sort((a, b) => (order[a.type] - order[b.type]) || num(a) - num(b));
  return out;
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

  // Dated graded items first, then undated homework/labs pulled from modules.
  const undated = extractModuleItems(data);
  return { courseTitle, assignments: [...assignments, ...undated] };
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

// ---- Shareable import code / link payload ---------------------------------
// Codes are gzip-compressed JSON, base64url-encoded, to keep them short.
// Decoding also accepts the older uncompressed base64url codes (no gzip header).

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function gzip(bytes) {
  const cs = new CompressionStream("gzip");
  const w = cs.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function gunzip(bytes) {
  const ds = new DecompressionStream("gzip");
  const w = ds.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

export async function encodeImportPayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== "undefined") {
    return bytesToB64url(await gzip(bytes));
  }
  return bytesToB64url(bytes); // fallback: uncompressed
}

export async function decodeImportPayload(str) {
  const bytes = b64urlToBytes(str);
  // gzip magic bytes: 0x1f 0x8b
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const jsonBytes =
    isGzip && typeof DecompressionStream !== "undefined"
      ? await gunzip(bytes)
      : bytes;
  return JSON.parse(new TextDecoder().decode(jsonBytes));
}

export { OUR_TYPES };
