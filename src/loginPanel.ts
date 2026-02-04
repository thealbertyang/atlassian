import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { AtlassianClient } from "./atlassianClient";
import { getApiTokenConfig, getOAuthConfig, getWebviewDevPath } from "./atlassianConfig";
import { AtlassianIssuesProvider } from "./issueProvider";

export class LoginPanel {
  static async show(
    context: vscode.ExtensionContext,
    client: AtlassianClient,
    provider: AtlassianIssuesProvider,
  ): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "atlassianLogin",
      "Atlassian Login",
      vscode.ViewColumn.Active,
      { enableScripts: true },
    );

    const resolvedDevPath = resolveDevPath(context.extensionPath);

    const render = async (): Promise<void> => {
      const defaults = await client.getApiTokenDefaults();
      const envApiConfig = getApiTokenConfig();
      const oauthConfig = getOAuthConfig();
      const oauthConfigured = Boolean(oauthConfig.clientId && oauthConfig.clientSecret);
      panel.webview.html = getWebviewHtml(
        panel.webview,
        defaults,
        oauthConfigured,
        Boolean(envApiConfig.baseUrl && envApiConfig.email && envApiConfig.apiToken),
        resolvedDevPath,
      );
    };

    await render();

    let devWatcher: fs.FSWatcher | undefined;
    if (resolvedDevPath && fs.existsSync(resolvedDevPath)) {
      devWatcher = fs.watch(resolvedDevPath, { persistent: false }, () => {
        void render();
      });
    }

    panel.webview.onDidReceiveMessage(async (message) => {
      try {
        if (message.type === "error") {
          vscode.window.showErrorMessage(message.message || "Invalid input.");
          return;
        }

        if (message.type === "saveApiToken") {
          await client.saveApiTokenAuth(message.baseUrl, message.email, message.apiToken);
          provider.refresh();
          vscode.window.showInformationMessage("Atlassian API token saved.");
          panel.dispose();
          return;
        }

        if (message.type === "startOAuth") {
          const started = await client.startOAuthFlow();
          if (!started) {
            return;
          }
          provider.refresh();
          vscode.window.showInformationMessage("Atlassian OAuth login complete.");
          panel.dispose();
          return;
        }

        if (message.type === "openSettings") {
          await vscode.commands.executeCommand("workbench.action.openSettings", "Atlassian");
          return;
        }
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(messageText);
      }
    });

    panel.onDidDispose(() => {
      if (devWatcher) {
        devWatcher.close();
      }
    });
  }
}

function getWebviewHtml(
  webview: vscode.Webview,
  defaults: { baseUrl: string; email: string },
  oauthConfigured: boolean,
  apiTokenConfigured: boolean,
  devPath: string,
): string {
  const nonce = String(Date.now());
  const baseUrl = escapeHtml(defaults.baseUrl);
  const email = escapeHtml(defaults.email);
  const oauthStatus = oauthConfigured ? "Configured" : "Missing";
  const oauthStatusClass = oauthConfigured ? "status-ok" : "status-missing";
  const oauthDisabled = oauthConfigured ? "" : "disabled";
  const apiStatus = apiTokenConfigured ? "Configured" : "Missing";
  const apiStatusClass = apiTokenConfigured ? "status-ok" : "status-missing";

  if (devPath && fs.existsSync(devPath)) {
    const template = fs.readFileSync(devPath, "utf8");
    return renderTemplate(template, {
      NONCE: nonce,
      CSP_SOURCE: webview.cspSource,
      BASE_URL: baseUrl,
      EMAIL: email,
      OAUTH_STATUS: oauthStatus,
      OAUTH_STATUS_CLASS: oauthStatusClass,
      OAUTH_DISABLED: oauthDisabled,
      API_STATUS: apiStatus,
      API_STATUS_CLASS: apiStatusClass,
    });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atlassian Login</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 24px;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 16px 0;
    }
    .card {
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      background: var(--vscode-sideBar-background);
    }
    .row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    input {
      padding: 8px 10px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    button {
      padding: 8px 14px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .note {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }
    .status {
      font-weight: 600;
    }
    .status-ok {
      color: #2ea043;
    }
    .status-missing {
      color: #d73a49;
    }
  </style>
</head>
<body>
  <h1>Connect to Atlassian</h1>

  <div class="card">
    <h2>API Token</h2>
    <p class="note">API settings: <span class="status ${apiStatusClass}">${apiStatus}</span></p>
    <div class="row">
      <label for="baseUrl">Jira site URL</label>
      <input id="baseUrl" type="text" placeholder="https://your-domain.atlassian.net" value="${baseUrl}" />
    </div>
    <div class="row">
      <label for="email">Atlassian account email</label>
      <input id="email" type="email" placeholder="you@company.com" value="${email}" />
    </div>
    <div class="row">
      <label for="apiToken">API token</label>
      <input id="apiToken" type="password" placeholder="Paste your API token" />
    </div>
    <div class="actions">
      <button id="saveToken">Save API Token</button>
    </div>
    <div class="note">Create an API token from your Atlassian account security settings.</div>
  </div>

  <div class="card">
    <h2>OAuth 2.0 (3LO)</h2>
    <p class="note">Requires an Atlassian OAuth app with a redirect URL. Configure client ID and secret in VS Code Settings.</p>
    <p class="note">OAuth settings: <span class="status ${oauthStatusClass}">${oauthStatus}</span></p>
    <div class="actions">
      <button id="openSettings" class="secondary">Open Settings</button>
      <button id="startOAuth" ${oauthDisabled}>Start OAuth Login</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('saveToken').addEventListener('click', () => {
      const baseUrl = document.getElementById('baseUrl').value.trim();
      const email = document.getElementById('email').value.trim();
      const apiToken = document.getElementById('apiToken').value.trim();

      if (!baseUrl || !email || !apiToken) {
        vscode.postMessage({ type: 'error', message: 'All fields are required.' });
        return;
      }

      vscode.postMessage({ type: 'saveApiToken', baseUrl, email, apiToken });
    });

    document.getElementById('startOAuth').addEventListener('click', () => {
      vscode.postMessage({ type: 'startOAuth' });
    });

    document.getElementById('openSettings').addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings' });
    });
  </script>
</body>
</html>`;
}

function resolveDevPath(extensionPath: string): string {
  const configured = getWebviewDevPath();
  if (configured) {
    return configured;
  }

  const defaultPath = path.join(extensionPath, "webview", "login.html");
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return "";
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => values[key] ?? "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
