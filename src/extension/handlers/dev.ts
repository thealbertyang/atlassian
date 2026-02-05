import { commands, window } from "vscode";
import { DEFAULT_WEBVIEW_DEV_PORT, REOPEN_APP_AFTER_RESTART_KEY } from "../constants";
import { toPromise } from "../util/to-promise";
import { resolveWebviewRoot } from "../webview/paths";
import { waitForDevServer } from "../webview/reachability";
import type { HandlerDependencies } from "./types";

type DevDependencies = Pick<
  HandlerDependencies,
  "context" |
    "storage" |
    "devWebviewServer" |
    "extensionInstaller" |
    "showApp" |
    "refreshApp" |
    "closeApp"
>;

export const createDevHandlers = ({
  context,
  storage,
  devWebviewServer,
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

    const port = DEFAULT_WEBVIEW_DEV_PORT;
    devWebviewServer.start(cwd, port);

    const activeUrl = `http://localhost:${port}`;
    const ready = await waitForDevServer(activeUrl, 10, 350);
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
