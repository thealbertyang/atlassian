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

    if (envData.ATLASSIAN_WEBVIEW_DEV_SERVER_URL) {
      updates.push({
        key: "webviewDevServerUrl",
        value: envData.ATLASSIAN_WEBVIEW_DEV_SERVER_URL,
      });
    }
    if (envData.ATLASSIAN_WEBVIEW_DEV_PATH) {
      updates.push({ key: "webviewDevPath", value: envData.ATLASSIAN_WEBVIEW_DEV_PATH });
    }
    if (envData.ATLASSIAN_OAUTH_CLIENT_ID) {
      updates.push({ key: "oauthClientId", value: envData.ATLASSIAN_OAUTH_CLIENT_ID });
    }
    if (envData.ATLASSIAN_OAUTH_CLIENT_SECRET) {
      updates.push({
        key: "oauthClientSecret",
        value: envData.ATLASSIAN_OAUTH_CLIENT_SECRET,
      });
    }
    if (envData.ATLASSIAN_OAUTH_SCOPES) {
      updates.push({ key: "oauthScopes", value: envData.ATLASSIAN_OAUTH_SCOPES });
    }
    if (envData.ATLASSIAN_OAUTH_REDIRECT_PORT) {
      const parsed = Number(envData.ATLASSIAN_OAUTH_REDIRECT_PORT);
      if (Number.isFinite(parsed)) {
        updates.push({ key: "oauthRedirectPort", value: parsed });
      }
    }

    if (updates.length === 0) {
      window.showWarningMessage(
        `No Atlassian settings found in ${path.basename(envLocalPath)} or ${path.basename(
          envPath,
        )}.`,
      );
      return;
    }

    await Promise.all(
      updates.map(({ key, value }) =>
        storage.updateSetting(key, value, ConfigurationTarget.WorkspaceFolder, workspaceFolder.uri),
      ),
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
