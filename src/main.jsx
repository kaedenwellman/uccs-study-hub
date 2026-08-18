import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Register the service worker (app shell caching + notifications).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(import.meta.env.DEV ? "/dev-sw.js?dev-sw" : "./sw.js", {
        type: import.meta.env.DEV ? "module" : "classic",
        scope: "./",
      })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
