import * as vscode from "vscode";
import { AtlassianClient } from "./atlassianClient";
import { AtlassianIssuesProvider } from "./issueProvider";
import { LoginPanel } from "./loginPanel";

export function activate(context: vscode.ExtensionContext): void {
  const client = new AtlassianClient(context);
  const provider = new AtlassianIssuesProvider(client);

  registerTreeProvider(context, provider);

  context.subscriptions.push(
    vscode.commands.registerCommand("atlassian.refresh", () => provider.refresh()),
    vscode.commands.registerCommand("atlassian.login", async () => {
      await LoginPanel.show(context, client, provider);
    }),
    vscode.commands.registerCommand("atlassian.logout", async () => {
      await client.clearAuth();
      provider.refresh();
      vscode.window.showInformationMessage("Atlassian credentials cleared.");
    }),
    vscode.commands.registerCommand("atlassian.openIssue", async (issue) => {
      const key = issue?.key || issue?.issue?.key;
      if (!key) {
        return;
      }
      const url = await client.getIssueUrl(key);
      if (!url) {
        vscode.window.showErrorMessage("Please login to open issues.");
        return;
      }
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );
}

export function deactivate(): void {
  // no-op
}

function registerTreeProvider(
  context: vscode.ExtensionContext,
  provider: AtlassianIssuesProvider,
  attempt = 0,
): void {
  try {
    context.subscriptions.push(vscode.window.registerTreeDataProvider("atlassianIssues", provider));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to register view (attempt ${attempt + 1}): ${message}`);
    if (attempt < 3) {
      setTimeout(() => registerTreeProvider(context, provider, attempt + 1), 500);
    }
  }
}
