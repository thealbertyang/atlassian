import * as vscode from "vscode";
import { AtlassianClient } from "./providers/data/atlassian/atlassianClient";
import { AtlassianIssuesProvider } from "./providers/data/atlassian/issueProvider";
import { getHandlers } from "./handlers";
import { log, outputChannel } from "./providers/data/atlassian/logger";
import { WebviewServer } from "./service/webview-dev-server";
import { WebviewWsBridge } from "./service/webview-ws-bridge";
import { ExtensionBuildWatcher } from "./service/extension-build-watcher";
import { ExtensionInstaller } from "./service/extension-installer";
import { AtlassianUriHandler } from "./service/uri-handler";
import type { WebviewRoute } from "./service/webview-route";
import { WebviewRenderTracker } from "./service/webview-render-tracker";
import { ViewProviderPanel } from "./providers/view/view-provider-panel";
import {
  DEFAULT_WEBVIEW_PORT,
  DEFAULT_WS_BRIDGE_HOST,
  DEFAULT_WS_BRIDGE_PORT,
  REOPEN_APP_AFTER_RESTART_KEY,
} from "./constants";
import { resolveWebviewRoot } from "./webview/paths";
import { StorageService } from "./service/storage-service";
import { scaffoldAgentsDir } from "./service/agents-scaffold";
import { getOrCreateWsBridgeToken } from "./service/ws-bridge-auth";
import { getWebviewServerUrl } from "./providers/data/atlassian/atlassianConfig";
import { AppGlobalStateService } from "./service/app-global-state-service";
import {
  VSCODE_COMMANDS,
  IPC_COMMANDS,
  formatLogPayload,
  getActionByVscodeCommand,
} from "../shared/contracts";
import {
  getServerPort,
  isLocalhostUrl,
  normalizeServerUrl,
  waitForServer,
} from "./webview/reachability";

export function activate(context: vscode.ExtensionContext): void {
  outputChannel.show(true);
  log("Atlassian Sprint extension activating...");
  log(`Extension path: ${context.extensionPath}`);

  scaffoldAgentsDir(context);

  const storage = new StorageService(context, "atlassian");
  const client = new AtlassianClient(context, storage);
  const provider = new AtlassianIssuesProvider(client);
  const webviewServer = new WebviewServer();
  const buildWatcher = new ExtensionBuildWatcher();
  buildWatcher.seedFromDisk(context.extensionPath);
  const extensionInstaller = new ExtensionInstaller();
  const renderTracker = new WebviewRenderTracker();

  let panel: vscode.WebviewPanel | undefined;
  let viewProvider: ViewProviderPanel;
  const attachedPanels = new WeakSet<vscode.WebviewPanel>();
  const navigateToRoute = (route: WebviewRoute) => {
    viewProvider?.requestNavigate(route);
  };

  const attachPanel = async (webviewPanel: vscode.WebviewPanel) => {
    panel = webviewPanel;
    panel.onDidDispose(() => {
      panel = undefined;
    });

    if (attachedPanels.has(webviewPanel)) {
      await viewProvider.updateWebview(webviewPanel);
      return;
    }

    attachedPanels.add(webviewPanel);
    await viewProvider.resolveWebviewView(webviewPanel);
  };

  const showAppPanel = async () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Active, true);
      await viewProvider.updateWebview(panel);
      return;
    }

    panel = vscode.window.createWebviewPanel(
      ViewProviderPanel.viewType,
      ViewProviderPanel.title,
      vscode.ViewColumn.Active,
      { retainContextWhenHidden: true },
    );

    await attachPanel(panel);
  };

  const closeAppPanel = () => {
    if (panel) {
      panel.dispose();
      panel = undefined;
    }
  };

  const refreshAppPanel = async () => {
    if (!panel) {
      return;
    }
    await viewProvider.updateWebview(panel);
  };

  const handlers = getHandlers({
    context,
    storage,
    client,
    provider,
    webviewServer,
    extensionInstaller,
    buildWatcher,
    renderTracker,
    showApp: showAppPanel,
    refreshApp: refreshAppPanel,
    closeApp: closeAppPanel,
  });

  const appGlobalState = new AppGlobalStateService(context, {
    getUniversalConfig: handlers.getUniversalConfig,
    getFullConfig: handlers.getFullConfig as any,
    getState: handlers.getState,
  });
  appGlobalState.start();

  let wsBridge: WebviewWsBridge | null = null;

  viewProvider = new ViewProviderPanel(context, handlers, renderTracker);
  context.subscriptions.push(
    buildWatcher.onDidBuild((timestamp) => {
      viewProvider?.sendCommand(IPC_COMMANDS.STATE_UPDATED, {
        dev: { lastExtensionBuildAt: timestamp },
      });
    }),
  );
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(ViewProviderPanel.viewType, {
      async deserializeWebviewPanel(webviewPanel) {
        await attachPanel(webviewPanel);
      },
    }),
  );

  context.subscriptions.push(
    vscode.window.registerUriHandler(
      new AtlassianUriHandler({
        showApp: showAppPanel,
        navigate: navigateToRoute,
      }),
    ),
  );

  context.subscriptions.push(appGlobalState);

  registerTreeProvider(context, provider);

  const configuredUrl = normalizeServerUrl(getWebviewServerUrl());
  const cwd = resolveWebviewRoot(context.extensionPath);

  if (context.extensionMode === vscode.ExtensionMode.Development && cwd) {
    buildWatcher.start(cwd);
  }
  const devUrl = configuredUrl || `http://localhost:${DEFAULT_WEBVIEW_PORT}/`;
  const isLocalDevUrl = isLocalhostUrl(devUrl);
  const devPort = getServerPort(devUrl) || DEFAULT_WEBVIEW_PORT;
  const wsBridgeToken = isLocalDevUrl ? getOrCreateWsBridgeToken(storage) : "";
  const wsBridgeHost =
    (process.env.ATLASSIAN_WS_BRIDGE_HOST ?? DEFAULT_WS_BRIDGE_HOST).trim() || DEFAULT_WS_BRIDGE_HOST;
  const wsBridgePort = (() => {
    const raw = (process.env.ATLASSIAN_WS_BRIDGE_PORT ?? "").trim();
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
      return parsed;
    }
    return DEFAULT_WS_BRIDGE_PORT;
  })();

  // Start Vite dev server (needs source files on disk)
  if (cwd && (!configuredUrl || isLocalhostUrl(devUrl))) {
    const extraEnv: Record<string, string> = {};
    if (isLocalDevUrl && wsBridgeToken) {
      extraEnv.VITE_ATLASSIAN_WS_BRIDGE_TOKEN = wsBridgeToken;
      // Pass the bridge URL into the browser dev server so clients can connect without manual config.
      const urlHost = wsBridgeHost === "0.0.0.0" || wsBridgeHost === "::" ? "127.0.0.1" : wsBridgeHost;
      extraEnv.VITE_ATLASSIAN_WS_BRIDGE_URL = `ws://${urlHost}:${wsBridgePort}`;
    }
    webviewServer.start(cwd, devPort, extraEnv);
  }

  // Start WS bridge for Chrome dev view (needs only RPC handlers, not source files)
  if (isLocalDevUrl) {
    const token = wsBridgeToken;
    const wsBridgeOrigins = (process.env.ATLASSIAN_WS_BRIDGE_ORIGINS ?? "").trim();
    const defaultOrigins = [`http://localhost:${devPort}`, `http://127.0.0.1:${devPort}`];
    const allowedOrigins = wsBridgeOrigins
      ? wsBridgeOrigins.split(",").map((o) => o.trim()).filter(Boolean)
      : defaultOrigins;

    log(`[ws-bridge] auth enabled: token=${token} (manual: http://localhost:${devPort}/?wsToken=...)`);

    wsBridge = new WebviewWsBridge(handlers, {
      host: wsBridgeHost,
      port: wsBridgePort,
      token,
      allowedOrigins,
    });
    try {
      wsBridge.start();
    } catch (err) {
      log(`[ws-bridge] failed to start: ${err instanceof Error ? err.message : err}`);
    }
    context.subscriptions.push(wsBridge);
    viewProvider?.setIpcBroadcast(wsBridge);
    void waitForServer(devUrl, 20, 500).then((ready) => {
      if (ready) {
        log("Webview server ready, refreshing panel.");
        void refreshAppPanel();
      }
    });
  } else if (configuredUrl) {
    log(`Webview server not started (using ${configuredUrl}).`);
  }

  const reopenAfterRestart = storage.getGlobalState<boolean>(REOPEN_APP_AFTER_RESTART_KEY);
  if (reopenAfterRestart) {
    void storage.setGlobalState(REOPEN_APP_AFTER_RESTART_KEY, false);
    void showAppPanel();
  }

  context.subscriptions.push(
    webviewServer,
    buildWatcher,
    extensionInstaller,
    registerLoggedCommand(VSCODE_COMMANDS.REFRESH, () => {
      provider.refresh();
    }),
    registerLoggedCommand(VSCODE_COMMANDS.OPEN_APP, async (route?: string) => {
      await showAppPanel();
      if (route) {
        navigateToRoute({ name: route });
      }
    }),
    registerLoggedCommand(VSCODE_COMMANDS.LOGIN, async () => {
      await showAppPanel();
      navigateToRoute({ name: "setup" });
    }),
    registerLoggedCommand(VSCODE_COMMANDS.LOGOUT, async () => {
      await client.clearAuth();
      provider.refresh();
      vscode.window.showInformationMessage("Atlassian credentials cleared.");
    }),
    registerLoggedCommand(VSCODE_COMMANDS.RUN_DEV_WEBVIEW, async () => {
      await handlers.runDevWebview();
    }),
    registerLoggedCommand(VSCODE_COMMANDS.RESTART_EXTENSION_HOST, async () => {
      closeAppPanel();
      await storage.setGlobalState(REOPEN_APP_AFTER_RESTART_KEY, true);
      await vscode.commands.executeCommand("workbench.action.restartExtensionHost");
    }),
    registerLoggedCommand(VSCODE_COMMANDS.RELOAD_WEBVIEWS, async () => {
      await handlers.reloadWebviews();
    }),
    registerLoggedCommand(VSCODE_COMMANDS.SYNC_ENV_TO_SETTINGS, async () => {
      await handlers.syncEnvToSettings();
    }),
    registerLoggedCommand(VSCODE_COMMANDS.REINSTALL_EXTENSION, async () => {
      await handlers.reinstallExtension();
    }),
    registerLoggedCommand(VSCODE_COMMANDS.OPEN_ISSUE, async (issue) => {
      const key = issue?.key || issue?.issue?.key;
      if (!key) {
        return;
      }
      await showAppPanel();
      navigateToRoute({ path: `/jira/issues/${key}`, issueKey: key });
    }),
  );
}

export function deactivate(): void {
  // no-op (handled by context subscriptions)
}

function registerLoggedCommand<T extends (...args: any[]) => any>(
  commandId: string,
  handler: T,
): vscode.Disposable {
  return vscode.commands.registerCommand(commandId, async (...args: Parameters<T>) => {
    const action = getActionByVscodeCommand(commandId);
    const payload = formatLogPayload(args);
    log(`[cmd] id=${commandId} action=${action.id} payload=${payload}`);
    return handler(...args);
  });
}

function registerTreeProvider(
  context: vscode.ExtensionContext,
  provider: AtlassianIssuesProvider,
  attempt = 0,
): void {
  try {
    context.subscriptions.push(vscode.window.registerTreeDataProvider("atlassianIssues", provider));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to register view (attempt ${attempt + 1}): ${message}`);
    if (attempt < 3) {
      setTimeout(() => registerTreeProvider(context, provider, attempt + 1), 500);
    }
  }
}
