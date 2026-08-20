// Anthropic API call for on-demand study-guide generation.
//
// Note: this calls the API directly from the browser using the user's own key
// (stored in localStorage, per the app's design). That requires the
// `anthropic-dangerous-direct-browser-access` header and sends the key from the
// device. It's fine for a personal app you don't share; a shared deployment
// should proxy through a backend instead.

const SYSTEM_PROMPT = `You are a concise study assistant for a college engineering student. Given a topic, generate a focused study guide with:
1. KEY CONCEPTS — a bulleted list of the 5-8 most important concepts, each with a one-sentence explanation
2. QUICK SUMMARY — a 3-4 sentence overview connecting the key ideas
3. PRACTICE QUESTIONS — 5 practice questions (mix of multiple choice and short answer) with answers. Format each question on its own line, followed by 'ANSWER: ...' on the next line.
Keep everything concise and exam-focused. No filler. Do not use em dashes; use commas, colons, or separate sentences instead.`;

export async function generateStudyGuide({ apiKey, model, course, assignment, topic }) {
  if (!apiKey) {
    throw new Error(
      "No Anthropic API key set. Add one in Settings to generate study guides.",
    );
  }

  const userMessage = `Course: ${course}. Assignment: ${assignment}. Topics to cover: ${
    topic && topic.trim() ? topic : "(no topic details provided — infer likely exam topics from the course and assignment name)"
  }`;

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch (networkErr) {
    throw new Error(
      "Network error reaching the Anthropic API. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      detail = data?.error?.message || "";
    } catch {
      /* ignore parse failure */
    }
    if (response.status === 401) {
      throw new Error("Invalid API key. Check the key in Settings.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited by the API. Wait a moment and try again.");
    }
    throw new Error(
      `Study guide request failed (${response.status})${detail ? ": " + detail : ""}.`,
    );
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("The API returned an empty response.");
  return text;
}

const ESTIMATE_SYSTEM = `You are a study-planning assistant for a college engineering student. Given an assignment, estimate how long it takes to complete start to finish for a typical student. Respond in exactly this format:
First line: a single time range only, like "2-3 hours" or "30-45 minutes".
Second line: one short sentence (max 20 words) on the main factors driving the estimate.
Be realistic. No extra text, no markdown.`;

export async function generateTimeEstimate({
  apiKey,
  model,
  course,
  assignment,
  type,
  topic,
}) {
  if (!apiKey) {
    throw new Error("No Anthropic API key set. Add one in Settings.");
  }

  const userMessage = `Course: ${course}. Assignment: ${assignment} (type: ${type}).${
    topic && topic.trim() ? " Details: " + topic : ""
  }`;

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-6",
        max_tokens: 150,
        system: ESTIMATE_SYSTEM,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch {
    throw new Error("Network error reaching the Anthropic API.");
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid API key.");
    if (response.status === 429) throw new Error("Rate limited. Try again shortly.");
    throw new Error(`Estimate request failed (${response.status}).`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) throw new Error("The API returned an empty response.");

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    range: lines[0] || text,
    rationale: lines.slice(1).join(" "),
    generatedAt: new Date().toISOString(),
  };
}

// Parse the model output into structured sections for rendering.
// Returns { keyConcepts: string, summary: string, questions: [{q, a}] }.
export function parseStudyGuide(text) {
  const sections = splitSections(text);
  return {
    keyConcepts: sections.concepts,
    summary: sections.summary,
    questions: parseQuestions(sections.questions),
    raw: text,
  };
}

function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const buckets = { concepts: [], summary: [], questions: [] };
  let current = null;

  for (const line of lines) {
    const header = detectHeader(line);
    if (header) {
      current = header;
      continue;
    }
    if (current) buckets[current].push(line);
  }

  // If headers weren't detected, fall back to dumping everything into concepts.
  if (!buckets.concepts.length && !buckets.summary.length && !buckets.questions.length) {
    buckets.concepts = lines;
  }

  return {
    concepts: buckets.concepts.join("\n").trim(),
    summary: buckets.summary.join("\n").trim(),
    questions: buckets.questions.join("\n").trim(),
  };
}

function detectHeader(line) {
  const l = line.toLowerCase();
  if (/key concepts?/.test(l)) return "concepts";
  if (/quick summary|summary/.test(l) && !/practice/.test(l)) return "summary";
  if (/practice questions?/.test(l)) return "questions";
  return null;
}

function parseQuestions(block) {
  if (!block) return [];
  const lines = block.split(/\r?\n/);
  const questions = [];
  let currentQ = null;

  const flush = () => {
    if (currentQ && currentQ.q.trim()) questions.push(currentQ);
    currentQ = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const answerMatch = line.match(/^(?:\*\*)?answer\s*[:\-]?\s*(?:\*\*)?\s*(.*)$/i);
    if (answerMatch && currentQ) {
      currentQ.a = answerMatch[1].trim();
      continue;
    }

    // A new numbered question (e.g. "1." or "3)") starts a new entry.
    const numbered = line.match(/^\s*(\d+)[.)]\s*(.*)$/);
    if (numbered) {
      flush();
      currentQ = { q: numbered[2].trim(), a: "" };
      continue;
    }

    // Otherwise treat the line as a continuation of the current question or
    // its answer (multiple-choice options usually land here).
    if (currentQ) {
      if (currentQ.a) currentQ.a += "\n" + line;
      else currentQ.q += "\n" + line;
    }
  }
  flush();
  return questions;
}
