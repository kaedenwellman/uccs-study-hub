import { useState } from "react";
import { updateSettings } from "../lib/store.js";

export default function Settings({
  settings,
  standalone,
  notifSupported,
  notifPermission,
  pushReady,
  onEnableNotifications,
  onDisableNotifications,
  onToast,
}) {
  const [keyInput, setKeyInput] = useState(settings.apiKey || "");
  const [canvasUrl, setCanvasUrl] = useState(settings.canvasUrl || "");
  const [canvasToken, setCanvasToken] = useState(settings.canvasToken || "");
  const notifOn = settings.notificationsEnabled && notifPermission === "granted";

  function saveKey() {
    updateSettings({ apiKey: keyInput.trim() });
    onToast("API key saved");
  }

  function saveCanvas() {
    updateSettings({
      canvasUrl: canvasUrl.trim(),
      canvasToken: canvasToken.trim(),
    });
    onToast("Canvas connection saved");
  }

  return (
    <div>
      <h2 className="view-title">Settings</h2>

      {/* AI */}
      <div className="settings-group">
        <h3>AI Study Guides</h3>
        <p>
          Study guides are generated with your own Anthropic API key. It is
          stored only on this device (in your browser) and sent directly to
          Anthropic. Don't share this installed app with others.
        </p>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Anthropic API key</label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button className="primary-btn" onClick={saveKey}>
          Save key
        </button>
        {settings.apiKey ? (
          <span className="status-pill on" style={{ marginLeft: 10 }}>
            Key set
          </span>
        ) : (
          <span className="status-pill off" style={{ marginLeft: 10 }}>
            No key
          </span>
        )}
        <p style={{ marginTop: 13, marginBottom: 0 }}>
          Get a key at console.anthropic.com. Model:{" "}
          <strong>{settings.model}</strong>.
        </p>
      </div>

      {/* Canvas */}
      <div className="settings-group">
        <h3>Canvas</h3>
        <p>
          Connect Canvas to import your courses and assignments (with full
          descriptions) in one tap. Create a token in Canvas: Account → Settings
          → Approved Integrations → New Access Token. Your URL and token stay on
          this device and are sent only to Canvas through the app's proxy.
        </p>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Canvas web address</label>
          <input
            value={canvasUrl}
            onChange={(e) => setCanvasUrl(e.target.value)}
            placeholder="e.g. canvas.uccs.edu"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Canvas access token</label>
          <input
            type="password"
            value={canvasToken}
            onChange={(e) => setCanvasToken(e.target.value)}
            placeholder="paste your access token"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button className="primary-btn" onClick={saveCanvas}>
          Save Canvas
        </button>
        {settings.canvasUrl && settings.canvasToken ? (
          <span className="status-pill on" style={{ marginLeft: 10 }}>
            Connected
          </span>
        ) : (
          <span className="status-pill off" style={{ marginLeft: 10 }}>
            Not connected
          </span>
        )}
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          Then use Courses → Import from Canvas to pull a course in.
        </p>
      </div>

      {/* Notifications */}
      <div className="settings-group">
        <h3>Reminders</h3>
        <p>
          Get reminded 3 days, 1 day, and 3 hours before each assignment is due.
          {pushReady
            ? " Once you install to the home screen and enable reminders, they arrive as push notifications even when the app is closed."
            : " Reminders fire while the app is open or recently in the background and re-arm each time you open it."}
        </p>
        {!notifSupported ? (
          <span className="status-pill off">Not supported here</span>
        ) : notifPermission === "denied" ? (
          <>
            <span className="status-pill off">Blocked</span>
            <p style={{ marginTop: 11, marginBottom: 0 }}>
              Notifications are blocked. Enable them for this site in your
              browser or OS settings, then reopen the app.
            </p>
          </>
        ) : notifOn ? (
          <>
            <span className="status-pill on" style={{ marginRight: 10 }}>
              On
            </span>
            <button className="ghost-btn" onClick={onDisableNotifications}>
              Turn off
            </button>
          </>
        ) : (
          <button className="primary-btn gold" onClick={onEnableNotifications}>
            Enable reminders
          </button>
        )}
      </div>

      {/* Install */}
      <div className="settings-group">
        <h3>Install to Home Screen</h3>
        {standalone ? (
          <p style={{ marginBottom: 0 }}>
            You're running the installed app. Reminders and offline access are
            fully available.
          </p>
        ) : (
          <>
            <p>
              For reliable reminders and a full-screen, app-like experience,
              install Study Hub to your home screen:
            </p>
            <ol>
              <li>Open the app in Safari and tap the Share button.</li>
              <li>Choose "Add to Home Screen".</li>
              <li>Open Study Hub from your home screen.</li>
            </ol>
          </>
        )}
      </div>

      <div className="settings-footer">
        UCCS Study Hub, version 1.0
        <br />
        All data is stored on this device.
      </div>
    </div>
  );
}
