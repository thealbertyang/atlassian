import { createFileRoute } from "@tanstack/react-router";
import { useAppContext } from "../../contexts/app-context";

export const Route = createFileRoute("/jira/")({
  component: JiraPage,
  staticData: {
    tabLabel: "Jira",
    tabOrder: 4,
    breadcrumbLabel: "Jira",
  },
});

function JiraPage() {
  const { issueKey, issue, issueLoading, issueError, openSettings, isWebview } = useAppContext();

  return (
    <section className="grid">
      <div className="card">
        <h2>Jira</h2>
        {issueKey ? (
          <p className="note">
            Opened issue: <strong>{issueKey}</strong>
          </p>
        ) : (
          <p className="note">
            Select an issue from the Atlassian Sprint tree to view details here.
          </p>
        )}
        {issueLoading ? <p className="note">Loading issue details…</p> : null}
        {issueError ? <p className="note">{issueError}</p> : null}
        {issue && !issueLoading ? (
          <div className="note">
            {issue.key}: {issue.summary}
          </div>
        ) : null}
      </div>
      <div className="card">
        <h2>Workspace settings</h2>
        <p className="note">Update Jira credentials or JQL in VS Code settings.</p>
        <div className="actions">
          <button className="secondary" onClick={openSettings} disabled={!isWebview}>
            Open VS Code Settings
          </button>
        </div>
      </div>
    </section>
  );
}
