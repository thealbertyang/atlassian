#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const filePath = args[0];
const flags = new Set(args.slice(1));
const blockSelector = getArgValue(args, "--block");
const listOnly = flags.has("--list");
const dryRun = flags.has("--dry-run");

const markdown = fs.readFileSync(filePath, "utf8");
const blocks = parseBlocks(markdown)
  .filter((block) => block.tags.includes("runbook"))
  .map((block, index) => ({ ...block, index: index + 1 }));

if (listOnly) {
  if (blocks.length === 0) {
    console.log("No runnable runbook blocks found.");
    process.exit(0);
  }
  console.log("Runnable blocks:");
  for (const block of blocks) {
    const name = block.name ? `name=${block.name}` : "name=<none>";
    console.log(`- #${block.index} ${name} (${block.language || "unknown"})`);
  }
  process.exit(0);
}

const selected = selectBlocks(blocks, blockSelector);
if (selected.length === 0) {
  console.error("No matching runbook blocks found.");
  process.exit(1);
}

for (const block of selected) {
  const title = block.name ? `runbook:${block.name}` : `runbook:#${block.index}`;
  const script = block.content.trimEnd();
  if (!script) {
    continue;
  }
  if (dryRun) {
    console.log(`--- ${title} (dry-run) ---`);
    console.log(script);
    continue;
  }
  console.log(`--- ${title} ---`);
  const result = runShell(script);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function printHelp() {
  console.log(`Usage: node scripts/runbook.mjs <file> [options]

Options:
  --list           List runnable blocks
  --block <name>   Run block by name or numeric index
  --dry-run        Print commands without executing

Runbook blocks must be fenced code blocks with the "runbook" tag, e.g.:
  \`\`\`sh runbook name=triage
  echo "hello"
  \`\`\`
`);
}

function getArgValue(argv, key) {
  const idx = argv.indexOf(key);
  if (idx === -1 || idx + 1 >= argv.length) {
    return undefined;
  }
  return argv[idx + 1];
}

function parseBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let inFence = false;
  let fenceInfo = "";
  let startLine = 0;
  let buffer = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(.*)$/);
    if (!inFence && fenceMatch) {
      inFence = true;
      fenceInfo = fenceMatch[1]?.trim() ?? "";
      startLine = i + 1;
      buffer = [];
      continue;
    }
    if (inFence && line.startsWith("```")) {
      const { language, tags, name } = parseFenceInfo(fenceInfo);
      blocks.push({
        language,
        tags,
        name,
        content: buffer.join("\n"),
        startLine,
        endLine: i + 1,
      });
      inFence = false;
      fenceInfo = "";
      buffer = [];
      continue;
    }
    if (inFence) {
      buffer.push(line);
    }
  }

  return blocks;
}

function parseFenceInfo(info) {
  const tokens = info.split(/\s+/).filter(Boolean);
  const language = tokens[0];
  const tags = [];
  let name;

  for (const token of tokens.slice(1)) {
    if (token === "runbook") {
      tags.push("runbook");
      continue;
    }
    if (token.startsWith("name=")) {
      name = token.slice("name=".length);
      continue;
    }
    if (token.startsWith("tag=")) {
      tags.push(token.slice("tag=".length));
      continue;
    }
  }

  return { language, tags, name };
}

function selectBlocks(blocks, selector) {
  if (!selector) {
    return blocks;
  }
  const numeric = Number(selector);
  if (Number.isFinite(numeric)) {
    return blocks.filter((block) => block.index === numeric);
  }
  return blocks.filter((block) => block.name === selector);
}

function runShell(script) {
  if (process.platform === "win32") {
    return spawnSync("cmd", ["/d", "/s", "/c", script], { stdio: "inherit" });
  }
  const shell = process.env.SHELL || "/bin/bash";
  return spawnSync(shell, ["-lc", script], { stdio: "inherit" });
}
