"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./style.css");
const vscode = typeof acquireVsCodeApi === "function"
    ? acquireVsCodeApi()
    : {
        postMessage: (message) => {
            console.log("Webview message", message);
        },
    };
let state = {
    baseUrl: "",
    email: "",
    oauthConfigured: false,
    apiTokenConfigured: false,
};
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function render() {
    const root = document.getElementById("root");
    if (!root) {
        return;
    }
    const oauthStatus = state.oauthConfigured ? "Configured" : "Missing";
    const oauthStatusClass = state.oauthConfigured ? "status-ok" : "status-missing";
    const oauthDisabled = state.oauthConfigured ? "" : "disabled";
    const apiStatus = state.apiTokenConfigured ? "Configured" : "Missing";
    const apiStatusClass = state.apiTokenConfigured ? "status-ok" : "status-missing";
    root.innerHTML = `
    <h1>Connect to Atlassian</h1>

    <div class="card">
      <h2>API Token</h2>
      <p class="note">API settings: <span class="status ${apiStatusClass}">${apiStatus}</span></p>
      <div class="row">
        <label for="baseUrl">Jira site URL</label>
        <input id="baseUrl" type="text" placeholder="https://your-domain.atlassian.net" value="${escapeHtml(state.baseUrl)}" />
      </div>
      <div class="row">
        <label for="email">Atlassian account email</label>
        <input id="email" type="email" placeholder="you@company.com" value="${escapeHtml(state.email)}" />
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
      <p class="note">
        Requires an Atlassian OAuth app with a redirect URL. Configure client ID and secret in VS Code
        Settings.
      </p>
      <p class="note">OAuth settings: <span class="status ${oauthStatusClass}">${oauthStatus}</span></p>
      <div class="actions">
        <button id="openSettings" class="secondary">Open Settings</button>
        <button id="startOAuth" ${oauthDisabled}>Start OAuth Login</button>
      </div>
    </div>
  `;
    const saveButton = document.getElementById("saveToken");
    saveButton?.addEventListener("click", () => {
        const baseUrl = document.getElementById("baseUrl")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const apiToken = document.getElementById("apiToken")?.value.trim();
        if (!baseUrl || !email || !apiToken) {
            vscode.postMessage({ type: "error", message: "All fields are required." });
            return;
        }
        vscode.postMessage({ type: "saveApiToken", baseUrl, email, apiToken });
    });
    const startOAuth = document.getElementById("startOAuth");
    startOAuth?.addEventListener("click", () => {
        vscode.postMessage({ type: "startOAuth" });
    });
    const openSettings = document.getElementById("openSettings");
    openSettings?.addEventListener("click", () => {
        vscode.postMessage({ type: "openSettings" });
    });
}
window.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.type === "init" && data.payload) {
        state = data.payload;
        render();
    }
});
render();
vscode.postMessage({ type: "ready" });
//# sourceMappingURL=main.js.map