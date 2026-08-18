import { TYPE_LABELS, STUDYABLE_TYPES } from "../lib/store.js";
import {
  formatCountdown,
  urgencyFor,
  isOverdue,
  formatDueDate,
} from "../lib/time.js";

export default function AssignmentCard({
  assignment,
  course,
  now,
  onToggle,
  onEdit,
  onDelete,
  onStudy,
}) {
  const completed = assignment.completed;
  const urgency = urgencyFor(assignment.dueDate, now);
  const overdue = isOverdue(assignment.dueDate, now);
  const countdown = formatCountdown(assignment.dueDate, now);
  const studyable = STUDYABLE_TYPES.has(assignment.type);
  const countdownColor = overdue ? "var(--red)" : urgency.color;

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

        {!completed && (
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
        )}
      </div>

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

        {studyable && !completed && (
          <button className="txt-btn solid study" onClick={() => onStudy(assignment)}>
            {assignment.studyGuide ? "Study guide" : "Study guide"}
          </button>
        )}
      </div>
    </div>
  );
}
