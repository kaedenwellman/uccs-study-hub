// Text-to-speech via the browser's built-in Web Speech API (speechSynthesis).
// Free, offline, no API key. Works in iOS Safari / installed PWAs.
//
// Two quirks this handles:
//  1. Long utterances get cut off (~15s) on Safari/Chrome, so we split the
//     text into sentence-sized chunks and queue them.
//  2. speak() must be triggered by a user gesture — the Listen button is one.
import { useCallback, useEffect, useRef, useState } from "react";

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Break text into speakable chunks (roughly one sentence each, capped in size).
function chunkText(text) {
  const sentences = text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]*/g) || [text];
  const chunks = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 220) {
      chunks.push(trimmed);
    } else {
      // Split over-long sentences on commas so nothing gets truncated.
      let buf = "";
      for (const part of trimmed.split(/,\s*/)) {
        if ((buf + part).length > 220 && buf) {
          chunks.push(buf.trim());
          buf = "";
        }
        buf += (buf ? ", " : "") + part;
      }
      if (buf.trim()) chunks.push(buf.trim());
    }
  }
  return chunks;
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  // Prefer a natural-sounding English voice, else the first English voice.
  return (
    voices.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Google|Natural/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null
  );
}

// status: "idle" | "speaking" | "paused"
export function useSpeech() {
  const [status, setStatus] = useState("idle");
  const [rate, setRate] = useState(1);
  // Track the currently-playing "session" so late callbacks from a cancelled
  // run don't clobber the state of a newer one.
  const sessionRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const stop = useCallback(() => {
    if (!speechSupported()) return;
    sessionRef.current += 1;
    window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  const speak = useCallback((text) => {
    if (!speechSupported() || !text) return;
    window.speechSynthesis.cancel();
    const session = ++sessionRef.current;
    const voice = pickVoice();
    const chunks = chunkText(text);

    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.rate = rateRef.current;
      u.pitch = 1;
      if (voice) u.voice = voice;
      if (i === 0) {
        u.onstart = () => {
          if (session === sessionRef.current) setStatus("speaking");
        };
      }
      if (i === chunks.length - 1) {
        u.onend = () => {
          if (session === sessionRef.current) setStatus("idle");
        };
      }
      u.onerror = () => {
        if (session === sessionRef.current) setStatus("idle");
      };
      window.speechSynthesis.speak(u);
    });
    setStatus("speaking");
  }, []);

  const pause = useCallback(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, []);

  // Cancel any in-flight speech when the component using this unmounts.
  useEffect(() => () => stop(), [stop]);

  return { status, rate, setRate, speak, pause, resume, stop };
}
