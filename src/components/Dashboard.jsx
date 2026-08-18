import { useState } from "react";
import AssignmentCard from "./AssignmentCard.jsx";
import { courseById, sortedUpcoming, sortedCompleted } from "../lib/store.js";

export default function Dashboard({
  state,
  now,
  onToggle,
  onEdit,
  onDelete,
  onStudy,
  onAddCourse,
  onAddAssignment,
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const upcoming = sortedUpcoming(state);
  const completed = sortedCompleted(state);
  const hasCourses = state.courses.length > 0;

  if (!hasCourses) {
    return (
      <div>
        <h2 className="view-title">Dashboard</h2>
        <div className="empty">
          <div className="rule" />
          <h3>Welcome to Study Hub</h3>
          <p>
            Add your first course to start tracking assignments, countdowns, and
            study guides.
          </p>
          <button className="primary-btn gold" onClick={onAddCourse}>
            Add your first course
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="view-title">Dashboard</h2>

      {upcoming.length === 0 ? (
        <div className="empty">
          <div className="rule" />
          <h3>All caught up</h3>
          <p>No upcoming assignments. Add one with the Add button.</p>
          <button className="primary-btn" onClick={onAddAssignment}>
            Add assignment
          </button>
        </div>
      ) : (
        upcoming.map((a) => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            course={courseById(state, a.courseId)}
            now={now}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onStudy={onStudy}
          />
        ))
      )}

      {completed.length > 0 && (
        <>
          <button
            className="section-toggle"
            onClick={() => setShowCompleted((v) => !v)}
          >
            Completed
            <span className="section-count">{completed.length}</span>
            <span className="toggle-word">{showCompleted ? "Hide" : "Show"}</span>
          </button>
          {showCompleted &&
            completed.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                course={courseById(state, a.courseId)}
                now={now}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                onStudy={onStudy}
              />
            ))}
        </>
      )}
    </div>
  );
}
