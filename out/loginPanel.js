"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginPanel = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const atlassianConfig_1 = require("./atlassianConfig");
class LoginPanel {
    static async show(context, client, provider) {
        const distRoot = path.join(context.extensionPath, "webview-ui", "dist");
        const panel = vscode.window.createWebviewPanel("atlassianLogin", "Atlassian Login", vscode.ViewColumn.Active, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(context.extensionPath), vscode.Uri.file(distRoot)],
        });
        const resolvedDevPath = resolveDevPath(context.extensionPath);
        const devServerUrl = normalizeDevServerUrl((0, atlassianConfig_1.getWebviewDevServerUrl)());
        const distPath = resolveDistPath(distRoot);
        const getState = async () => {
            const defaults = await client.getApiTokenDefaults();
            const envApiConfig = (0, atlassianConfig_1.getApiTokenConfig)();
            const oauthConfig = (0, atlassianConfig_1.getOAuthConfig)();
            return {
                baseUrl: defaults.baseUrl,
                email: defaults.email,
                oauthConfigured: Boolean(oauthConfig.clientId && oauthConfig.clientSecret),
                apiTokenConfigured: Boolean(envApiConfig.baseUrl && envApiConfig.email && envApiConfig.apiToken),
            };
        };
        const render = async () => {
            const state = await getState();
            panel.webview.html = getWebviewHtml(panel.webview, state, resolvedDevPath, devServerUrl, distPath);
            void panel.webview.postMessage({ type: "init", payload: state });
        };
        await render();
        let devWatcher;
        if (!devServerUrl && !distPath && resolvedDevPath && fs.existsSync(resolvedDevPath)) {
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
                if (message.type === "ready") {
                    const state = await getState();
                    await panel.webview.postMessage({ type: "init", payload: state });
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
            }
            catch (error) {
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
exports.LoginPanel = LoginPanel;
function getWebviewHtml(webview, state, devPath, devServerUrl, distPath) {
    const nonce = String(Date.now());
    const baseUrl = escapeHtml(state.baseUrl);
    const email = escapeHtml(state.email);
    const oauthStatus = state.oauthConfigured ? "Configured" : "Missing";
    const oauthStatusClass = state.oauthConfigured ? "status-ok" : "status-missing";
    const oauthDisabled = state.oauthConfigured ? "" : "disabled";
    const apiStatus = state.apiTokenConfigured ? "Configured" : "Missing";
    const apiStatusClass = state.apiTokenConfigured ? "status-ok" : "status-missing";
    if (devServerUrl) {
        return getDevServerHtml(webview, devServerUrl);
    }
    if (distPath) {
        return getDistHtml(webview, distPath);
    }
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
function resolveDevPath(extensionPath) {
    const configured = (0, atlassianConfig_1.getWebviewDevPath)();
    if (configured) {
        return configured;
    }
    const defaultPath = path.join(extensionPath, "webview", "login.html");
    if (fs.existsSync(defaultPath)) {
        return defaultPath;
    }
    return "";
}
function resolveDistPath(distRoot) {
    const indexPath = path.join(distRoot, "index.html");
    return fs.existsSync(indexPath) ? indexPath : "";
}
function normalizeDevServerUrl(value) {
    if (!value) {
        return "";
    }
    return value.endsWith("/") ? value.slice(0, -1) : value;
}
function getDistHtml(webview, indexPath) {
    const distRoot = path.dirname(indexPath);
    let html = fs.readFileSync(indexPath, "utf8");
    html = html.replace(/(src|href)="(\/?assets\/[^"]+)"/g, (_match, attr, assetPath) => {
        const normalized = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
        const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(distRoot, normalized)));
        return `${attr}="${assetUri}"`;
    });
    const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource} https: data:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src ${webview.cspSource}`,
        `font-src ${webview.cspSource} https: data:`,
    ].join("; ");
    if (!html.includes("Content-Security-Policy")) {
        html = html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
    }
    return html;
}
function getDevServerHtml(webview, devServerUrl) {
    const nonce = String(Date.now());
    let origin = devServerUrl;
    try {
        origin = new URL(devServerUrl).origin;
    }
    catch {
        // ignore invalid URL
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' ${origin}; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' ${origin}; connect-src ${origin} ws:; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} https: data:;"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atlassian Login (Dev)</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${origin}/@vite/client"></script>
  <script nonce="${nonce}" type="module" src="${origin}/src/main.ts"></script>
</body>
</html>`;
}
function renderTemplate(template, values) {
    return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => values[key] ?? "");
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
//# sourceMappingURL=loginPanel.js.map