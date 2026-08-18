import { useState } from "react";
import { COURSE_COLORS, nextColor } from "../lib/palette.js";
import { addCourse, updateCourse } from "../lib/store.js";

export default function CourseForm({ existingCourses, course, onDone }) {
  const editing = !!course;
  const [name, setName] = useState(course?.name || "");
  const [instructor, setInstructor] = useState(course?.instructor || "");
  const [color, setColor] = useState(
    course?.color || nextColor(existingCourses),
  );
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Course name is required.");
      return;
    }
    if (editing) {
      updateCourse(course.id, { name, instructor, color });
      onDone(course.id);
    } else {
      const created = addCourse({ name, instructor, color });
      onDone(created.id);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Course name *</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="e.g. CALC 1, PHYS 1110"
          autoFocus
        />
      </div>

      <div className="field">
        <label>Instructor (optional)</label>
        <input
          value={instructor}
          onChange={(e) => setInstructor(e.target.value)}
          placeholder="e.g. Dr. Smith"
        />
      </div>

      <div className="field">
        <label>Color</label>
        <div className="color-row">
          {COURSE_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              className={"color-dot" + (c === color ? " active" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Choose color ${c}`}
            />
          ))}
        </div>
      </div>

      {error && <div className="field-error">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="primary-btn">
          {editing ? "Save changes" : "Add course"}
        </button>
      </div>
    </form>
  );
}
