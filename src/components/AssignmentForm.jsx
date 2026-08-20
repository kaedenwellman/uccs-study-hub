import { useState } from "react";
import {
  ASSIGNMENT_TYPES,
  TYPE_LABELS,
  addAssignment,
  updateAssignment,
} from "../lib/store.js";
import { toDatetimeLocalValue } from "../lib/time.js";

function defaultDue() {
  // Tomorrow at 11:59 PM — a sensible default for a due date.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(d);
}

export default function AssignmentForm({
  courses,
  assignment,
  lockedCourseId,
  onDone,
}) {
  const editing = !!assignment;
  const [courseId, setCourseId] = useState(
    assignment?.courseId || lockedCourseId || courses[0]?.id || "",
  );
  const [name, setName] = useState(assignment?.name || "");
  const [type, setType] = useState(assignment?.type || "homework");
  // Due date is optional. `hasDue` toggles it on/off.
  const [hasDue, setHasDue] = useState(
    assignment ? Boolean(assignment.dueDate) : true,
  );
  const [due, setDue] = useState(
    assignment && assignment.dueDate
      ? toDatetimeLocalValue(assignment.dueDate)
      : defaultDue(),
  );
  const [topic, setTopic] = useState(assignment?.topic || "");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!courseId) {
      setError("Pick a course first.");
      return;
    }
    if (!name.trim()) {
      setError("Assignment name is required.");
      return;
    }
    if (hasDue && !due) {
      setError("Enter a due date, or turn off “Set a due date”.");
      return;
    }
    // datetime-local has no timezone; new Date() reads it as local time.
    const dueISO = hasDue ? new Date(due).toISOString() : null;

    if (editing) {
      updateAssignment(assignment.id, {
        courseId,
        name,
        type,
        dueDate: dueISO,
        topic,
      });
      onDone();
    } else {
      addAssignment({ courseId, name, type, dueDate: dueISO, topic });
      onDone();
    }
  }

  return (
    <form onSubmit={submit}>
      {!lockedCourseId && (
        <div className="field">
          <label>Course *</label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Assignment name *</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="e.g. Chapter 3 Quiz"
          autoFocus
        />
      </div>

      <div className="field">
        <label>Type *</label>
        <div className="type-chips">
          {ASSIGNMENT_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              className={"type-chip" + (t === type ? " active" : "")}
              onClick={() => setType(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={hasDue}
            onChange={(e) => {
              setHasDue(e.target.checked);
              setError("");
            }}
          />
          Set a due date
        </label>
        {hasDue && (
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            style={{ marginTop: 8 }}
          />
        )}
        {!hasDue && (
          <div className="hint" style={{ marginTop: 6 }}>
            No due date — it'll show under “No due date” and won't send reminders.
          </div>
        )}
      </div>

      <div className="field">
        <label>Topics / description</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Newton's Laws of Motion, Free Body Diagrams, F=ma applications"
        />
        <div className="hint">
          What topics does this cover? The more detail, the better your study
          guide.
        </div>
      </div>

      {error && <div className="field-error">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="primary-btn">
          {editing ? "Save changes" : "Add assignment"}
        </button>
      </div>
    </form>
  );
}
