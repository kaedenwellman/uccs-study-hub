import { useState } from "react";
import AssignmentCard from "./AssignmentCard.jsx";
import {
  courseById,
  sortedUpcoming,
  sortedCompleted,
  ASSIGNMENT_TYPES,
  TYPE_LABELS,
} from "../lib/store.js";

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
  const [filter, setFilter] = useState("all");

  const byFilter = (a) => filter === "all" || a.type === filter;
  const upcoming = sortedUpcoming(state).filter(byFilter);
  const completed = sortedCompleted(state).filter(byFilter);
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

  const card = (a) => (
    <AssignmentCard
      key={a.id}
      assignment={a}
      course={courseById(state, a.courseId)}
      settings={state.settings}
      now={now}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
      onStudy={onStudy}
    />
  );

  return (
    <div>
      <div className="view-head">
        <h2 className="view-title">Dashboard</h2>
        <select
          className="filter-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          {ASSIGNMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {upcoming.length === 0 ? (
        <div className="empty">
          <div className="rule" />
          <h3>{filter === "all" ? "All caught up" : "Nothing here"}</h3>
          <p>
            {filter === "all"
              ? "No upcoming assignments. Add one with the Add button."
              : `No upcoming ${TYPE_LABELS[filter].toLowerCase()} assignments.`}
          </p>
          {filter === "all" && (
            <button className="primary-btn" onClick={onAddAssignment}>
              Add assignment
            </button>
          )}
        </div>
      ) : (
        upcoming.map(card)
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
          {showCompleted && completed.map(card)}
        </>
      )}
    </div>
  );
}
