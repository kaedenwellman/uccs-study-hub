import { useState, useEffect, useCallback, useMemo } from "react";
import { generateStudyGuide, parseStudyGuide } from "../lib/ai.js";
import { setStudyGuide } from "../lib/store.js";
import { useSpeech, speechSupported } from "../lib/speech.js";
import { PlayIcon, PauseIcon, StopIcon } from "./icons.jsx";

export default function StudyGuide({ assignment, course, settings, onNeedKey }) {
  const guide = assignment.studyGuide;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setError("");
    if (!settings.apiKey) {
      onNeedKey?.();
      setError("Add your Anthropic API key in Settings to generate a guide.");
      return;
    }
    setLoading(true);
    try {
      const text = await generateStudyGuide({
        apiKey: settings.apiKey,
        model: settings.model,
        course: course?.name || "Course",
        assignment: assignment.name,
        topic: assignment.topic,
      });
      setStudyGuide(assignment.id, {
        text,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message || "Something went wrong generating the guide.");
    } finally {
      setLoading(false);
    }
  }, [assignment.id, assignment.name, assignment.topic, course, settings, onNeedKey]);

  // Auto-generate on first open if no cached guide exists and a key is set.
  useEffect(() => {
    if (!guide && !loading && !error && settings.apiKey) {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="sg-loading">
        <span className="loading-note">Generating your study guide</span>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="sg-loading">
        {error ? (
          <>
            <p className="field-error" style={{ marginBottom: 16 }}>
              {error}
            </p>
            <button className="primary-btn gold" onClick={run}>
              Try again
            </button>
          </>
        ) : (
          <button className="primary-btn gold" onClick={run}>
            Generate study guide
          </button>
        )}
      </div>
    );
  }

  const parsed = parseStudyGuide(guide.text);

  return (
    <div>
      <ListenBar parsed={parsed} />

      {parsed.keyConcepts && (
        <div className="sg-section">
          <h3>Key Concepts</h3>
          {toBullets(parsed.keyConcepts).map((line, i) => (
            <p className="sg-concept" key={i}>
              {line}
            </p>
          ))}
        </div>
      )}

      {parsed.summary && (
        <div className="sg-section">
          <h3>Quick Summary</h3>
          <div className="sg-summary">{parsed.summary}</div>
        </div>
      )}

      {parsed.questions.length > 0 && (
        <div className="sg-section">
          <h3>Practice Questions</h3>
          {parsed.questions.map((q, i) => (
            <PracticeQuestion key={i} index={i + 1} q={q} />
          ))}
        </div>
      )}

      {error && <div className="field-error">{error}</div>}

      <div className="sg-footer">
        <button className="ghost-btn" onClick={run} disabled={loading}>
          Regenerate
        </button>
      </div>
      {guide.generatedAt && (
        <div className="sg-meta">
          Generated {new Date(guide.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function PracticeQuestion({ index, q }) {
  const [show, setShow] = useState(false);
  return (
    <div className="sg-question">
      <div className="q">
        {index}. {q.q}
      </div>
      {q.a && !show && (
        <button className="reveal-btn" onClick={() => setShow(true)}>
          Show answer
        </button>
      )}
      {q.a && show && (
        <div className="sg-answer">
          <span className="a-label">Answer</span> {q.a}
        </div>
      )}
    </div>
  );
}

// Spoken read-out bar: reads Key Concepts + Quick Summary aloud.
const SPEEDS = [1, 1.25, 1.5, 0.75];

function ListenBar({ parsed }) {
  const { status, rate, setRate, speak, pause, resume, stop } = useSpeech();

  const listenText = useMemo(() => {
    const parts = [];
    if (parsed.keyConcepts) {
      parts.push("Key concepts. " + toBullets(parsed.keyConcepts).join(". "));
    }
    if (parsed.summary) {
      parts.push("Quick summary. " + parsed.summary);
    }
    return parts.join(". ");
  }, [parsed.keyConcepts, parsed.summary]);

  if (!speechSupported() || !listenText) return null;

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
    // Apply the new speed immediately if something is playing.
    if (status !== "idle") setTimeout(() => speak(listenText), 0);
  };

  return (
    <div className="listen-bar">
      <span className="listen-label">Listen</span>

      {status === "idle" && (
        <button className="listen-btn primary" onClick={() => speak(listenText)}>
          <PlayIcon /> Play
        </button>
      )}
      {status === "speaking" && (
        <button className="listen-btn primary" onClick={pause}>
          <PauseIcon /> Pause
        </button>
      )}
      {status === "paused" && (
        <button className="listen-btn primary" onClick={resume}>
          <PlayIcon /> Resume
        </button>
      )}

      {status !== "idle" && (
        <button className="listen-btn" onClick={stop} aria-label="Stop">
          <StopIcon />
        </button>
      )}

      <button className="listen-speed" onClick={cycleSpeed}>
        {rate}×
      </button>
    </div>
  );
}

// Turn a raw "Key Concepts" text block into clean bullet lines, stripping any
// leading list markers the model included.
function toBullets(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
}
