import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import * as vscode from "vscode";

const BUILD_COMMAND = "bun run build:ext";
const WATCH_COMMAND = "bun run dev:ext";
const OUTPUT_CHANNEL_NAME = "Atlassian Build";
const FORCE_KILL_TIMEOUT_MS = 2000;

export class ExtensionBuildWatcher implements vscode.Disposable {
  private process?: ChildProcessWithoutNullStreams;
  private buildProcess?: ChildProcessWithoutNullStreams;
  private output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  private lastCwd = "";
  private lastBuildAt: number | null = null;

  start(cwd: string): void {
    if (this.isRunning()) {
      if (this.lastCwd === cwd) {
        this.output.appendLine(`[build] already running (cwd=${cwd})`);
        return;
      }
      this.stop("restart");
    }

    this.lastCwd = cwd;
    this.output.appendLine(`[build] starting: ${BUILD_COMMAND} (cwd=${cwd})`);
    const build = spawnCommand(cwd, BUILD_COMMAND);
    this.buildProcess = build;

    build.stdout.on("data", (data) => this.output.append(data.toString()));
    build.stderr.on("data", (data) => this.output.append(data.toString()));
    build.on("exit", (code, signal) => {
      this.output.appendLine(
        `[build] initial compile exited${code !== null ? ` (code=${code})` : ""}${
          signal ? ` (signal=${signal})` : ""
        }`,
      );
      if (code === 0) {
        this.lastBuildAt = Date.now();
      }
      this.buildProcess = undefined;
      this.startWatch(cwd);
    });
    build.on("error", (error) => {
      this.output.appendLine(`[build] error: ${error.message}`);
      this.buildProcess = undefined;
      this.startWatch(cwd);
    });
  }

  getLastBuildAt(): number | null {
    return this.lastBuildAt;
  }

  stop(reason = "stop"): void {
    if (this.buildProcess) {
      const buildProc = this.buildProcess;
      this.buildProcess = undefined;
      buildProc.kill("SIGTERM");
    }
    if (!this.process) {
      return;
    }
    const proc = this.process;
    this.process = undefined;

    this.output.appendLine(`[build] stopping (${reason})`);
    proc.kill("SIGTERM");

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, FORCE_KILL_TIMEOUT_MS);

    proc.once("exit", () => clearTimeout(timer));
  }

  isRunning(): boolean {
    return Boolean(
      (this.process && !this.process.killed) || (this.buildProcess && !this.buildProcess.killed),
    );
  }

  dispose(): void {
    this.stop("dispose");
    this.output.dispose();
  }

  private startWatch(cwd: string) {
    this.output.appendLine(`[build] starting: ${WATCH_COMMAND} (cwd=${cwd})`);
    const child = spawnCommand(cwd, WATCH_COMMAND);
    child.stdout.on("data", (data) => {
      const text = data.toString();
      this.output.append(text);
      if (/\bBundled\b/i.test(text) || /\bbuild finished\b/i.test(text)) {
        this.lastBuildAt = Date.now();
      }
    });
    child.stderr.on("data", (data) => this.output.append(data.toString()));
    child.on("exit", (code, signal) => {
      this.output.appendLine(
        `[build] watch exited${code !== null ? ` (code=${code})` : ""}${
          signal ? ` (signal=${signal})` : ""
        }`,
      );
      this.process = undefined;
    });
    child.on("error", (error) => {
      this.output.appendLine(`[build] watch error: ${error.message}`);
      this.process = undefined;
    });
    this.process = child;
  }
}

function spawnCommand(cwd: string, command: string): ChildProcessWithoutNullStreams {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", command], {
      cwd,
      stdio: "pipe",
      windowsHide: true,
    });
  }

  const shell = process.env.SHELL || "/bin/bash";
  return spawn(shell, ["-lc", command], {
    cwd,
    stdio: "pipe",
  });
}
