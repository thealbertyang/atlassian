import { createFileRoute } from "@tanstack/react-router";
import { useAppContext } from "../../contexts/app-context";

export const Route = createFileRoute("/overview/")({
  component: OverviewPage,
  staticData: {
    tabLabel: "Overview",
    tabOrder: 1,
  },
});

function OverviewPage() {
  const { status, state } = useAppContext();
  const authLabel =
    state.authType === "oauth" ? "OAuth 2.0" : state.authType === "apiToken" ? "API token" : "Not set";
  const sourceLabel = status.source === "Not configured" ? "Not configured" : status.source;
  const nextSteps = status.isConnected
    ? [
        "Open issues from the Explorer tree to see details in the Jira tab.",
        "Tune JQL and max results from the Settings tab.",
        "Use the Dev tab when working on the webview UI or extension host.",
      ]
    : [
        "Open the Setup tab to add your Jira URL, email, and API token.",
        "Store secrets in .env.local when you want per-workspace credentials.",
        "After connecting, use the Settings tab to tune JQL and max results.",
      ];

  return (
    <section className="grid">
      <div className="card card-hero">
        <div className="card-header">
          <div>
            <div className="eyebrow">Connection</div>
            <h2>Current status</h2>
            <p className="card-sub">
              Summary of how the extension is configured and authenticated.
            </p>
          </div>
          <span className={`pill ${status.isConnected ? "pill-ok" : "pill-warn"}`}>
            {status.isConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        <div className="kv-grid">
          <div className="kv">
            <div className="kv-label">Base URL</div>
            <div className={`kv-value ${state.baseUrl ? "" : "kv-muted"}`}>
              {state.baseUrl || "Not set"}
            </div>
          </div>
          <div className="kv">
            <div className="kv-label">Account</div>
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
            <div className="kv-label">Config source</div>
            <div className={`kv-value ${sourceLabel === "Not configured" ? "kv-muted" : ""}`}>
              {sourceLabel}
            </div>
          </div>
        </div>
        <div className="callout">
          {status.isConnected
            ? "Tip: keep .env.local in sync if you switch between workspaces."
            : "Tip: connecting updates settings but never stores raw tokens in settings files."}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Workflow</div>
            <h2>What to do next</h2>
            <p className="card-sub">A quick path to get value from the extension.</p>
          </div>
        </div>
        <ul className="list">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <p className="note">
          The primary action always lives in the top header. Use tabs for deeper configuration.
        </p>
      </div>
    </section>
  );
}
