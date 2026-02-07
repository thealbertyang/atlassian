import path from "path";
import { readFileSync, readdirSync, existsSync } from "fs";
import { workspace, Uri, ExtensionMode, env as vscodeEnv } from "vscode";
import { DEFAULT_WS_BRIDGE_HOST, DEFAULT_WS_BRIDGE_PORT, WS_BRIDGE_TOKEN_KEY } from "../constants";
import {
  getApiTokenConfig,
  getApiTokenConfigSource,
} from "../providers/data/atlassian/atlassianConfig";
import { SETTINGS_KEYS, SETTINGS_SECTION } from "../../shared/contracts";
import type { HandlerDependencies } from "./types";

type ConfigDependencies = Pick<
  HandlerDependencies,
  "context" | "storage" | "client" | "buildWatcher" | "renderTracker"
>;

export type FullConfig = {
  app: {
    id: string;
    name: string;
    version: string;
    namespace: string;
    extensionPath: string;
  };
  connection: {
    baseUrl: string;
    email: string;
    apiTokenConfigured: boolean;
    configSource: string;
    authType: string;
    hasStoredToken: boolean;
  };
  settings: Record<string, unknown>;
  dev: {
    devMode: boolean;
    extensionId: string;
    uriScheme: string;
    lastExtensionBuildAt: number | null;
    lastWebviewRenderAt: number | null;
    wsBridgeHost: string;
    wsBridgePort: number;
    wsBridgeToken?: string;
  };
  env: Record<string, string>;
  agents: {
    configDir: string;
    plansDir: string;
    plansCount: number;
    hasAppConfig: boolean;
  };
  ipc: {
    commands: string[];
    events: string[];
  };
  universal: {
    stages: Record<string, { order: number; label: string; aiRole: string; humanGate: string }>;
    automationModes: Record<string, { description: string; risk: string }>;
    platforms: Record<string, string>;
  };
  docs: {
    matrices: string[];
    runbooks: string[];
  };
  workflows: {
    cadence: Record<string, { view: string; focus: string }>;
  };
};

const listFiles = (dir: string, ext: string): string[] => {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.endsWith(ext));
  } catch {
    return [];
  }
};

export const createConfigHandlers = ({
  context,
  storage,
  client,
  buildWatcher,
  renderTracker,
}: ConfigDependencies) => ({
  getFullConfig: async (): Promise<FullConfig> => {
    const defaults = await client.getApiTokenDefaults();
    const envApiConfig = getApiTokenConfig();
    const hasStoredToken = await client.hasStoredApiToken();
    const hasEnvToken = Boolean(envApiConfig.baseUrl && envApiConfig.email && envApiConfig.apiToken);
    const hasStoredConfig = Boolean(defaults.baseUrl && defaults.email && hasStoredToken);
    const isConfigured = hasEnvToken || hasStoredConfig;
    const configSource = isConfigured ? getApiTokenConfigSource() : "none";

    const config = workspace.getConfiguration(SETTINGS_SECTION);

    const settingsObj: Record<string, unknown> = {};
    for (const key of Object.values(SETTINGS_KEYS)) {
      const value = config.get(key);
      // Mask sensitive values
      if (key === "apiToken" && value) {
        settingsObj[key] = "********";
      } else {
        settingsObj[key] = value ?? "";
      }
    }

    // Read env vars relevant to the extension
    const envVars: Record<string, string> = {};
    const envKeys = [
      "JIRA_URL", "JIRA_USER_EMAIL", "JIRA_API_TOKEN", "JIRA_JQL",
      "ATLASSIAN_BASE_URL", "ATLASSIAN_EMAIL", "ATLASSIAN_API_TOKEN",
      "ATLASSIAN_WEBVIEW_SERVER_URL", "ATLASSIAN_WEBVIEW_PATH",
      "ATLASSIAN_DOCS_PATH", "ATLASSIAN_WEBVIEW_PORT",
      "ATLASSIAN_WS_BRIDGE_TOKEN", "ATLASSIAN_WS_BRIDGE_ORIGINS",
    ];
    for (const key of envKeys) {
      const value = process.env[key];
      if (value) {
        // Mask tokens
        if (key.includes("TOKEN") || key.includes("SECRET")) {
          envVars[key] = "********";
        } else {
          envVars[key] = value;
        }
      }
    }

    // Check _agents directory
    const workspaceFolder =
      workspace.getWorkspaceFolder(Uri.file(context.extensionPath)) ??
      workspace.workspaceFolders?.[0];
    const wsRoot = workspaceFolder?.uri.fsPath ?? context.extensionPath;
    const agentsDir = path.join(wsRoot, "_agents");
    const plansDir = path.join(agentsDir, "plans");
    const docsDir = existsSync(path.join(agentsDir, "docs"))
      ? path.join(agentsDir, "docs")
      : path.join(wsRoot, "docs");
    const runbooksDir = existsSync(path.join(agentsDir, "runbooks"))
      ? path.join(agentsDir, "runbooks")
      : path.join(wsRoot, "docs", "runbooks");
    let plansCount = 0;
    try {
      if (existsSync(plansDir)) {
        plansCount = readdirSync(plansDir).filter((f: string) => f.endsWith(".md")).length;
      }
    } catch { /* ignore */ }

    const pkg = JSON.parse(
      readFileSync(path.join(context.extensionPath, "package.json"), "utf8"),
    );

    const wsBridgeToken =
      (process.env.ATLASSIAN_WS_BRIDGE_TOKEN ?? "").trim() ||
      (storage.getGlobalState<string>(WS_BRIDGE_TOKEN_KEY) ?? "").trim() ||
      undefined;

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

    return {
      app: {
        id: pkg.name || "atlassian-sprint-view",
        name: pkg.displayName || "Atlassian Sprint",
        version: pkg.version || "0.0.0",
        namespace: SETTINGS_SECTION,
        extensionPath: context.extensionPath,
      },
      connection: {
        baseUrl: envApiConfig.baseUrl || defaults.baseUrl,
        email: envApiConfig.email || defaults.email,
        apiTokenConfigured: isConfigured,
        configSource,
        authType: isConfigured ? "apiToken" : "none",
        hasStoredToken,
      },
      settings: settingsObj,
      dev: {
        devMode: context.extensionMode === ExtensionMode.Development,
        extensionId: context.extension.id,
        uriScheme: vscodeEnv.uriScheme,
        lastExtensionBuildAt: buildWatcher.getLastBuildAt(),
        lastWebviewRenderAt: renderTracker.getLastRenderedAt(),
        wsBridgeHost,
        wsBridgePort,
        wsBridgeToken,
      },
      env: envVars,
      agents: {
        configDir: "_agents",
        plansDir: "_agents/plans",
        plansCount,
        hasAppConfig: existsSync(path.join(agentsDir, "app.config.toml")),
      },
      ipc: {
        commands: ["atlassian.route.navigate", "atlassian.webview.refresh"],
        events: [
          "atlassian.webview.ready",
          "atlassian.route.changed",
          "atlassian.ui.action",
          "atlassian.ui.event",
        ],
      },
      universal: {
        stages: {
          plan: { order: 1, label: "Plan", aiRole: "Summarize + rank tasks", humanGate: "Confirm selection" },
          execute: { order: 2, label: "Execute", aiRole: "Draft code/tests", humanGate: "Review + edit" },
          review: { order: 3, label: "Review", aiRole: "Risk scan + checklist", humanGate: "Approve or request changes" },
          ship: { order: 4, label: "Ship", aiRole: "Release summary + notes", humanGate: "Approve publish" },
          observe: { order: 5, label: "Observe", aiRole: "Signal triage + summaries", humanGate: "Confirm action" },
        },
        automationModes: {
          assist: { description: "Drafts and suggestions only", risk: "low" },
          guided: { description: "Executes after explicit confirmation", risk: "medium" },
          auto: { description: "Executes without confirmation", risk: "high" },
        },
        platforms: {
          vscode: "VS Code webview panel",
          web: "Browser at localhost:5173 via WS bridge",
          cli: "CLI via codex/claude-code",
        },
      },
      docs: {
        matrices: listFiles(docsDir, ".md"),
        runbooks: listFiles(runbooksDir, ".md"),
      },
      workflows: {
        cadence: {
          daily: { view: "/plan", focus: "Today's tasks, blockers" },
          weekly: { view: "/plan/weekly", focus: "Sprint progress, upcoming work" },
          monthly: { view: "/plan/monthly", focus: "Milestone tracking, velocity" },
          quarterly: { view: "/plan/quarterly", focus: "OKR alignment, roadmap" },
          career: { view: "/plan/career", focus: "Growth goals, skill development" },
        },
      },
    };
  },
});
