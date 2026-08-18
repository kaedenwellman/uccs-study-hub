import { assignmentsForCourse } from "../lib/store.js";
import { formatCountdown } from "../lib/time.js";

export default function Courses({
  state,
  now,
  onAddCourse,
  onEditCourse,
  onDeleteCourse,
  onAddAssignmentToCourse,
  onToggle,
  onEditAssignment,
}) {
  const { courses } = state;

  return (
    <div>
      <h2 className="view-title">Courses</h2>

      {courses.length === 0 ? (
        <div className="empty">
          <div className="rule" />
          <h3>No courses yet</h3>
          <p>Add a course to start organizing your assignments.</p>
          <button className="primary-btn gold" onClick={onAddCourse}>
            Add course
          </button>
        </div>
      ) : (
        <>
          {courses.map((course) => {
            const items = assignmentsForCourse(state, course.id);
            return (
              <div className="course-card" key={course.id}>
                <div className="course-card-head">
                  <span
                    className="course-swatch"
                    style={{ background: course.color }}
                  />
                  <div>
                    <h3>{course.name}</h3>
                    {course.instructor && (
                      <div className="instructor">{course.instructor}</div>
                    )}
                  </div>
                  <div className="course-meta">
                    <button
                      className="txt-btn"
                      onClick={() => onEditCourse(course)}
                    >
                      Edit
                    </button>
                    <button
                      className="txt-btn danger"
                      onClick={() => onDeleteCourse(course)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="course-assignments">
                    {items.map((a) => (
                      <div
                        className={"mini-assignment" + (a.completed ? " done" : "")}
                        key={a.id}
                      >
                        <button
                          className={"mini-btn" + (a.completed ? " done" : "")}
                          onClick={() => onToggle(a.id)}
                        >
                          {a.completed ? "Undo" : "Done"}
                        </button>
                        <span
                          className="mini-name"
                          onClick={() => onEditAssignment(a)}
                        >
                          {a.name}
                        </span>
                        {!a.completed && (
                          <span className="mini-due">
                            {formatCountdown(a.dueDate, now)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="add-inline"
                  onClick={() => onAddAssignmentToCourse(course.id)}
                >
                  Add assignment
                </button>
              </div>
            );
          })}

          <button
            className="primary-btn gold"
            style={{ width: "100%", marginTop: 4 }}
            onClick={onAddCourse}
          >
            Add course
          </button>
        </>
      )}
    </div>
  );
}
