import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getWebviewDevPath } from "../providers/data/atlassian/atlassianConfig";

export function resolveDevPath(extensionPath: string): string {
  const configured = getWebviewDevPath();
  if (configured) {
    return configured;
  }

  const defaultPath = path.join(extensionPath, "src", "webview", "index.html");
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return "";
}

export function resolveWebviewRoot(extensionPath: string): string {
  const direct = path.join(extensionPath, "src", "webview", "src");
  if (fs.existsSync(direct)) {
    return extensionPath;
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const repoCandidate = path.join(root, "repos", "vscode", "extensions", "atlassian");
    if (fs.existsSync(path.join(repoCandidate, "src", "webview", "src"))) {
      return repoCandidate;
    }
    if (fs.existsSync(path.join(root, "src", "webview", "src"))) {
      return root;
    }
  }

  return "";
}
