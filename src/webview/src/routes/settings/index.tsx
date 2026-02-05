import { createFileRoute } from "@tanstack/react-router";
import { useAppContext } from "../../contexts/app-context";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
  staticData: {
    tabLabel: "Settings",
    tabOrder: 3,
  },
});

function SettingsPage() {
  const { state, status, openSettings, isWebview, loading } = useAppContext();
  const authLabel = state.authType === "apiToken" ? "API token" : "Not set";
  const tokenStorage = state.hasStoredToken ? "Stored in SecretStorage" : "Not stored";

  return (
    <section className="grid">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Settings</div>
            <h2>Configuration snapshot</h2>
            <p className="card-sub">Where the current values are coming from.</p>
          </div>
          <span className="pill pill-muted">{status.source}</span>
        </div>
        <div className="kv-grid">
          <div className="kv">
            <div className="kv-label">Base URL</div>
            <div className={`kv-value ${state.baseUrl ? "" : "kv-muted"}`}>
              {state.baseUrl || "Not set"}
            </div>
          </div>
          <div className="kv">
            <div className="kv-label">Email</div>
            <div className={`kv-value ${state.email ? "" : "kv-muted"}`}>
              {state.email || "Not set"}
            </div>
          </div>
          <div className="kv">
            <div className="kv-label">Auth mode</div>
            <div className={`kv-value ${authLabel === "Not set" ? "kv-muted" : ""}`}>
              {authLabel}
            </div>
          </div>
          <div className="kv">
            <div className="kv-label">Token storage</div>
            <div className="kv-value">{tokenStorage}</div>
          </div>
        </div>
        <div className="actions">
          <button className="secondary" onClick={openSettings} disabled={!isWebview || loading}>
            Open VS Code Settings
          </button>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Security</div>
            <h2>Where credentials live</h2>
            <p className="card-sub">Secrets stay out of settings files.</p>
          </div>
        </div>
        <ul className="list">
          <li>Tokens are stored securely in VS Code SecretStorage.</li>
          <li>Settings only show masked values for tokens.</li>
          <li>Use .env.local for workspace-specific credentials.</li>
        </ul>
        <div className="callout">
          If values look stale, sync .env.local or re-open the app panel to reload state.
        </div>
      </div>
    </section>
  );
}
