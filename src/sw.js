// Custom service worker (injectManifest strategy).
// Handles: offline app-shell precaching + local notification display/click.
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

cleanupOutdatedCaches();
// self.__WB_MANIFEST is injected at build time with the hashed app-shell assets.
precacheAndRoute(self.__WB_MANIFEST || []);

// Navigation requests fall back to the cached index when offline.
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages",
    networkTimeoutSeconds: 3,
  }),
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// The app posts { type: "SHOW_NOTIFICATION", title, body, tag } when a scheduled
// reminder is due. Displaying it through the SW is what lets iOS treat it as a
// real push-style notification once the PWA is installed.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(data.title || "Study Hub", {
      body: data.body || "",
      tag: data.tag,
      renotify: true,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { url: "./" },
    });
  }
});

// Real Web Push: fired by the server (via /api/dispatch) even when the app is
// closed. The payload is a JSON string { title, body, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Study Hub", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Study Hub", {
      body: data.body || "",
      tag: data.tag,
      renotify: true,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { url: "./" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
