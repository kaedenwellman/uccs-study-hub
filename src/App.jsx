import { useState, useEffect, useMemo, useCallback } from "react";
import {
  useStore,
  toggleComplete,
  deleteAssignment,
  deleteCourse,
  updateSettings,
  courseById,
} from "./lib/store.js";
import {
  scheduleAll,
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
} from "./lib/notifications.js";
import {
  pushConfigured,
  pushEnable,
  pushSync,
  pushDisable,
} from "./lib/push.js";

import Dashboard from "./components/Dashboard.jsx";
import Courses from "./components/Courses.jsx";
import Settings from "./components/Settings.jsx";
import Modal from "./components/Modal.jsx";
import CourseForm from "./components/CourseForm.jsx";
import AssignmentForm from "./components/AssignmentForm.jsx";
import StudyGuide from "./components/StudyGuide.jsx";
import ImportModal from "./components/ImportModal.jsx";
import { decodeImportPayload } from "./lib/canvasImport.js";

function detectStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function App() {
  const state = useStore();
  const [tab, setTab] = useState("dashboard");
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState(null); // { type, data }
  const [toast, setToast] = useState("");
  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const standalone = useMemo(detectStandalone, []);

  // Live countdown tick.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Import link: open the app at #import=<payload> to preview a Canvas import.
  useEffect(() => {
    const m = window.location.hash.match(/[#&]import=([^&]+)/);
    if (!m) return;
    decodeImportPayload(m[1])
      .then((payload) => {
        if (payload && Array.isArray(payload.assignments) && payload.assignments.length) {
          setModal({ type: "import", data: { payload } });
        }
      })
      .catch(() => {
        /* ignore malformed payload */
      });
    // Strip the hash so a refresh doesn't re-open the importer.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // (Re)schedule in-app (foreground) reminders whenever data changes.
  useEffect(() => {
    scheduleAll(state.assignments, state.courses, state.settings);
  }, [state.assignments, state.courses, state.settings, notifPerm]);

  // Keep the server-side push schedule in sync (when subscribed + configured).
  useEffect(() => {
    if (state.settings.notificationsEnabled && pushConfigured()) {
      pushSync(state.assignments, state.courses);
    }
  }, [state.assignments, state.courses, state.settings.notificationsEnabled]);

  // Toast auto-dismiss.
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  // ---- Modal helpers -----------------------------------------------------
  const openNewCourse = () => setModal({ type: "course", data: null });
  const openEditCourse = (course) => setModal({ type: "course", data: { course } });
  const openNewAssignment = (lockedCourseId) =>
    setModal({ type: "assignment", data: { lockedCourseId } });
  const openEditAssignment = (assignment) =>
    setModal({ type: "assignment", data: { assignment } });
  const openStudy = (assignment) =>
    setModal({ type: "study", data: { assignmentId: assignment.id } });
  const openImport = () => setModal({ type: "import", data: {} });
  const closeModal = () => setModal(null);

  const handleImported = (result) => {
    closeModal();
    setTab("dashboard");
    showToast(`Added ${result.count} assignment${result.count === 1 ? "" : "s"}`);
    // The push-sync effect re-runs automatically on the assignments change.
  };

  // ---- Actions -----------------------------------------------------------
  const handleDeleteAssignment = (assignment) => {
    if (window.confirm(`Delete "${assignment.name}"?`)) {
      deleteAssignment(assignment.id);
      showToast("Assignment deleted");
    }
  };

  const handleDeleteCourse = (course) => {
    const count = state.assignments.filter((a) => a.courseId === course.id).length;
    const msg =
      count > 0
        ? `Delete "${course.name}" and its ${count} assignment${count === 1 ? "" : "s"}?`
        : `Delete "${course.name}"?`;
    if (window.confirm(msg)) {
      deleteCourse(course.id);
      showToast("Course deleted");
    }
  };

  const handleCourseFormDone = (courseId) => {
    const wasFirst = state.courses.length === 0;
    closeModal();
    // After adding the very first course, prompt to add its first assignment.
    if (wasFirst && courseId) {
      setTimeout(() => openNewAssignment(courseId), 150);
    }
  };

  const handleAdd = () => {
    if (state.courses.length === 0) openNewCourse();
    else openNewAssignment();
  };

  const enableNotifications = async () => {
    if (!notificationsSupported()) {
      showToast("Notifications not supported here");
      return;
    }
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm !== "granted") {
      updateSettings({ notificationPromptSeen: true });
      showToast("Permission not granted");
      return;
    }
    updateSettings({ notificationsEnabled: true, notificationPromptSeen: true });

    // If a push backend is configured, subscribe this device for real
    // when-closed notifications; otherwise fall back to foreground reminders.
    if (pushConfigured()) {
      const result = await pushEnable(state.assignments, state.courses);
      showToast(
        result.ok
          ? "Reminders on"
          : "Reminders on (this device couldn't subscribe to push)",
      );
    } else {
      showToast("Reminders on");
    }
  };

  const disableNotifications = () => {
    updateSettings({ notificationsEnabled: false });
    if (pushConfigured()) pushDisable();
    showToast("Reminders off");
  };

  // The live assignment for the study-guide modal, looked up fresh each render.
  const studyAssignment =
    modal?.type === "study"
      ? state.assignments.find((a) => a.id === modal.data.assignmentId)
      : null;

  // If the studied assignment gets deleted while its modal is open, close it.
  useEffect(() => {
    if (modal?.type === "study" && !studyAssignment) closeModal();
  }, [modal, studyAssignment]);

  // First-run reminder nudge: once there's an assignment, offer notifications.
  const showNotifNudge =
    !state.settings.notificationPromptSeen &&
    notificationsSupported() &&
    notifPerm === "default" &&
    state.assignments.length > 0;

  const showInstallBanner =
    !standalone && !state.settings.installBannerDismissed && tab === "dashboard";

  return (
    <div className="app">
      <header className="app-header">
        <span className="mark">SH</span>
        <h1>Study Hub</h1>
        {tab !== "settings" && (
          <button className="header-add" onClick={handleAdd}>
            Add
          </button>
        )}
      </header>

      <main className="app-main">
        {tab === "dashboard" && (
          <>
            {showInstallBanner && (
              <div className="banner">
                <strong>Add to Home Screen</strong>
                Install Study Hub from Safari's Share button, then choose "Add to
                Home Screen" for reminders and full-screen use.
                <div className="banner-actions">
                  <button
                    className="link-btn"
                    onClick={() =>
                      updateSettings({ installBannerDismissed: true })
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {showNotifNudge && (
              <div className="banner">
                <strong>Turn on reminders?</strong>
                Get pinged 3 days, 1 day, and 3 hours before each due date.
                <div className="banner-actions">
                  <button className="primary-btn gold" onClick={enableNotifications}>
                    Enable
                  </button>
                  <button
                    className="link-btn"
                    onClick={() =>
                      updateSettings({ notificationPromptSeen: true })
                    }
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}

            <Dashboard
              state={state}
              now={now}
              onToggle={toggleComplete}
              onEdit={openEditAssignment}
              onDelete={handleDeleteAssignment}
              onStudy={openStudy}
              onAddCourse={openNewCourse}
              onAddAssignment={() => openNewAssignment()}
            />
          </>
        )}

        {tab === "courses" && (
          <Courses
            state={state}
            now={now}
            onAddCourse={openNewCourse}
            onEditCourse={openEditCourse}
            onDeleteCourse={handleDeleteCourse}
            onAddAssignmentToCourse={(courseId) => openNewAssignment(courseId)}
            onToggle={toggleComplete}
            onEditAssignment={openEditAssignment}
            onImport={openImport}
          />
        )}

        {tab === "settings" && (
          <Settings
            settings={state.settings}
            standalone={standalone}
            notifSupported={notificationsSupported()}
            notifPermission={notifPerm}
            pushReady={pushConfigured()}
            onEnableNotifications={enableNotifications}
            onDisableNotifications={disableNotifications}
            onToast={showToast}
          />
        )}
      </main>

      {/* Bottom tab navigation (text labels) */}
      <nav className="tabbar">
        <button
          className={tab === "dashboard" ? "active" : ""}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={tab === "courses" ? "active" : ""}
          onClick={() => setTab("courses")}
        >
          Courses
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </nav>

      {/* Modals */}
      {modal?.type === "course" && (
        <Modal
          title={modal.data?.course ? "Edit course" : "Add course"}
          onClose={closeModal}
        >
          <CourseForm
            existingCourses={state.courses}
            course={modal.data?.course}
            onDone={handleCourseFormDone}
          />
        </Modal>
      )}

      {modal?.type === "assignment" && (
        <Modal
          title={modal.data?.assignment ? "Edit assignment" : "Add assignment"}
          onClose={closeModal}
        >
          {state.courses.length === 0 ? (
            <div className="empty" style={{ padding: "20px 0" }}>
              <p>Add a course first, then you can add assignments to it.</p>
              <button
                className="primary-btn gold"
                onClick={() => setModal({ type: "course", data: null })}
              >
                Add course
              </button>
            </div>
          ) : (
            <AssignmentForm
              courses={state.courses}
              assignment={modal.data?.assignment}
              lockedCourseId={modal.data?.lockedCourseId}
              onDone={() => {
                closeModal();
                showToast(modal.data?.assignment ? "Saved" : "Assignment added");
              }}
            />
          )}
        </Modal>
      )}

      {modal?.type === "import" && (
        <Modal title="Import from Canvas" onClose={closeModal}>
          <ImportModal
            courses={state.courses}
            settings={state.settings}
            initialPayload={modal.data?.payload || null}
            onImported={handleImported}
          />
        </Modal>
      )}

      {modal?.type === "study" && studyAssignment && (
        <Modal title="Study Guide" onClose={closeModal}>
          <div style={{ marginBottom: 10 }}>
            <div className="course-line">
              <span
                className="course-chip"
                style={{
                  background:
                    courseById(state, studyAssignment.courseId)?.color ||
                    "#b0a892",
                }}
              />
              <span>
                {courseById(state, studyAssignment.courseId)?.name} ·{" "}
                {studyAssignment.name}
              </span>
            </div>
          </div>
          <StudyGuide
            assignment={studyAssignment}
            course={courseById(state, studyAssignment.courseId)}
            settings={state.settings}
            onNeedKey={() => showToast("Add your API key in Settings")}
          />
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
