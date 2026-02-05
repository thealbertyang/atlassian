import * as vscode from "vscode";

export const outputChannel = vscode.window.createOutputChannel("Atlassian Sprint");

export function log(message: string): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
}
