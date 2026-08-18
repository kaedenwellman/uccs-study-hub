// localStorage-backed data layer with a tiny pub/sub store so any component
// can read/write via useSyncExternalStore without a heavier state library.
import { useSyncExternalStore } from "react";
import { nextColor } from "./palette.js";

const STORAGE_KEY = "uccs-study-hub";
const SCHEMA_VERSION = 1;

export const ASSIGNMENT_TYPES = ["homework", "quiz", "test", "project", "other"];
export const TYPE_LABELS = {
  homework: "Homework",
  quiz: "Quiz",
  test: "Test",
  project: "Project",
  other: "Other",
};
// Only quizzes and tests get a study guide.
export const STUDYABLE_TYPES = new Set(["quiz", "test"]);

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    courses: [],
    assignments: [],
    settings: {
      apiKey: "",
      model: "claude-sonnet-4-6",
      notificationsEnabled: false,
      notificationPromptSeen: false,
      installBannerDismissed: false,
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
    };
  } catch (err) {
    console.warn("Failed to load saved data, starting fresh:", err);
    return emptyState();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to persist data:", err);
  }
}

function setState(next) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// ---- Courses -------------------------------------------------------------

export function addCourse({ name, instructor, color }) {
  const course = {
    id: uid(),
    name: name.trim(),
    instructor: (instructor || "").trim(),
    color: color || nextColor(state.courses),
  };
  setState({ ...state, courses: [...state.courses, course] });
  return course;
}

export function updateCourse(id, patch) {
  setState({
    ...state,
    courses: state.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  });
}

export function deleteCourse(id) {
  setState({
    ...state,
    courses: state.courses.filter((c) => c.id !== id),
    assignments: state.assignments.filter((a) => a.courseId !== id),
  });
}

// ---- Assignments ---------------------------------------------------------

export function addAssignment({ courseId, name, type, dueDate, topic }) {
  const assignment = {
    id: uid(),
    courseId,
    name: name.trim(),
    type,
    dueDate,
    topic: (topic || "").trim(),
    completed: false,
    completedAt: null,
    studyGuide: null,
  };
  setState({ ...state, assignments: [...state.assignments, assignment] });
  return assignment;
}

export function updateAssignment(id, patch) {
  setState({
    ...state,
    assignments: state.assignments.map((a) =>
      a.id === id ? { ...a, ...patch } : a,
    ),
  });
}

export function deleteAssignment(id) {
  setState({
    ...state,
    assignments: state.assignments.filter((a) => a.id !== id),
  });
}

export function toggleComplete(id) {
  setState({
    ...state,
    assignments: state.assignments.map((a) =>
      a.id === id
        ? {
            ...a,
            completed: !a.completed,
            completedAt: !a.completed ? new Date().toISOString() : null,
          }
        : a,
    ),
  });
}

export function setStudyGuide(id, guide) {
  updateAssignment(id, { studyGuide: guide });
}

// ---- Settings ------------------------------------------------------------

export function updateSettings(patch) {
  setState({ ...state, settings: { ...state.settings, ...patch } });
}

// ---- Selectors -----------------------------------------------------------

export function courseById(s, id) {
  return s.courses.find((c) => c.id === id) || null;
}

export function sortedUpcoming(s) {
  return s.assignments
    .filter((a) => !a.completed)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

export function sortedCompleted(s) {
  return s.assignments
    .filter((a) => a.completed)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
}

export function assignmentsForCourse(s, courseId) {
  return s.assignments
    .filter((a) => a.courseId === courseId)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
}
