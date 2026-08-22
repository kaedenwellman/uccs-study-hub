import { useMemo, useState } from "react";
import {
  parseCanvasFile,
  shortCourseName,
  decodeImportPayload,
} from "../lib/canvasImport.js";
import { TYPE_LABELS, bulkImport } from "../lib/store.js";
import { formatDueDate, isOverdue, hasDue } from "../lib/time.js";

export default function ImportModal({ courses, initialPayload, onImported }) {
  const [parsed, setParsed] = useState(initialPayload || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadFile = async (file) => {
    setError("");
    setBusy(true);
    try {
      const text = await file.text();
      const result = parseCanvasFile(text);
      if (!result.assignments.length) {
        setError(
          "No assignments with due dates were found in that file. Make sure it's the Canvas course-data.js or an .ics calendar.",
        );
      } else {
        setParsed(result);
      }
    } catch (err) {
      setError("Couldn't read that file: " + (err.message || "parse error"));
    } finally {
      setBusy(false);
    }
  };

  const loadCode = async (codeText) => {
    setError("");
    const raw = (codeText || "").trim();
    if (!raw) return;
    try {
      // Accept a raw code or a full link containing #import=<code>.
      const m = raw.match(/import=([A-Za-z0-9_-]+)/);
      const payload = await decodeImportPayload(m ? m[1] : raw);
      if (payload && Array.isArray(payload.assignments) && payload.assignments.length) {
        setParsed(payload);
      } else {
        setError("That code didn't contain any assignments.");
      }
    } catch {
      setError("That import code couldn't be read. Paste the whole thing.");
    }
  };

  if (!parsed) {
    return (
      <FilePicker error={error} busy={busy} onPick={loadFile} onCode={loadCode} />
    );
  }

  return <Review parsed={parsed} courses={courses} onImported={onImported} />;
}

function FilePicker({ onPick, onCode, error, busy }) {
  const [code, setCode] = useState("");
  return (
    <div>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-soft)", marginTop: 0 }}>
        Import assignments from a downloaded Canvas course. Choose the course's{" "}
        <strong>course-data.js</strong> file (inside the <em>viewer</em> folder of
        the download), or a Canvas <strong>.ics</strong> calendar file.
      </p>
      <label className="primary-btn gold" style={{ display: "inline-block", cursor: "pointer" }}>
        {busy ? "Reading…" : "Choose file"}
        <input
          type="file"
          accept=".js,.ics,.txt,.ical,application/javascript,text/calendar"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
      </label>

      <div className="import-or">or paste an import code</div>
      <div className="field" style={{ marginBottom: 10 }}>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste the import code here"
          style={{ minHeight: 64 }}
        />
      </div>
      <button className="ghost-btn" onClick={() => onCode(code)} disabled={!code.trim()}>
        Load code
      </button>

      {error && <div className="field-error" style={{ marginTop: 14 }}>{error}</div>}
    </div>
  );
}

function Review({ parsed, courses, onImported }) {
  const now = Date.now();
  const items = parsed.assignments;

  // Default target: an existing course matching the title, else a new course.
  const suggestedName = shortCourseName(parsed.courseTitle);
  const matchExisting = courses.find(
    (c) => c.name.toLowerCase() === suggestedName.toLowerCase(),
  );

  const [target, setTarget] = useState(matchExisting ? matchExisting.id : "__new__");
  const [newName, setNewName] = useState(suggestedName);
  const [selected, setSelected] = useState(() => new Set(items.map((_, i) => i)));

  const upcomingCount = useMemo(
    () => items.filter((it) => !isOverdue(it.dueDate, now)).length,
    [items, now],
  );

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(items.map((_, i) => i)));
  const selectNone = () => setSelected(new Set());
  const selectUpcoming = () =>
    setSelected(new Set(items.map((_, i) => i).filter((i) => !isOverdue(items[i].dueDate, now))));

  const doImport = () => {
    const chosen = items.filter((_, i) => selected.has(i));
    if (!chosen.length) return;
    const targetSpec =
      target === "__new__" ? { newCourseName: newName } : { courseId: target };
    const result = bulkImport(targetSpec, chosen);
    onImported(result);
  };

  return (
    <div>
      <div className="import-source">
        From <strong>{parsed.courseTitle}</strong> · {items.length} assignment
        {items.length === 1 ? "" : "s"} found
      </div>

      {/* Target course */}
      <div className="field">
        <label>Add to course</label>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="__new__">+ New course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {target === "__new__" && (
          <input
            style={{ marginTop: 8 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New course name"
          />
        )}
      </div>

      {/* Selection controls */}
      <div className="import-controls">
        <span>
          {selected.size} of {items.length} selected
        </span>
        <div className="import-quick">
          <button className="mini-btn" onClick={selectAll}>All</button>
          <button className="mini-btn" onClick={selectNone}>None</button>
          {upcomingCount > 0 && upcomingCount < items.length && (
            <button className="mini-btn" onClick={selectUpcoming}>Upcoming</button>
          )}
        </div>
      </div>

      {/* Assignment list */}
      <div className="import-list">
        {items.map((it, i) => {
          const overdue = isOverdue(it.dueDate, now);
          const on = selected.has(i);
          return (
            <button
              key={i}
              className={"import-row" + (on ? " on" : "")}
              onClick={() => toggle(i)}
            >
              <span className={"import-check" + (on ? " on" : "")} aria-hidden="true" />
              <span className="import-row-main">
                <span className="import-row-name">{it.name}</span>
                <span className="import-row-meta">
                  <span className={"badge " + it.type}>{TYPE_LABELS[it.type]}</span>
                  <span className={"import-due" + (overdue ? " past" : "")}>
                    {!hasDue(it.dueDate)
                      ? "No due date"
                      : formatDueDate(it.dueDate) + (overdue ? " · past due" : "")}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button
          className="primary-btn gold"
          onClick={doImport}
          disabled={selected.size === 0 || (target === "__new__" && !newName.trim())}
          style={{ flex: 1 }}
        >
          Add {selected.size} assignment{selected.size === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
