import fs from "fs";
import path from "path";
import { workspace } from "vscode";
import type { HandlerDependencies } from "./types";
import type {
  Automation,
  AutomationRun,
  AutomationsIndex,
  AutomationSource,
} from "../../shared/automations-contract";

type AutomationsDependencies = Pick<HandlerDependencies, "context">;

const CODEX_HOME = path.join(process.env.HOME ?? "", ".codex");
const AUTOMATIONS_DIR = "automations";
const AUTOMATION_TOML = "automation.toml";
const MEMORY_FILE = "memory.md";
const SQLITE_DB = path.join(CODEX_HOME, "sqlite", "codex-dev.db");

type TomlAutomation = {
  version?: number;
  id: string;
  name: string;
  prompt: string;
  status?: string;
  rrule?: string;
  cwds?: string[];
  created_at?: number;
  updated_at?: number;
};

const parseSimpleToml = (content: string): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value: unknown = rawValue;

    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      value = rawValue.slice(1, -1);
    } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      try {
        value = JSON.parse(rawValue.replace(/'/g, '"'));
      } catch {
        value = [];
      }
    } else if (rawValue === "true") {
      value = true;
    } else if (rawValue === "false") {
      value = false;
    } else if (/^\d+$/.test(rawValue)) {
      value = parseInt(rawValue, 10);
    }

    result[key] = value;
  }

  return result;
};

const rruleToHuman = (rrule: string): string => {
  if (!rrule) return "Not scheduled";

  const parts: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const [key, val] = part.split("=");
    if (key && val) parts[key] = val;
  });

  const freq = parts.FREQ;
  const interval = parseInt(parts.INTERVAL ?? "1", 10);
  const byDay = parts.BYDAY;
  const byHour = parts.BYHOUR;
  const byMinute = parts.BYMINUTE;

  if (freq === "HOURLY") {
    if (interval === 1) return "Every hour";
    if (interval === 24) return "Daily";
    return `Every ${interval} hours`;
  }

  if (freq === "DAILY") {
    const time = byHour ? `at ${byHour}:${byMinute?.padStart(2, "0") ?? "00"}` : "";
    return interval === 1 ? `Daily ${time}`.trim() : `Every ${interval} days ${time}`.trim();
  }

  if (freq === "WEEKLY") {
    const days = byDay ?? "daily";
    const time = byHour ? `at ${byHour}:${byMinute?.padStart(2, "0") ?? "00"}` : "";
    return `Weekly on ${days} ${time}`.trim();
  }

  return rrule;
};

const isDirectory = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const isFile = (p: string): boolean => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const loadAutomationsFromDir = (
  dir: string,
  source: AutomationSource,
  timingMap: Map<string, { nextRunAt?: number; lastRunAt?: number }>,
): Automation[] => {
  if (!isDirectory(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const automations: Automation[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const automationDir = path.join(dir, entry.name);
    const tomlPath = path.join(automationDir, AUTOMATION_TOML);
    const memoryPath = path.join(automationDir, MEMORY_FILE);

    if (!isFile(tomlPath)) continue;

    try {
      const content = fs.readFileSync(tomlPath, "utf8");
      const parsed = parseSimpleToml(content) as TomlAutomation;

      const id = parsed.id ?? entry.name;
      const timing = timingMap.get(id);

      automations.push({
        id,
        name: parsed.name ?? entry.name,
        prompt: parsed.prompt ?? "",
        status: (parsed.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
        rrule: parsed.rrule ?? "",
        rruleHuman: rruleToHuman(parsed.rrule ?? ""),
        cwds: Array.isArray(parsed.cwds) ? parsed.cwds : [],
        hasMemory: isFile(memoryPath),
        nextRunAt: timing?.nextRunAt,
        lastRunAt: timing?.lastRunAt,
        source,
        createdAt: parsed.created_at,
        updatedAt: parsed.updated_at,
      });
    } catch (err) {
      console.warn(`Failed to parse automation at ${tomlPath}:`, err);
    }
  }

  return automations;
};

const querySqliteTiming = (): Map<string, { nextRunAt?: number; lastRunAt?: number }> => {
  const map = new Map<string, { nextRunAt?: number; lastRunAt?: number }>();

  if (!isFile(SQLITE_DB)) return map;

  try {
    const { execSync } = require("child_process");
    const result = execSync(
      `sqlite3 "${SQLITE_DB}" "SELECT id, next_run_at, last_run_at FROM automations"`,
      { encoding: "utf8", timeout: 5000 },
    );

    const lines: string[] = result.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const [id, nextRun, lastRun] = line.split("|");
      if (id) {
        map.set(id, {
          nextRunAt: nextRun ? parseInt(nextRun, 10) : undefined,
          lastRunAt: lastRun ? parseInt(lastRun, 10) : undefined,
        });
      }
    }
  } catch (err) {
    console.warn("Failed to query SQLite timing:", err);
  }

  return map;
};

const queryAutomationRuns = (automationId: string): AutomationRun[] => {
  if (!isFile(SQLITE_DB)) return [];

  try {
    const { execSync } = require("child_process");
    const query = `SELECT thread_id, automation_id, status, thread_title, inbox_summary, source_cwd, created_at, updated_at, archived_reason FROM automation_runs WHERE automation_id = '${automationId.replace(/'/g, "''")}' ORDER BY created_at DESC LIMIT 10`;
    const result = execSync(`sqlite3 "${SQLITE_DB}" "${query}"`, {
      encoding: "utf8",
      timeout: 5000,
    });

    const lines = result.trim().split("\n").filter(Boolean);
    return lines.map((line: string) => {
      const [threadId, autoId, status, title, summary, cwd, created, updated, reason] =
        line.split("|");
      return {
        threadId,
        automationId: autoId,
        status: (status as "ACCEPTED" | "ARCHIVED" | "PENDING") ?? "PENDING",
        threadTitle: title || undefined,
        inboxSummary: summary || undefined,
        sourceCwd: cwd || undefined,
        createdAt: parseInt(created, 10) || 0,
        updatedAt: parseInt(updated, 10) || 0,
        archivedReason: reason || undefined,
      };
    });
  } catch (err) {
    console.warn("Failed to query automation runs:", err);
    return [];
  }
};

export const createAutomationHandlers = ({ context }: AutomationsDependencies) => ({
  getAutomations: async (): Promise<AutomationsIndex> => {
    const timingMap = querySqliteTiming();

    const globalDir = path.join(CODEX_HOME, AUTOMATIONS_DIR);
    const globalAutomations = loadAutomationsFromDir(globalDir, "global", timingMap);

    let workspaceAutomations: Automation[] = [];
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const workspaceDir = path.join(
        workspaceFolder.uri.fsPath,
        "_agents",
        AUTOMATIONS_DIR,
      );
      workspaceAutomations = loadAutomationsFromDir(workspaceDir, "workspace", timingMap);
    }

    return {
      global: globalAutomations,
      workspace: workspaceAutomations,
    };
  },

  getAutomationRuns: async (automationId: string): Promise<AutomationRun[]> => {
    return queryAutomationRuns(automationId);
  },
});
