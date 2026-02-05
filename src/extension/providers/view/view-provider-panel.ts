import { ExtensionContext, ExtensionMode, Uri, Webview, WebviewPanel } from "vscode";
import { readFileSync } from "fs";
import { join } from "path";
import { HandlerConfig } from "@jsonrpc-rx/server";
import { AbstractViewProvider } from "./view-provider-abstract";
import { DEFAULT_WEBVIEW_DEV_PORT } from "../../constants";
import { WebviewRenderTracker } from "../../service/webview-render-tracker";
import type { WebviewRoute } from "../../service/webview-route";
import { IPC_COMMANDS, IPC_EVENTS } from "../../../shared/ipc-contract";
import { buildRouteHash, routeHintToPath } from "../../../shared/route-contract";
import { WebviewIpcHost } from "../../service/webview-ipc";

export class ViewProviderPanel extends AbstractViewProvider {
  static readonly viewType = "atlassianAppWebviewPanel";
  static readonly title = "Atlassian Sprint";

  private readonly exposedWebviews = new WeakSet<Webview>();
  private readonly renderTracker?: WebviewRenderTracker;
  private pendingRoute?: WebviewRoute;
  private initialRoute?: WebviewRoute;
  private webviewReady = false;
  private ipc?: WebviewIpcHost;

  constructor(
    context: ExtensionContext,
    handlers: HandlerConfig,
    renderTracker?: WebviewRenderTracker,
  ) {
    super(context, handlers, {
      distDir: "out/webview",
      indexPath: "out/webview/index.html",
    });
    this.renderTracker = renderTracker;
  }

  async resolveWebviewView(webviewView: WebviewPanel) {
    const { webview } = webviewView;
    this.webviewReady = false;
    const devPort = this.getDevPort();
    webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [this.context.extensionUri, Uri.joinPath(this.context.extensionUri, "out")],
      portMapping: [{ webviewPort: devPort, extensionHostPort: devPort }],
    };

    this.exposeHandlersOnce(webview);
    this.ipc?.dispose();
    this.ipc = new WebviewIpcHost(webview);
    this.ipc.listen();
    this.ipc.onCommand(IPC_COMMANDS.REFRESH_WEBVIEW, () => {
      void this.updateWebview(webviewView);
    });
    this.ipc.onEvent(IPC_EVENTS.WEBVIEW_READY, () => {
      this.webviewReady = true;
      this.postPendingRoute();
    });
    webviewView.onDidDispose(() => {
      this.ipc?.dispose();
      this.ipc = undefined;
      this.webviewReady = false;
    });
    if (this.context.extensionMode === ExtensionMode.Development) {
      webview.html = this.getDevWaitingHtml(webview);
      void this.updateWebview(webviewView);
      return;
    }
    webview.html = await this.getWebviewHtmlSafe(webview);
    this.renderTracker?.markRendered();
  }

  private getDevPort(): number {
    return DEFAULT_WEBVIEW_DEV_PORT;
  }

  async updateWebview(webviewView: WebviewPanel) {
    this.webviewReady = false;
    webviewView.webview.html = await this.getWebviewHtmlSafe(webviewView.webview);
    this.renderTracker?.markRendered();
  }

  requestNavigate(route: WebviewRoute) {
    this.pendingRoute = route;
    this.initialRoute = route;
    this.postPendingRoute();
  }

  private exposeHandlersOnce(webview: Webview) {
    if (this.exposedWebviews.has(webview)) {
      return;
    }
    this.exposedWebviews.add(webview);
    this.exposeHandlers(webview);
  }

  private postPendingRoute() {
    if (!this.webviewReady || !this.pendingRoute || !this.ipc) {
      return;
    }
    this.ipc.sendCommand(IPC_COMMANDS.NAVIGATE, { route: this.pendingRoute });
    this.pendingRoute = undefined;
  }

  private async getWebviewHtmlSafe(webview: Webview) {
    try {
      const devHtml = await this.tryGetDevHtml(webview);
      if (devHtml) {
        return this.injectInitialRoute(devHtml);
      }
      if (this.context.extensionMode === ExtensionMode.Development) {
        return this.injectInitialRoute(this.getDevWaitingHtml(webview));
      }
      return this.injectInitialRoute(await this.getWebviewHtml(webview));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load webview UI.";
      return this.getFallbackHtml(webview, message);
    }
  }

  private getDevServerUrl(): string {
    return `http://localhost:${this.getDevPort()}/`;
  }

  private isAtlassianDevHtml(html: string): boolean {
    return html.includes("atlassian-webview");
  }

  private async tryGetDevHtml(webview: Webview): Promise<string | undefined> {
    if (this.context.extensionMode !== ExtensionMode.Development) {
      return undefined;
    }

    const devUrl = this.getDevServerUrl();
    const fetchedHtml = await this.fetchDevHtml(devUrl);
    if (!fetchedHtml) {
      return undefined;
    }

    const indexPath = join(this.context.extensionPath, this.wiewProviderOptions.indexPath);
    try {
      const htmlText = readFileSync(indexPath, { encoding: "utf8" }).toString();
      if (
        htmlText.includes(AbstractViewProvider.VSCODE_WEBVIEW_HMR_MARK) &&
        this.isAtlassianDevHtml(htmlText)
      ) {
        return this.buildWebviewHtml(webview, htmlText, devUrl);
      }
    } catch {
      // ignore and fall back to fetched HTML
    }

    return this.buildWebviewHtml(webview, fetchedHtml, devUrl);
  }

  private getDevWaitingHtml(webview: Webview) {
    const devUrl = this.getDevServerUrl();
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Atlassian Sprint</title>
    <style>
      body { font-family: sans-serif; padding: 24px; color: #1f2328; }
      .card { border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; background: #f6f8fa; max-width: 560px; }
      code { background: #f0f0f0; padding: 2px 4px; border-radius: 4px; }
      .muted { color: #57606a; margin-top: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Waiting for webview dev server…</h2>
      <p>Attempting to connect to <code>${devUrl}</code>.</p>
      <p class="muted">If it does not start, run <code>bun run dev:webview</code>.</p>
    </div>
    <script type="module">
      const devUrl = "${devUrl}";
      const vscodeApi = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
      let requested = false;
      const looksLikeVite = (text) =>
        (text.includes("@vite/client") || text.includes("vite-plugin-vscode-webview-hmr")) &&
        text.includes("atlassian-webview");
      const poll = async () => {
        try {
          const res = await fetch(devUrl);
          if (res && res.ok) {
            const text = await res.text();
            if (looksLikeVite(text)) {
              if (!requested && vscodeApi) {
                requested = true;
                vscodeApi.postMessage({ kind: "command", name: "${IPC_COMMANDS.REFRESH_WEBVIEW}" });
              }
              return;
            }
          }
        } catch {}
        setTimeout(poll, 600);
      };
      poll();
    </script>
  </body>
</html>`;
    return this.buildWebviewHtml(webview, html, devUrl);
  }

  private async fetchDevHtml(devUrl: string): Promise<string | undefined> {
    if (typeof fetch !== "function") {
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);
    try {
      const response = await fetch(devUrl, { signal: controller.signal });
      if (!response.ok) {
        return undefined;
      }
      const text = await response.text();
      if (
        !this.isAtlassianDevHtml(text) ||
        (!text.includes("@vite/client") &&
          !text.includes(AbstractViewProvider.VSCODE_WEBVIEW_HMR_MARK))
      ) {
        return undefined;
      }
      return text;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getFallbackHtml(webview: Webview, message: string) {
    const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline';`;
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Atlassian Webview</title>
    <style>
      body { font-family: sans-serif; padding: 24px; color: #1f2328; }
      .card { border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; background: #f6f8fa; }
      code { background: #f0f0f0; padding: 2px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Webview UI unavailable</h2>
      <p>${escaped}</p>
      <p>Run <code>bun run dev:webview</code> for HMR or <code>bun run compile:webview</code> for a build.</p>
    </div>
  </body>
</html>`;
  }

  private injectInitialRoute(html: string): string {
    if (!this.initialRoute) {
      return html;
    }
    const normalizedPath = routeHintToPath(this.initialRoute);
    const targetHash = buildRouteHash(normalizedPath, this.initialRoute.query);
    const routePayload = JSON.stringify(this.initialRoute);
    const script = `<script>(function(){try{window.__atlassianRoute=${routePayload};if(!location.hash||location.hash===\"#/\"){location.hash=${JSON.stringify(
      targetHash,
    )};}}catch(e){}})();</script>`;
    this.initialRoute = undefined;
    return html.replace(/<head>/i, `<head>${script}`);
  }
}
