#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const roots = getArgValues(argv, "--root");
const typesFilter = new Set(getArgValues(argv, "--type").flatMap((t) => t.split(",")));
const listOnly = argv.includes("--list");
const dryRun = argv.includes("--dry-run");
const runOnce = argv.includes("--once");
const tickMode = argv.includes("--tick");
const tickInterval = Number(getArgValue(argv, "--interval") ?? "60");
const statePath =
  getArgValue(argv, "--state") ??
  path.resolve(process.cwd(), ".automation-runner", "state.json");

const rootDirs = roots.length > 0 ? roots : [process.cwd()];
const automations = discoverAutomations(rootDirs);

if (listOnly) {
  printAutomationList(automations);
  process.exit(0);
}

if (runOnce) {
  runAutomations(automations, { dryRun, statePath, onlyDue: false });
  process.exit(0);
}

if (tickMode) {
  ensureStateDir(statePath);
  runTickLoop(automations, { dryRun, statePath, intervalSeconds: tickInterval });
  process.exit(0);
}

// Default: run due now
runAutomations(automations, { dryRun, statePath, onlyDue: true });

function printHelp() {
  console.log(`Usage: node scripts/automation-runner.mjs [options]

Options:
  --root <dir>       Root directory to scan (repeatable)
  --type <types>     Filter by type (comma-separated)
  --list             List discovered automations
  --once             Run all automations once (ignore schedule)
  --tick             Run scheduler loop
  --interval <sec>   Tick interval in seconds (default 60)
  --dry-run          Print actions without executing
  --state <path>     State file for last-run tracking

File discovery:
  - automation.toml
  - *.automation.toml

Supported types:
  - command  (runs a shell command)
  - runbook  (runs a named block from a runbook markdown file)
  - prompt   (prints prompt or runs a configured runner command)
`);
}

function getArgValue(args, key) {
  const idx = args.indexOf(key);
  if (idx === -1 || idx + 1 >= args.length) {
    return undefined;
  }
  return args[idx + 1];
}

function getArgValues(args, key) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === key && i + 1 < args.length) {
      values.push(args[i + 1]);
    }
  }
  return values;
}

function discoverAutomations(roots) {
  const files = [];
  for (const root of roots) {
    walk(root, (filePath) => {
      const base = path.basename(filePath);
      if (base === "automation.toml" || base.endsWith(".automation.toml")) {
        files.push(filePath);
      }
    });
  }

  const automations = [];
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    const data = parseTomlLite(text);
    const type = String(data.type || "prompt");
    if (typesFilter.size > 0 && !typesFilter.has(type)) {
      continue;
    }
    automations.push({
      filePath,
      dir: path.dirname(filePath),
      id: data.id || path.basename(path.dirname(filePath)),
      name: data.name || path.basename(filePath),
      type,
      status: String(data.status || "ACTIVE"),
      rrule: data.rrule ? String(data.rrule) : undefined,
      cwds: normalizeCwds(data, path.dirname(filePath)),
      data,
    });
  }

  return automations;
}

function walk(dir, onFile) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".git")) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, onFile);
    } else if (entry.isFile()) {
      onFile(fullPath);
    }
  }
}

function normalizeCwds(data, baseDir) {
  if (Array.isArray(data.cwds) && data.cwds.length > 0) {
    return data.cwds.map((cwd) => resolvePath(baseDir, String(cwd)));
  }
  if (data.cwd) {
    return [resolvePath(baseDir, String(data.cwd))];
  }
  return [baseDir];
}

function printAutomationList(automations) {
  if (automations.length === 0) {
    console.log("No automations found.");
    return;
  }
  for (const automation of automations) {
    console.log(
      `- ${automation.id} (${automation.type}) [${automation.status}] - ${automation.filePath}`,
    );
  }
}

function runTickLoop(automations, { dryRun, statePath, intervalSeconds }) {
  const intervalMs = Math.max(10, intervalSeconds) * 1000;
  console.log(`Automation runner: tick every ${intervalSeconds}s`);
  runAutomations(automations, { dryRun, statePath, onlyDue: true });
  setInterval(() => {
    runAutomations(automations, { dryRun, statePath, onlyDue: true });
  }, intervalMs);
}

function runAutomations(automations, { dryRun, statePath, onlyDue }) {
  const state = loadState(statePath);
  const now = new Date();
  for (const automation of automations) {
    if (automation.status.toUpperCase() !== "ACTIVE") {
      continue;
    }
    if (onlyDue && automation.rrule) {
      const rule = parseRruleLite(automation.rrule);
      const lastRun = state[automation.id];
      if (!matchesSchedule(rule, now, lastRun)) {
        continue;
      }
    } else if (onlyDue && !automation.rrule) {
      continue;
    }

    const ok = executeAutomation(automation, { dryRun });
    if (ok) {
      state[automation.id] = now.toISOString();
      saveState(statePath, state);
    }
  }
}

function executeAutomation(automation, { dryRun }) {
  const { type, data, cwds } = automation;
  const handler = handlers[type];
  if (!handler) {
    console.warn(`Unknown automation type: ${type} (${automation.filePath})`);
    return false;
  }
  for (const cwd of cwds) {
    const ok = handler(automation, data, cwd, dryRun);
    if (!ok) {
      return false;
    }
  }
  return true;
}

const handlers = {
  command: (automation, data, cwd, dryRun) => {
    const command = data.command || data.cmd;
    if (!command) {
      console.warn(`Missing command for ${automation.filePath}`);
      return false;
    }
    if (dryRun) {
      console.log(`[dry-run] ${automation.id} -> ${command}`);
      return true;
    }
    return runShell(String(command), cwd).status === 0;
  },
  runbook: (automation, data, cwd, dryRun) => {
    const runbook = data.runbook;
    const block = data.block;
    if (!runbook || !block) {
      console.warn(`Missing runbook/block for ${automation.filePath}`);
      return false;
    }
    const runbookPath = resolvePath(automation.dir, String(runbook));
    const cmd = `node scripts/runbook.mjs ${shellEscape(runbookPath)} --block ${shellEscape(
      String(block),
    )}${dryRun ? " --dry-run" : ""}`;
    if (dryRun) {
      console.log(`[dry-run] ${automation.id} -> ${cmd}`);
      return true;
    }
    return runShell(cmd, cwd).status === 0;
  },
  prompt: (automation, data, cwd, dryRun) => {
    const prompt = data.prompt;
    if (!prompt) {
      console.warn(`Missing prompt for ${automation.filePath}`);
      return false;
    }
    const runner = data.runner;
    if (!runner || dryRun) {
      console.log(`[prompt] ${automation.id} (${cwd})`);
      console.log(String(prompt));
      return true;
    }
    const cmd = `${runner} ${shellEscape(String(prompt))}`;
    return runShell(cmd, cwd).status === 0;
  },
};

function runShell(command, cwd) {
  if (process.platform === "win32") {
    return spawnSync("cmd", ["/d", "/s", "/c", command], { stdio: "inherit", cwd });
  }
  const shell = process.env.SHELL || "/bin/bash";
  return spawnSync(shell, ["-lc", command], { stdio: "inherit", cwd });
}

function shellEscape(value) {
  if (/^[A-Za-z0-9_./-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function ensureStateDir(statePath) {
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });
}

function loadState(statePath) {
  try {
    const text = fs.readFileSync(statePath, "utf8");
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function saveState(statePath, state) {
  ensureStateDir(statePath);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function parseRruleLite(rrule) {
  const rule = {
    freq: "DAILY",
    interval: 1,
    byday: [],
    byhour: [],
    byminute: [],
  };
  const parts = rrule.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [key, rawValue] = part.split("=");
    if (!key || rawValue === undefined) {
      continue;
    }
    const value = rawValue.trim();
    switch (key.toUpperCase()) {
      case "FREQ":
        rule.freq = value.toUpperCase();
        break;
      case "INTERVAL":
        rule.interval = Math.max(1, Number(value) || 1);
        break;
      case "BYDAY":
        rule.byday = value.split(",").map((day) => day.trim().toUpperCase());
        break;
      case "BYHOUR":
        rule.byhour = value.split(",").map((hour) => Number(hour));
        break;
      case "BYMINUTE":
        rule.byminute = value.split(",").map((minute) => Number(minute));
        break;
      default:
        break;
    }
  }
  return rule;
}

function matchesSchedule(rule, now, lastRunIso) {
  const lastRun = lastRunIso ? new Date(lastRunIso) : null;
  if (lastRun && isSameMinute(lastRun, now)) {
    return false;
  }

  const minute = now.getMinutes();
  const hour = now.getHours();
  const day = now.getDay();

  if (rule.freq === "HOURLY") {
    const hoursSinceEpoch = Math.floor(now.getTime() / 3_600_000);
    if (hoursSinceEpoch % rule.interval !== 0) {
      return false;
    }
    if (rule.byminute.length > 0 && !rule.byminute.includes(minute)) {
      return false;
    }
    if (rule.byday.length > 0 && !rule.byday.includes(dayToRrule(day))) {
      return false;
    }
    return true;
  }

  if (rule.freq === "DAILY") {
    const daysSinceEpoch = Math.floor(now.getTime() / 86_400_000);
    if (daysSinceEpoch % rule.interval !== 0) {
      return false;
    }
    if (rule.byday.length > 0 && !rule.byday.includes(dayToRrule(day))) {
      return false;
    }
    const targetHour = rule.byhour.length > 0 ? rule.byhour : [9];
    const targetMinute = rule.byminute.length > 0 ? rule.byminute : [0];
    return targetHour.includes(hour) && targetMinute.includes(minute);
  }

  if (rule.freq === "WEEKLY") {
    const weekIndex = getWeekIndex(now);
    if (weekIndex % rule.interval !== 0) {
      return false;
    }
    if (rule.byday.length > 0 && !rule.byday.includes(dayToRrule(day))) {
      return false;
    }
    const targetHour = rule.byhour.length > 0 ? rule.byhour : [9];
    const targetMinute = rule.byminute.length > 0 ? rule.byminute : [0];
    return targetHour.includes(hour) && targetMinute.includes(minute);
  }

  return false;
}

function getWeekIndex(date) {
  const dayIndex = (date.getDay() + 6) % 7;
  const startOfWeek = new Date(date);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - dayIndex);
  return Math.floor(startOfWeek.getTime() / 604_800_000);
}

function dayToRrule(day) {
  return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][day] || "SU";
}

function isSameMinute(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

function resolvePath(baseDir, target) {
  if (path.isAbsolute(target)) {
    return target;
  }
  return path.resolve(baseDir, target);
}

function parseTomlLite(text) {
  const result = {};
  let current = result;
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      const section = line.slice(1, -1).trim();
      current = ensureSection(result, section);
      continue;
    }
    const idx = line.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    current[key] = parseTomlValue(value);
  }
  return result;
}

function ensureSection(root, section) {
  const parts = section.split(".").map((part) => part.trim());
  let current = root;
  for (const part of parts) {
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  return current;
}

function parseTomlValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map(parseTomlValue);
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  const numberValue = Number(value);
  if (!Number.isNaN(numberValue)) {
    return numberValue;
  }
  return value;
}
