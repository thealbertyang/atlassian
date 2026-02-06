import { commands, window } from "vscode";
import { DEFAULT_WEBVIEW_PORT, REOPEN_APP_AFTER_RESTART_KEY } from "../constants";
import { getWebviewServerUrl } from "../providers/data/atlassian/atlassianConfig";
import { toPromise } from "../util/to-promise";
import { resolveWebviewRoot } from "../webview/paths";
import {
  getServerPort,
  isLocalhostUrl,
  normalizeServerUrl,
  waitForServer,
} from "../webview/reachability";
import type { HandlerDependencies } from "./types";

type DevDependencies = Pick<
  HandlerDependencies,
  "context" |
    "storage" |
    "webviewServer" |
    "extensionInstaller" |
    "showApp" |
    "refreshApp" |
    "closeApp"
>;

export const createDevHandlers = ({
  context,
  storage,
  webviewServer,
  extensionInstaller,
  showApp,
  refreshApp,
  closeApp,
}: DevDependencies) => ({
  execCommand: (command: string, ...rest: unknown[]) => {
    const then = commands.executeCommand(command, ...rest);
    return toPromise(then);
  },

  reinstallExtension: async () => {
    const repoRoot = resolveWebviewRoot(context.extensionPath);
    if (!repoRoot) {
      window.showWarningMessage(
        "Open the Atlassian extension workspace to reinstall the extension.",
      );
      return;
    }
    extensionInstaller.start(repoRoot);
  },

  runDevWebview: async () => {
    await showApp();
    const cwd = resolveWebviewRoot(context.extensionPath);
    if (!cwd) {
      window.showWarningMessage(
        "No src/webview found. Open the repo workspace to run the dev server.",
      );
      return;
    }

    const configuredUrl = normalizeServerUrl(getWebviewServerUrl());
    const devUrl = configuredUrl || `http://localhost:${DEFAULT_WEBVIEW_PORT}/`;
    if (configuredUrl && !isLocalhostUrl(devUrl)) {
      window.showWarningMessage(
        `Webview dev server URL is set to ${configuredUrl}. Start it manually.`,
      );
      return;
    }

    const port = getServerPort(devUrl) || DEFAULT_WEBVIEW_PORT;
    webviewServer.start(cwd, port);

    const ready = await waitForServer(devUrl, 10, 350);
    if (ready) {
      await refreshApp();
    } else {
      window.showWarningMessage("Webview dev server did not respond. Check the output.");
    }
  },

  restartExtensionHost: async () => {
    closeApp();
    await storage.setGlobalState(REOPEN_APP_AFTER_RESTART_KEY, true);
    await commands.executeCommand("workbench.action.restartExtensionHost");
  },

  reloadWebviews: async () => {
    try {
      await commands.executeCommand("workbench.action.webview.reloadWebviews");
    } catch {
      // ignore and fall back to manual refresh
    }
    await refreshApp();
  },
});
