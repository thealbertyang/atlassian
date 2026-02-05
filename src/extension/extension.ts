import * as vscode from "vscode";
import { AtlassianClient } from "./providers/data/atlassian/atlassianClient";
import { AtlassianIssuesProvider } from "./providers/data/atlassian/issueProvider";
import { getHandlers } from "./handlers";
import { log, outputChannel } from "./providers/data/atlassian/logger";
import { WebviewDevServer } from "./service/webview-dev-server";
import { ExtensionBuildWatcher } from "./service/extension-build-watcher";
import { ExtensionInstaller } from "./service/extension-installer";
import { AtlassianUriHandler } from "./service/uri-handler";
import type { WebviewRoute } from "./service/webview-route";
import { WebviewRenderTracker } from "./service/webview-render-tracker";
import { ViewProviderPanel } from "./providers/view/view-provider-panel";
import { DEFAULT_WEBVIEW_DEV_PORT, REOPEN_APP_AFTER_RESTART_KEY } from "./constants";
import { resolveWebviewRoot } from "./webview/paths";
import { StorageService } from "./service/storage-service";

export function activate(context: vscode.ExtensionContext): void {
  outputChannel.show(true);
  log("Atlassian Sprint extension activating...");
  log(`Extension path: ${context.extensionPath}`);

  const storage = new StorageService(context, "atlassian");
  const client = new AtlassianClient(context, storage);
  const provider = new AtlassianIssuesProvider(client);
  const devWebviewServer = new WebviewDevServer();
  const buildWatcher = new ExtensionBuildWatcher();
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
    devWebviewServer,
    extensionInstaller,
    buildWatcher,
    renderTracker,
    showApp: showAppPanel,
    refreshApp: refreshAppPanel,
    closeApp: closeAppPanel,
  });

  viewProvider = new ViewProviderPanel(context, handlers, renderTracker);
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

  registerTreeProvider(context, provider);

  if (context.extensionMode === vscode.ExtensionMode.Development) {
    buildWatcher.start(context.extensionPath);
    const cwd = resolveWebviewRoot(context.extensionPath);
    if (cwd) {
      devWebviewServer.start(cwd, DEFAULT_WEBVIEW_DEV_PORT);
    } else {
      log("Webview dev server not started: src/webview not found.");
    }
  }

  const reopenAfterRestart = storage.getGlobalState<boolean>(REOPEN_APP_AFTER_RESTART_KEY);
  if (reopenAfterRestart) {
    void storage.setGlobalState(REOPEN_APP_AFTER_RESTART_KEY, false);
    void showAppPanel();
  }

  context.subscriptions.push(
    devWebviewServer,
    buildWatcher,
    extensionInstaller,
    vscode.commands.registerCommand("atlassian.refresh", () => {
      log("Refresh command triggered");
      provider.refresh();
    }),
    vscode.commands.registerCommand("atlassian.openApp", async (route?: string) => {
      log("Open App command triggered");
      await showAppPanel();
      if (route) {
        navigateToRoute({ name: route });
      }
    }),
    vscode.commands.registerCommand("atlassian.login", async () => {
      log("Login command triggered");
      await showAppPanel();
    }),
    vscode.commands.registerCommand("atlassian.logout", async () => {
      await client.clearAuth();
      provider.refresh();
      vscode.window.showInformationMessage("Atlassian credentials cleared.");
    }),
    vscode.commands.registerCommand("atlassian.runDevWebview", async () => {
      await handlers.runDevWebview();
    }),
    vscode.commands.registerCommand("atlassian.restartExtensionHost", async () => {
      closeAppPanel();
      await storage.setGlobalState(REOPEN_APP_AFTER_RESTART_KEY, true);
      await vscode.commands.executeCommand("workbench.action.restartExtensionHost");
    }),
    vscode.commands.registerCommand("atlassian.reloadWebviews", async () => {
      await handlers.reloadWebviews();
    }),
    vscode.commands.registerCommand("atlassian.syncEnvToSettings", async () => {
      await handlers.syncEnvToSettings();
    }),
    vscode.commands.registerCommand("atlassian.reinstallExtension", async () => {
      await handlers.reinstallExtension();
    }),
    vscode.commands.registerCommand("atlassian.openIssue", async (issue) => {
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
