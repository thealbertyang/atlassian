import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAppContext } from "../../../contexts/app-context";

export const Route = createFileRoute("/jira/issues/$key")({
  component: JiraIssuePage,
  staticData: {
    tabHidden: true,
  },
});

const truncate = (value: string, length: number) => {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length).trim()}…`;
};

function JiraIssuePage() {
  const {
    issue,
    issueLoading,
    issueError,
    issueKey,
    issueView,
    setIssueView,
    openIssueInBrowser,
    refreshIssue,
    copyDeepLink,
    deepLinkUrl,
    isWebview,
    openSettings,
  } = useAppContext();

  const description = useMemo(() => {
    if (!issue?.description) {
      return "";
    }
    return issueView === "compact" ? truncate(issue.description, 420) : issue.description;
  }, [issue?.description, issueView]);

  return (
    <section className="grid">
      <div className="card">
        <div className="issue-header">
          <div>
            <h2>Issue {issueKey ? `• ${issueKey}` : ""}</h2>
            {issue?.summary ? <p className="issue-title">{issue.summary}</p> : null}
          </div>
          <div className="issue-actions">
            <button
              type="button"
              className="icon-button"
              onClick={copyDeepLink}
              disabled={!isWebview}
              title="Copy link"
              aria-label="Copy link"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
              </svg>
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={openIssueInBrowser}
              disabled={!isWebview}
              title="Open Issue"
              aria-label="Open Issue"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zm-2 4v2H7v10h10v-5h2v7H5V7h7z" />
              </svg>
            </button>
          </div>
        </div>

        {issueLoading ? (
          <p className="note">Loading issue details…</p>
        ) : issueError ? (
          <p className="note">{issueError}</p>
        ) : issue ? (
          <>
            <div className="issue-meta">
              <span className="pill pill-muted">{issue.issueType}</span>
              <span className="pill pill-muted">{issue.status}</span>
              {issue.priority ? <span className="pill pill-muted">{issue.priority}</span> : null}
            </div>
            <div className="issue-fields">
              {issue.project ? (
                <p>
                  <span className="label">Project</span> {issue.project}
                </p>
              ) : null}
              {issue.assignee ? (
                <p>
                  <span className="label">Assignee</span> {issue.assignee}
                </p>
              ) : null}
              {issue.reporter ? (
                <p>
                  <span className="label">Reporter</span> {issue.reporter}
                </p>
              ) : null}
              {issue.created ? (
                <p>
                  <span className="label">Created</span> {new Date(issue.created).toLocaleString()}
                </p>
              ) : null}
              {issue.updated ? (
                <p>
                  <span className="label">Updated</span> {new Date(issue.updated).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="issue-toggle">
              <span className="label">Description view</span>
              <div className="segmented">
                <button
                  type="button"
                  className={issueView === "compact" ? "active" : ""}
                  onClick={() => setIssueView("compact")}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={issueView === "full" ? "active" : ""}
                  onClick={() => setIssueView("full")}
                >
                  Full
                </button>
              </div>
            </div>
            {description ? (
              <pre className="issue-description">{description}</pre>
            ) : (
              <p className="note">No description available.</p>
            )}
            <div className="note">
              Share this view: <code>{deepLinkUrl}</code>
            </div>
          </>
        ) : (
          <p className="note">Select an issue to load details.</p>
        )}

        <div className="refresh-fab">
          <button
            type="button"
            className="icon-button"
            onClick={refreshIssue}
            disabled={!isWebview || issueLoading}
            title="Refresh issue"
            aria-label="Refresh issue"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="card">
        <h2>Issue actions</h2>
        <p className="note">
          This view is powered by the Atlassian data provider. Use the tree view to select another
          issue.
        </p>
        <div className="actions">
          <button className="secondary" onClick={openSettings} disabled={!isWebview}>
            Open VS Code Settings
          </button>
        </div>
      </div>
    </section>
  );
}
