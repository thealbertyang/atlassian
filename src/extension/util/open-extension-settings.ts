import { commands, type ExtensionContext, workspace } from "vscode";

export async function openExtensionSettings(context: ExtensionContext): Promise<void> {
  const query = `@ext:${context.extension.id}`;
  const hasWorkspace = (workspace.workspaceFolders?.length ?? 0) > 0;

  if (hasWorkspace) {
    try {
      await commands.executeCommand("workbench.action.openWorkspaceSettings", query);
      return;
    } catch {
      // Fall through to user settings.
    }
  }

  await commands.executeCommand("workbench.action.openSettings", query);
}
