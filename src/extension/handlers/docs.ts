import fs from "fs";
import path from "path";
import { Uri, commands, window, workspace } from "vscode";
import { getDocsPath } from "../providers/data/atlassian/atlassianConfig";
import type { DocContent, DocEntry, DocGroup, DocsIndex, DocsSource } from "../../shared/docs-contract";
import type { HandlerDependencies } from "./types";

type DocsDependencies = Pick<HandlerDependencies, "context">;

type DocsRoot = {
  root: string | null;
  source: DocsSource;
  error?: string;
};

const RUNBOOKS_DIR = "runbooks";
const MARKDOWN_EXT = ".md";

const toTitleCase = (value: string): string =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toPosix = (value: string): string => value.split(path.sep).join("/");

const isDirectory = (value: string): boolean => {
  try {
    return fs.statSync(value).isDirectory();
  } catch {
    return false;
  }
};

const isFile = (value: string): boolean => {
  try {
    return fs.statSync(value).isFile();
  } catch {
    return false;
  }
};

const normalizeDocId = (value: string): string | null => {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.startsWith("/")) {
    return null;
  }
  const normalized = path.posix.normalize(trimmed);
  if (normalized.startsWith("../") || normalized === "..") {
    return null;
  }
  return normalized;
};

const isWithinRoot = (root: string, target: string): boolean => {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
  );
};

const resolveConfiguredPath = (value: string, context: DocsDependencies["context"]): string => {
  if (!value) {
    return "";
  }
  if (path.isAbsolute(value)) {
    return value;
  }
  const workspaceFolder =
    workspace.getWorkspaceFolder(Uri.file(context.extensionPath)) ?? workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return path.resolve(workspaceFolder.uri.fsPath, value);
  }
  return path.resolve(context.extensionPath, value);
};

const resolveDocsRoot = (context: DocsDependencies["context"]): DocsRoot => {
  const configured = getDocsPath();
  if (configured) {
    const resolved = resolveConfiguredPath(configured, context);
    if (isDirectory(resolved)) {
      return { root: resolved, source: "settings" };
    }
    return {
      root: null,
      source: "settings",
      error: `Docs path not found: ${resolved}`,
    };
  }

  const extensionDocs = path.join(context.extensionPath, "docs");
  if (isDirectory(extensionDocs)) {
    return { root: extensionDocs, source: "extension" };
  }

  const workspaceFolder =
    workspace.getWorkspaceFolder(Uri.file(context.extensionPath)) ?? workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    const workspaceDocs = path.join(workspaceFolder.uri.fsPath, "docs");
    if (isDirectory(workspaceDocs)) {
      return { root: workspaceDocs, source: "workspace" };
    }
  }

  return {
    root: null,
    source: "none",
    error: "No docs directory found. Set atlassian.docsPath to enable Markdown rendering.",
  };
};

const readTitle = (filePath: string): string => {
  const fallback = toTitleCase(path.basename(filePath, MARKDOWN_EXT));
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const match = raw.match(/^#\s+(.+)$/m);
    if (match?.[1]) {
      return match[1].trim();
    }
  } catch {
    // ignore
  }
  return fallback;
};

const listMarkdownEntries = (root: string, group: DocGroup, subdir?: string): DocEntry[] => {
  const dirPath = subdir ? path.join(root, subdir) : root;
  if (!isDirectory(dirPath)) {
    return [];
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name.toLowerCase().endsWith(MARKDOWN_EXT))
    .filter((entry) => !entry.name.startsWith("_"))
    .map((entry) => {
      const relativePath = subdir ? path.join(subdir, entry.name) : entry.name;
      const id = toPosix(relativePath);
      const filePath = path.join(dirPath, entry.name);
      return {
        id,
        title: readTitle(filePath),
        group,
        relativePath: toPosix(relativePath),
      } satisfies DocEntry;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
};

const resolveDocPath = (root: string, id: string): string | null => {
  const normalized = normalizeDocId(id);
  if (!normalized) {
    return null;
  }
  const target = path.resolve(root, normalized.split("/").join(path.sep));
  const base = path.resolve(root);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  if (!target.toLowerCase().endsWith(MARKDOWN_EXT)) {
    return null;
  }
  return target;
};

const resolveAssetPath = (
  root: string,
  baseId: string,
  href: string,
): { path: string; withinRoot: boolean } | null => {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = trimmed.split("#")[0].split("?")[0];
  if (!cleaned) {
    return null;
  }
  const decoded = (() => {
    try {
      return decodeURIComponent(cleaned);
    } catch {
      return cleaned;
    }
  })();
  const basePath = resolveDocPath(root, baseId);
  if (!basePath) {
    return null;
  }
  const resolved = path.resolve(path.dirname(basePath), decoded);
  return { path: resolved, withinRoot: isWithinRoot(root, resolved) };
};

export const createDocsHandlers = ({ context }: DocsDependencies) => ({
  getDocsIndex: async (): Promise<DocsIndex> => {
    const { root, source, error } = resolveDocsRoot(context);
    if (!root) {
      return {
        root: null,
        source,
        entries: [],
        error,
      };
    }

    const docs = listMarkdownEntries(root, "docs");
    const runbooks = listMarkdownEntries(root, "runbooks", RUNBOOKS_DIR);

    return {
      root,
      source,
      entries: [...docs, ...runbooks],
    };
  },

  getDocContent: async (id: string): Promise<DocContent | null> => {
    const { root } = resolveDocsRoot(context);
    if (!root) {
      return null;
    }
    const filePath = resolveDocPath(root, id);
    if (!filePath || !isFile(filePath)) {
      return null;
    }
    const markdown = fs.readFileSync(filePath, "utf8");
    return {
      id: toPosix(id),
      title: readTitle(filePath),
      relativePath: toPosix(path.relative(root, filePath)),
      markdown,
    };
  },

  revealDocAsset: async (baseId: string, href: string): Promise<boolean> => {
    const { root } = resolveDocsRoot(context);
    if (!root) {
      window.showWarningMessage("Docs folder is not configured.");
      return false;
    }
    const resolved = resolveAssetPath(root, baseId, href);
    if (!resolved) {
      window.showWarningMessage("Unable to resolve the linked file.");
      return false;
    }

    const workspaceFolder =
      workspace.getWorkspaceFolder(Uri.file(context.extensionPath)) ??
      workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri.fsPath;
    const withinWorkspace = workspaceRoot ? isWithinRoot(workspaceRoot, resolved.path) : false;
    const withinDocsRoot = resolved.withinRoot;

    if (!withinWorkspace && !withinDocsRoot) {
      window.showWarningMessage("Linked file is outside the workspace.");
      return false;
    }

    if (!fs.existsSync(resolved.path)) {
      window.showWarningMessage(`File not found: ${resolved.path}`);
      return false;
    }

    await commands.executeCommand("revealInExplorer", Uri.file(resolved.path));
    return true;
  },
});
