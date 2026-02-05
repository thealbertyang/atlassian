import { ConfigurationTarget, ExtensionMode, env, window, workspace } from "vscode";
import {
  getApiTokenConfig,
  getApiTokenConfigSource,
} from "../providers/data/atlassian/atlassianConfig";
import { MASKED_SECRET } from "../constants";
import type { HandlerDependencies } from "./types";

type AuthDependencies = Pick<
  HandlerDependencies,
  "context" | "storage" | "client" | "provider" | "buildWatcher" | "renderTracker"
>;

export const createAuthHandlers = ({
  context,
  storage,
  client,
  provider,
  buildWatcher,
  renderTracker,
}: AuthDependencies) => {
  const getState = async () => {
    const defaults = await client.getApiTokenDefaults();
    const envApiConfig = getApiTokenConfig();
    const authType = client.getAuthType();
    const hasStoredToken = await client.hasStoredApiToken();
    const hasEnvToken = Boolean(
      envApiConfig.baseUrl && envApiConfig.email && envApiConfig.apiToken,
    );
    const isConfigured =
      authType === "oauth" || hasEnvToken || (authType === "apiToken" && hasStoredToken);

    const configSource = isConfigured ? getApiTokenConfigSource() : "none";

    return {
      baseUrl: envApiConfig.baseUrl || defaults.baseUrl,
      email: envApiConfig.email || defaults.email,
      apiTokenConfigured: isConfigured,
      configSource,
      authType,
      hasStoredToken,
      devMode: context.extensionMode === ExtensionMode.Development,
      extensionId: context.extension.id,
      uriScheme: env.uriScheme,
      dev: {
        lastExtensionBuildAt: buildWatcher.getLastBuildAt(),
        lastWebviewRenderAt: renderTracker.getLastRenderedAt(),
      },
    };
  };

  return {
    getState,

    saveApiToken: async (baseUrl: string, email: string, apiToken: string) => {
      const token = apiToken.trim();
      const hasStoredToken = await client.hasStoredApiToken();
      const shouldStoreToken = token.length > 0 && token !== MASKED_SECRET;
      if (!shouldStoreToken && !hasStoredToken) {
        const envToken = getApiTokenConfig().apiToken;
        if (!envToken) {
          throw new Error("API token is required to connect.");
        }
        await client.saveApiTokenAuth(baseUrl, email, envToken);
      } else if (shouldStoreToken) {
        await client.saveApiTokenAuth(baseUrl, email, token);
      } else {
        await client.updateApiTokenDefaults(baseUrl, email);
      }

      const target =
        workspace.workspaceFolders && workspace.workspaceFolders.length > 0
          ? ConfigurationTarget.Workspace
          : ConfigurationTarget.Global;
      await Promise.all([
        storage.updateSetting("baseUrl", baseUrl, target),
        storage.updateSetting("email", email, target),
        storage.updateSetting("apiToken", MASKED_SECRET, target),
      ]);

      provider.refresh();
      window.showInformationMessage("Atlassian API token saved.");
    },

    disconnect: async () => {
      await client.clearAuth();
      provider.refresh();
      window.showInformationMessage("Atlassian connection removed.");
    },
  };
};
