import { createFileRoute } from "@tanstack/react-router";
import { useAppContext } from "../../contexts/app-context";
import { ConnectionDetails } from "../../components/ConnectionDetails";
import { StatusPill } from "../../components/ConnectionPill";
import { OpenSettingsButton } from "../../components/OpenSettingsButton";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
  staticData: {
    tabLabel: "Settings",
    tabOrder: 3,
  },
});

function SettingsPage() {
  const { status, loading } = useAppContext();

  return (
    <section className="grid">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Settings</div>
            <h2>Configuration snapshot</h2>
            <p className="card-sub">Where the current values are coming from.</p>
          </div>
          <StatusPill variant="muted" label={status.source} />
        </div>
        <ConnectionDetails
          fields={["baseUrl", "email", "authMode", "configSource", "tokenStorage"]}
        />
        <div className="actions">
          <OpenSettingsButton loading={loading} />
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
