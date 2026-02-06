import path from "path";
import { ConfigurationTarget, Uri, window, workspace } from "vscode";
import { parseEnvFile } from "../providers/data/atlassian/atlassianConfig";
import { MASKED_SECRET } from "../constants";
import { openExtensionSettings } from "../util/open-extension-settings";
import type { HandlerDependencies } from "./types";

type SettingsDependencies = Pick<HandlerDependencies, "context" | "storage" | "client">;

export const createSettingsHandlers = ({ context, storage, client }: SettingsDependencies) => ({
  openSettings: async () => {
    await openExtensionSettings(context);
  },

  syncEnvToSettings: async () => {
    const workspaceFolder =
      workspace.getWorkspaceFolder(Uri.file(context.extensionPath)) ??
      workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      window.showWarningMessage("Open a workspace to sync .env.local settings.");
      return;
    }

    const envPath = path.join(workspaceFolder.uri.fsPath, ".env");
    const envLocalPath = path.join(workspaceFolder.uri.fsPath, ".env.local");
    const envData = {
      ...parseEnvFile(envPath),
      ...parseEnvFile(envLocalPath),
    };

    const updates: Array<{ key: string; value: unknown }> = [];

    const baseUrl = envData.JIRA_URL || envData.ATLASSIAN_BASE_URL;
    const email = envData.JIRA_USER_EMAIL || envData.ATLASSIAN_EMAIL;
    const apiToken = envData.JIRA_API_TOKEN || envData.ATLASSIAN_API_TOKEN;
    const jql = envData.JIRA_JQL;

    if (baseUrl) {
      updates.push({ key: "baseUrl", value: baseUrl });
    }
    if (email) {
      updates.push({ key: "email", value: email });
    }
    if (apiToken) {
      updates.push({ key: "apiToken", value: MASKED_SECRET });
    }
    if (jql) {
      updates.push({ key: "jql", value: jql });
    }

    if (envData.ATLASSIAN_WEBVIEW_SERVER_URL) {
      updates.push({
        key: "webviewServerUrl",
        value: envData.ATLASSIAN_WEBVIEW_SERVER_URL,
      });
    }
    if (envData.ATLASSIAN_WEBVIEW_PATH) {
      updates.push({ key: "webviewPath", value: envData.ATLASSIAN_WEBVIEW_PATH });
    }
    if (envData.ATLASSIAN_DOCS_PATH) {
      updates.push({ key: "docsPath", value: envData.ATLASSIAN_DOCS_PATH });
    }

    if (updates.length === 0) {
      window.showWarningMessage(
        `No Atlassian settings found in ${path.basename(envLocalPath)} or ${path.basename(
          envPath,
        )}.`,
      );
      return;
    }

    const target =
      workspace.workspaceFolders && workspace.workspaceFolders.length > 0
        ? ConfigurationTarget.Workspace
        : ConfigurationTarget.Global;

    await Promise.all(
      updates.map(({ key, value }) => storage.updateSetting(key, value, target)),
    );

    if (baseUrl && email && apiToken) {
      await client.saveApiTokenAuth(baseUrl, email, apiToken);
    } else if (baseUrl || email) {
      await client.updateApiTokenDefaults(baseUrl, email);
    }

    window.showInformationMessage(
      `Synced ${updates.length} setting${updates.length === 1 ? "" : "s"} from ${
        path.basename(envLocalPath)
      }.`,
    );
  },
});
