import { createFileRoute } from "@tanstack/react-router";
import { useAppContext } from "../../contexts/app-context";
import { KvGrid, type KvItem } from "../../components/KvGrid";

export const Route = createFileRoute("/dev/")({
  component: DevPage,
  staticData: {
    tabLabel: "Dev",
    tabOrder: 5,
  },
});

function DevPage() {
  const {
    runDevWebview,
    reloadWebviews,
    reinstallExtension,
    restartExtensionHost,
    isWebview,
    formatTimestamp,
    state,
    deepLinkBase,
    deepLinkUrl,
    copyDeepLink,
  } = useAppContext();

  return (
    <section className="grid">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Dev tooling</div>
            <h2>Shortcuts</h2>
            <p className="card-sub">Fast paths for webview and extension host iteration.</p>
          </div>
          <span className="pill pill-muted">{state.devMode ? "Dev mode" : "Release mode"}</span>
        </div>
        <ul className="list">
          <li>
            Webview UI: <code>bun run dev:webview</code> (HMR enabled)
          </li>
          <li>
            Extension host: <code>Developer: Restart Extension Host</code> or{" "}
            <code>Developer: Reload Webviews</code>
          </li>
        </ul>
        <div className="dev-actions">
          <button className="secondary" onClick={runDevWebview} disabled={!isWebview}>
            Run dev:webview
          </button>
          <button className="secondary" onClick={reloadWebviews} disabled={!isWebview}>
            Reload Webviews
          </button>
          <button className="secondary" onClick={reinstallExtension} disabled={!isWebview}>
            Reinstall Extension
          </button>
          <button className="secondary" onClick={restartExtensionHost} disabled={!isWebview}>
            Restart Extension Host
          </button>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Build status</div>
            <h2>Latest activity</h2>
            <p className="card-sub">When the extension or webview last updated.</p>
          </div>
        </div>
        <KvGrid
          items={[
            { label: "Extension build", value: formatTimestamp(state.dev?.lastExtensionBuildAt) },
            { label: "Webview render", value: formatTimestamp(state.dev?.lastWebviewRenderAt) },
          ]}
        />
        <div className="callout">
          If HMR stalls, restart the webview or refresh the extension host.
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Deep links</div>
            <h2>Jump to views</h2>
            <p className="card-sub">Share or open a route directly.</p>
          </div>
        </div>
        <div className="code-block">{deepLinkUrl}</div>
        <div className="actions">
          <button className="secondary" onClick={copyDeepLink} disabled={!isWebview}>
            Copy deep link
          </button>
        </div>
        <ul className="list">
          <li>
            Setup: <code>{deepLinkBase}/open/setup</code>
          </li>
          <li>
            Issue: <code>{deepLinkBase}/open/jira/issues/CSO-7144</code>
          </li>
        </ul>
      </div>
    </section>
  );
}
