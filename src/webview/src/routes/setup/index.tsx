import { createFileRoute } from "@tanstack/react-router";
import { useAppContext } from "../../contexts/app-context";
import { MASKED_SECRET } from "../../constants";

export const Route = createFileRoute("/setup/")({
  component: SetupPage,
  staticData: {
    tabLabel: "Setup",
    tabOrder: 2,
  },
});

function SetupPage() {
  const { form, updateForm, saveToken, syncEnv, loading, isWebview, state } = useAppContext();

  const isTokenMasked = form.apiToken === MASKED_SECRET;
  const tokenStatus = state.apiTokenConfigured ? "Stored" : "Not connected";

  return (
    <section className="grid">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">API token</div>
            <h2>Connect with a token</h2>
            <p className="card-sub">Fastest option for personal use or quick setup.</p>
          </div>
          <span className={`pill ${state.apiTokenConfigured ? "pill-ok" : "pill-muted"}`}>
            {tokenStatus}
          </span>
        </div>
        <div className="row">
          <label htmlFor="baseUrl">Jira site URL</label>
          <input
            id="baseUrl"
            type="text"
            placeholder="https://your-domain.atlassian.net"
            value={form.baseUrl}
            onChange={updateForm("baseUrl")}
            disabled={loading}
          />
          <div className="input-hint">Example: https://your-domain.atlassian.net</div>
        </div>
        <div className="row">
          <label htmlFor="email">Atlassian account email</label>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={updateForm("email")}
            disabled={loading}
          />
          <div className="input-hint">The email that owns the API token.</div>
        </div>
        <div className="row">
          <label htmlFor="apiToken">API token</label>
          <input
            id="apiToken"
            type="password"
            placeholder="Paste your API token"
            value={form.apiToken}
            onChange={updateForm("apiToken")}
            onFocus={(event) => {
              if (isTokenMasked) {
                event.currentTarget.select();
              }
            }}
            disabled={loading}
          />
          <div className="input-hint">Paste a new token to replace the stored one.</div>
        </div>
        <div className="actions">
          <button onClick={saveToken} disabled={loading}>
            Connect
          </button>
        </div>
        {state.apiTokenConfigured ? (
          <div className="callout">
            Existing credentials are stored securely. Enter a new token to replace them.
          </div>
        ) : null}
        <div className="note">
          Create an API token from your{" "}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noreferrer"
          >
            Atlassian account security settings
          </a>
          .
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Workspace config</div>
            <h2>.env.local workflow</h2>
            <p className="card-sub">Keep secrets out of settings and align per workspace.</p>
          </div>
        </div>
        <pre className="env-example">{`JIRA_URL=https://your-domain.atlassian.net
JIRA_USER_EMAIL=you@company.com
JIRA_API_TOKEN=your-api-token`}</pre>
        <div className="actions">
          <button className="secondary" onClick={syncEnv} disabled={!isWebview || loading}>
            Sync .env.local
          </button>
        </div>
        <div className="note">Syncing updates workspace settings to match your file.</div>
        <ul className="list">
          <li>Add JIRA_JQL if you want a custom query.</li>
          <li>Run sync whenever the file changes.</li>
        </ul>
      </div>
    </section>
  );
}
