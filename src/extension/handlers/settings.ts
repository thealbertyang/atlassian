import path from "path";
import { ConfigurationTarget, Uri, window, workspace } from "vscode";
import { parseEnvFile } from "../providers/data/atlassian/atlassianConfig";
import { MASKED_SECRET } from "../constants";
import { openExtensionSettings } from "../util/open-extension-settings";
import { SETTINGS_KEYS } from "../../shared/contracts";
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

    const updates: Array<{ key: string; value: unknown; env: string; sensitive?: boolean }> = [];

    const baseUrlEnv = envData.JIRA_URL ? "JIRA_URL" : envData.ATLASSIAN_BASE_URL ? "ATLASSIAN_BASE_URL" : null;
    const emailEnv = envData.JIRA_USER_EMAIL ? "JIRA_USER_EMAIL" : envData.ATLASSIAN_EMAIL ? "ATLASSIAN_EMAIL" : null;
    const apiTokenEnv = envData.JIRA_API_TOKEN ? "JIRA_API_TOKEN" : envData.ATLASSIAN_API_TOKEN ? "ATLASSIAN_API_TOKEN" : null;

    if (baseUrlEnv) {
      updates.push({ key: SETTINGS_KEYS.BASE_URL, value: envData[baseUrlEnv], env: baseUrlEnv });
    }
    if (emailEnv) {
      updates.push({ key: SETTINGS_KEYS.EMAIL, value: envData[emailEnv], env: emailEnv });
    }
    if (apiTokenEnv) {
      updates.push({ key: SETTINGS_KEYS.API_TOKEN, value: MASKED_SECRET, env: apiTokenEnv, sensitive: true });
    }
    if (envData.JIRA_JQL) {
      updates.push({ key: SETTINGS_KEYS.JQL, value: envData.JIRA_JQL, env: "JIRA_JQL" });
    }

    if (envData.ATLASSIAN_WEBVIEW_SERVER_URL) {
      updates.push({
        key: SETTINGS_KEYS.WEBVIEW_SERVER_URL,
        value: envData.ATLASSIAN_WEBVIEW_SERVER_URL,
        env: "ATLASSIAN_WEBVIEW_SERVER_URL",
      });
    }
    if (envData.ATLASSIAN_WEBVIEW_PATH) {
      updates.push({ key: SETTINGS_KEYS.WEBVIEW_PATH, value: envData.ATLASSIAN_WEBVIEW_PATH, env: "ATLASSIAN_WEBVIEW_PATH" });
    }
    if (envData.ATLASSIAN_DOCS_PATH) {
      updates.push({ key: SETTINGS_KEYS.DOCS_PATH, value: envData.ATLASSIAN_DOCS_PATH, env: "ATLASSIAN_DOCS_PATH" });
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

    const baseUrl = baseUrlEnv ? envData[baseUrlEnv] : undefined;
    const email = emailEnv ? envData[emailEnv] : undefined;
    const apiToken = apiTokenEnv ? envData[apiTokenEnv] : undefined;

    if (baseUrl && email && apiToken) {
      await client.saveApiTokenAuth(baseUrl, email, apiToken);
    } else if (baseUrl || email) {
      await client.updateApiTokenDefaults(baseUrl, email);
    }

    const source = path.basename(envLocalPath);

    window.showInformationMessage(
      `Synced ${updates.length} setting${updates.length === 1 ? "" : "s"} from ${source}.`,
    );

    return {
      count: updates.length,
      source,
      items: updates.map(({ env, key, sensitive }) => ({
        env,
        setting: key,
        masked: sensitive ?? false,
      })),
    };
  },
});
