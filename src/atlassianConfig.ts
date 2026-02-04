import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes: string;
  redirectPort: number;
}

export interface ApiTokenConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  jql: string;
}

export function getOAuthConfig(): OAuthConfig {
  const config = vscode.workspace.getConfiguration("atlassian");
  const env = getEnvMap();

  const clientId = getConfigString(config, "oauthClientId", "ATLASSIAN_OAUTH_CLIENT_ID", env);
  const clientSecret = getConfigString(
    config,
    "oauthClientSecret",
    "ATLASSIAN_OAUTH_CLIENT_SECRET",
    env,
  );
  const scopes =
    getConfigString(config, "oauthScopes", "ATLASSIAN_OAUTH_SCOPES", env) ||
    "read:jira-work offline_access";
  const redirectPort = getConfigNumber(
    config,
    "oauthRedirectPort",
    "ATLASSIAN_OAUTH_REDIRECT_PORT",
    env,
    8765,
  );

  return { clientId, clientSecret, scopes, redirectPort };
}

export function getApiTokenConfig(): ApiTokenConfig {
  const config = vscode.workspace.getConfiguration("atlassian");
  const env = getEnvMap();

  const baseUrl =
    getEnvValue(env, "JIRA_URL") ||
    getEnvValue(env, "ATLASSIAN_BASE_URL") ||
    resolveEnvPlaceholders(String(config.get("baseUrl") || config.get("jiraUrl") || ""), env);
  const email =
    getEnvValue(env, "JIRA_USER_EMAIL") ||
    getEnvValue(env, "ATLASSIAN_EMAIL") ||
    resolveEnvPlaceholders(String(config.get("email") || ""), env);
  const apiToken =
    getEnvValue(env, "JIRA_API_TOKEN") ||
    getEnvValue(env, "ATLASSIAN_API_TOKEN") ||
    resolveEnvPlaceholders(String(config.get("apiToken") || ""), env);
  const jql =
    getEnvValue(env, "JIRA_JQL") || resolveEnvPlaceholders(String(config.get("jql") || ""), env);

  return {
    baseUrl: baseUrl.trim(),
    email: email.trim(),
    apiToken: apiToken.trim(),
    jql: jql.trim(),
  };
}

function getConfigString(
  config: vscode.WorkspaceConfiguration,
  key: string,
  envKey: string,
  env: Record<string, string>,
): string {
  const inspected = config.inspect<string>(key);
  const currentValue =
    inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
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

function getConfigNumber(
  config: vscode.WorkspaceConfiguration,
  key: string,
  envKey: string,
  env: Record<string, string>,
  fallback: number,
): number {
  const inspected = config.inspect<number>(key);
  const currentValue =
    inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
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

function resolveEnvPlaceholders(value: string | undefined, env: Record<string, string>): string {
  if (!value) {
    return "";
  }

  return value.replace(/\$\{env:([^}]+)\}/g, (_match, name) => env[name] ?? "");
}

function getEnvValue(env: Record<string, string>, key: string): string {
  return env[key] ?? "";
}

function getEnvMap(): Record<string, string> {
  const merged: Record<string, string> = {};
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

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const result: Record<string, string> = {};

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

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}
