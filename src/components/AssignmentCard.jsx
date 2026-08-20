import { useState } from "react";
import { TYPE_LABELS, STUDYABLE_TYPES, setTimeEstimate } from "../lib/store.js";
import { generateTimeEstimate } from "../lib/ai.js";
import {
  formatCountdown,
  urgencyFor,
  isOverdue,
  hasDue,
  formatDueDate,
} from "../lib/time.js";

export default function AssignmentCard({
  assignment,
  course,
  settings,
  now,
  onToggle,
  onEdit,
  onDelete,
  onStudy,
}) {
  const completed = assignment.completed;
  const dated = hasDue(assignment.dueDate);
  const urgency = urgencyFor(assignment.dueDate, now);
  const overdue = isOverdue(assignment.dueDate, now);
  const countdown = formatCountdown(assignment.dueDate, now);
  const studyable = STUDYABLE_TYPES.has(assignment.type);
  const countdownColor = overdue ? "var(--red)" : urgency.color;

  const est = assignment.timeEstimate;
  const [estimating, setEstimating] = useState(false);
  const [estError, setEstError] = useState("");

  const runEstimate = async () => {
    setEstError("");
    if (!settings?.apiKey) {
      setEstError("Add your API key in Settings to estimate time.");
      return;
    }
    setEstimating(true);
    try {
      const result = await generateTimeEstimate({
        apiKey: settings.apiKey,
        model: settings.model,
        course: course?.name || "Course",
        assignment: assignment.name,
        type: TYPE_LABELS[assignment.type] || assignment.type,
        topic: assignment.topic,
      });
      setTimeEstimate(assignment.id, result);
    } catch (err) {
      setEstError(err.message || "Couldn't estimate time.");
    } finally {
      setEstimating(false);
    }
  };

  return (
    <div className={"card" + (completed ? " completed" : "")}>
      <div className="card-top">
        <div className="card-main">
          <div className="course-line">
            <span
              className="course-chip"
              style={{ background: course?.color || "#b0a892" }}
            />
            <span>{course?.name || "No course"}</span>
            <span className={"badge " + assignment.type}>
              {TYPE_LABELS[assignment.type]}
            </span>
          </div>
          <p className="assignment-name">{assignment.name}</p>
          {assignment.topic && (
            <p className="topic-preview">{assignment.topic}</p>
          )}
        </div>

        {!completed &&
          (dated ? (
            <div className="countdown">
              <span className="value" style={{ color: countdownColor }}>
                {countdown}
              </span>
              <small>
                {overdue
                  ? "Past due"
                  : formatDueDate(assignment.dueDate).split(" · ")[0]}
              </small>
            </div>
          ) : (
            <div className="countdown">
              <span className="no-date">No date</span>
            </div>
          ))}
      </div>

      {(est || estimating || estError) && (
        <div className="est-line">
          {estimating ? (
            <span className="est-range">Estimating…</span>
          ) : estError ? (
            <span className="est-error">{estError}</span>
          ) : (
            <>
              <span className="est-range">Est. {est.range}</span>
              {est.rationale && <span className="est-why">{est.rationale}</span>}
            </>
          )}
        </div>
      )}

      <div className="card-actions">
        <button
          className={"txt-btn" + (completed ? " done" : "")}
          onClick={() => onToggle(assignment.id)}
        >
          {completed ? "Undo" : "Mark done"}
        </button>
        <button className="txt-btn" onClick={() => onEdit(assignment)}>
          Edit
        </button>
        <button className="txt-btn danger" onClick={() => onDelete(assignment)}>
          Delete
        </button>

        {!completed && (
          <button className="txt-btn" onClick={runEstimate} disabled={estimating}>
            {est ? "Re-estimate" : "Est. time"}
          </button>
        )}

        {studyable && !completed && (
          <button className="txt-btn solid study" onClick={() => onStudy(assignment)}>
            Study guide
          </button>
        )}
      </div>
    </div>
  );
}
