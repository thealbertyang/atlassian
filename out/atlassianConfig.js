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
exports.getWebviewDevPath = getWebviewDevPath;
exports.getOAuthConfig = getOAuthConfig;
exports.getApiTokenConfig = getApiTokenConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function getWebviewDevPath() {
    const config = vscode.workspace.getConfiguration("atlassian");
    const env = getEnvMap();
    const fromConfig = resolveEnvPlaceholders(String(config.get("webviewDevPath") || ""), env);
    const fromEnv = getEnvValue(env, "ATLASSIAN_WEBVIEW_DEV_PATH");
    return (fromConfig || fromEnv).trim();
}
function getOAuthConfig() {
    const config = vscode.workspace.getConfiguration("atlassian");
    const env = getEnvMap();
    const clientId = getConfigString(config, "oauthClientId", "ATLASSIAN_OAUTH_CLIENT_ID", env);
    const clientSecret = getConfigString(config, "oauthClientSecret", "ATLASSIAN_OAUTH_CLIENT_SECRET", env);
    const scopes = getConfigString(config, "oauthScopes", "ATLASSIAN_OAUTH_SCOPES", env) ||
        "read:jira-work offline_access";
    const redirectPort = getConfigNumber(config, "oauthRedirectPort", "ATLASSIAN_OAUTH_REDIRECT_PORT", env, 8765);
    return { clientId, clientSecret, scopes, redirectPort };
}
function getApiTokenConfig() {
    const config = vscode.workspace.getConfiguration("atlassian");
    const env = getEnvMap();
    const baseUrl = getEnvValue(env, "JIRA_URL") ||
        getEnvValue(env, "ATLASSIAN_BASE_URL") ||
        resolveEnvPlaceholders(String(config.get("baseUrl") || config.get("jiraUrl") || ""), env);
    const email = getEnvValue(env, "JIRA_USER_EMAIL") ||
        getEnvValue(env, "ATLASSIAN_EMAIL") ||
        resolveEnvPlaceholders(String(config.get("email") || ""), env);
    const apiToken = getEnvValue(env, "JIRA_API_TOKEN") ||
        getEnvValue(env, "ATLASSIAN_API_TOKEN") ||
        resolveEnvPlaceholders(String(config.get("apiToken") || ""), env);
    const jql = getEnvValue(env, "JIRA_JQL") || resolveEnvPlaceholders(String(config.get("jql") || ""), env);
    return {
        baseUrl: baseUrl.trim(),
        email: email.trim(),
        apiToken: apiToken.trim(),
        jql: jql.trim(),
    };
}
function getConfigString(config, key, envKey, env) {
    const inspected = config.inspect(key);
    const currentValue = inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
    const resolvedCurrent = resolveEnvPlaceholders(currentValue, env).trim();
    if (resolvedCurrent) {
        return resolvedCurrent;
    }
    const envValue = env[envKey]?.trim();
    if (envValue) {
        return envValue;
    }
    const defaultValue = resolveEnvPlaceholders(inspected?.defaultValue, env).trim();
    return defaultValue;
}
function getConfigNumber(config, key, envKey, env, fallback) {
    const inspected = config.inspect(key);
    const currentValue = inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
    if (typeof currentValue === "number") {
        return currentValue;
    }
    const envValue = env[envKey];
    if (envValue) {
        const parsed = Number(envValue);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    if (typeof inspected?.defaultValue === "number") {
        return inspected.defaultValue;
    }
    return fallback;
}
function resolveEnvPlaceholders(value, env) {
    if (!value) {
        return "";
    }
    return value.replace(/\$\{env:([^}]+)\}/g, (_match, name) => env[name] ?? "");
}
function getEnvValue(env, key) {
    return env[key] ?? "";
}
function getEnvMap() {
    const merged = {};
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
        const envPath = path.join(folder.uri.fsPath, ".env");
        const envLocalPath = path.join(folder.uri.fsPath, ".env.local");
        Object.assign(merged, parseEnvFile(envPath));
        Object.assign(merged, parseEnvFile(envLocalPath));
    }
    for (const [key, value] of Object.entries(process.env)) {
        if (typeof value === "string") {
            merged[key] = value;
        }
    }
    return merged;
}
function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    const contents = fs.readFileSync(filePath, "utf8");
    const result = {};
    for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
        const match = normalized.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) {
            continue;
        }
        const key = match[1];
        let value = match[2] ?? "";
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}
//# sourceMappingURL=atlassianConfig.js.map