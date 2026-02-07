import { spawn } from "child_process";
import {
  commands,
  CustomExecution,
  EventEmitter,
  Task,
  TaskPanelKind,
  TaskRevealKind,
  TaskScope,
  tasks,
  workspace,
  window,
  type Pseudoterminal,
} from "vscode";
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
import { getOrCreateWsBridgeToken } from "../service/ws-bridge-auth";
import type { HandlerDependencies } from "./types";
import type { ExtensionBuildWatcher } from "../service/extension-build-watcher";

type DevDependencies = Pick<
  HandlerDependencies,
  "context" |
    "storage" |
    "webviewServer" |
    "extensionInstaller" |
    "buildWatcher" |
    "showApp" |
    "refreshApp" |
    "closeApp"
>;

export const createDevHandlers = ({
  context,
  storage,
  webviewServer,
  extensionInstaller,
  buildWatcher,
  showApp,
  refreshApp,
  closeApp,
}: DevDependencies) => {
  let taskCounter = 0;

  const createTaskPseudoterminal = (name: string): Pseudoterminal => {
    const writeEmitter = new EventEmitter<string>();
    const closeEmitter = new EventEmitter<void>();
    let closed = false;
    const finish = () => {
      if (closed) {
        return;
      }
      closed = true;
      closeEmitter.fire();
    };
    return {
      onDidWrite: writeEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {
        writeEmitter.fire(
          `Atlassian Dev Task Terminal\r\nName: ${name}\r\nClose the terminal or press Enter to end.\r\n`,
        );
      },
      handleInput: (data: string) => {
        if (data.includes("\r")) {
          finish();
        }
      },
      close: () => {
        finish();
      },
    };
  };

  const nextTaskName = () => {
    taskCounter += 1;
    const stamp = new Date().toISOString().slice(11, 19);
    return `Dev Task Terminal #${taskCounter} (${stamp})`;
  };

  return {
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
      const wsBridgeToken = getOrCreateWsBridgeToken(storage);
      webviewServer.start(cwd, port, {
        VITE_ATLASSIAN_WS_BRIDGE_TOKEN: wsBridgeToken,
      });

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

    startDevTaskTerminal: async () => {
      const name = nextTaskName();
      const execution = new CustomExecution(async () => createTaskPseudoterminal(name));
      const scope =
        workspace.workspaceFolders && workspace.workspaceFolders.length > 0
          ? TaskScope.Workspace
          : TaskScope.Global;
      const task = new Task(
        { type: "atlassianDev", task: "devTaskTerminal", id: taskCounter },
        scope,
        name,
        "Atlassian Dev",
        execution,
        [],
      );
      task.presentationOptions = {
        reveal: TaskRevealKind.Always,
        panel: TaskPanelKind.New,
        clear: true,
        focus: false,
        showReuseMessage: false,
      };
      try {
        await tasks.executeTask(task);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.showWarningMessage(`Failed to start task terminal: ${message}`);
      }
    },

    buildExtension: () => {
      const cwd = resolveWebviewRoot(context.extensionPath) || context.extensionPath;
      return runBuild("build:ext", cwd, buildWatcher);
    },

    buildWebview: () => {
      const cwd = resolveWebviewRoot(context.extensionPath) || context.extensionPath;
      return runBuild("build:webview", cwd, buildWatcher);
    },
  };
};

const buildOutput = window.createOutputChannel("Atlassian Build");

function runBuild(script: string, cwd: string, buildWatcher?: ExtensionBuildWatcher): Promise<void> {
  return new Promise((resolve) => {
    const cmd = `bun run ${script}`;
    buildOutput.appendLine(`[build] running: ${cmd} (cwd=${cwd})`);
    buildOutput.show(true);

    const shell = process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", cmd], { cwd, stdio: "pipe", windowsHide: true })
      : spawn(process.env.SHELL || "/bin/bash", ["-lc", cmd], { cwd, stdio: "pipe" });

    shell.stdout.on("data", (data: Buffer) => buildOutput.append(data.toString()));
    shell.stderr.on("data", (data: Buffer) => buildOutput.append(data.toString()));
    shell.on("exit", (code) => {
      buildOutput.appendLine(`[build] ${script} exited (code=${code})`);
      if (code === 0) {
        buildWatcher?.markBuild();
        window.showInformationMessage(`Build ${script} complete.`);
      } else {
        window.showWarningMessage(`Build ${script} failed (code=${code}). Check output.`);
      }
      resolve();
    });
    shell.on("error", (error: Error) => {
      buildOutput.appendLine(`[build] error: ${error.message}`);
      window.showWarningMessage(`Build ${script} failed: ${error.message}`);
      resolve();
    });
  });
}
