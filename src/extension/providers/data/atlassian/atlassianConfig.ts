import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { MASKED_SECRET } from "../../../constants";

export interface ApiTokenConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  jql: string;
}

export type ConfigSource = "env.local" | "env" | "process.env" | "settings" | "mixed" | "none";

const BASE_URL_KEYS = ["JIRA_URL", "ATLASSIAN_BASE_URL"];
const EMAIL_KEYS = ["JIRA_USER_EMAIL", "ATLASSIAN_EMAIL"];
const TOKEN_KEYS = ["JIRA_API_TOKEN", "ATLASSIAN_API_TOKEN"];

const isMaskedSecret = (value: string) => value.trim() === MASKED_SECRET;
const stripMaskedSecret = (value: string) => (isMaskedSecret(value) ? "" : value);

export function getWebviewDevServerUrl(): string {
  const config = vscode.workspace.getConfiguration("atlassian");
  const env = getEnvMap();
  const fromConfig = resolveEnvPlaceholders(String(config.get("webviewDevServerUrl") || ""), env);
  const fromEnv = getEnvValue(env, "ATLASSIAN_WEBVIEW_DEV_SERVER_URL");
  return (fromConfig || fromEnv).trim();
}

export function getWebviewDevPath(): string {
  const config = vscode.workspace.getConfiguration("atlassian");
  const env = getEnvMap();
  const fromConfig = resolveEnvPlaceholders(String(config.get("webviewDevPath") || ""), env);
  const fromEnv = getEnvValue(env, "ATLASSIAN_WEBVIEW_DEV_PATH");
  return (fromConfig || fromEnv).trim();
}

export function getDocsPath(): string {
  const config = vscode.workspace.getConfiguration("atlassian");
  const env = getEnvMap();
  const fromConfig = resolveEnvPlaceholders(String(config.get("docsPath") || ""), env);
  const fromEnv = getEnvValue(env, "ATLASSIAN_DOCS_PATH");
  return (fromConfig || fromEnv).trim();
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
  const apiToken = stripMaskedSecret(
    getEnvValue(env, "JIRA_API_TOKEN") ||
      getEnvValue(env, "ATLASSIAN_API_TOKEN") ||
      resolveEnvPlaceholders(String(config.get("apiToken") || ""), env),
  );
  const jql =
    getEnvValue(env, "JIRA_JQL") || resolveEnvPlaceholders(String(config.get("jql") || ""), env);

  return {
    baseUrl: baseUrl.trim(),
    email: email.trim(),
    apiToken: apiToken.trim(),
    jql: jql.trim(),
  };
}

export function getApiTokenConfigSource(): ConfigSource {
  const config = vscode.workspace.getConfiguration("atlassian");
  const folders = vscode.workspace.workspaceFolders ?? [];
  const envMap = getEnvMap();

  const values: ApiTokenConfig = {
    baseUrl: "",
    email: "",
    apiToken: "",
    jql: "",
  };
  const sources: Record<keyof Omit<ApiTokenConfig, "jql">, ConfigSource> = {
    baseUrl: "none",
    email: "none",
    apiToken: "none",
  };

  const applyEnv = (env: Record<string, string>, source: ConfigSource) => {
    const baseUrl = pickFirst(env, BASE_URL_KEYS);
    if (baseUrl) {
      values.baseUrl = baseUrl;
      sources.baseUrl = source;
    }
    const email = pickFirst(env, EMAIL_KEYS);
    if (email) {
      values.email = email;
      sources.email = source;
    }
    const apiToken = pickFirst(env, TOKEN_KEYS);
    if (apiToken) {
      values.apiToken = apiToken;
      sources.apiToken = source;
    }
  };

  for (const folder of folders) {
    const envPath = path.join(folder.uri.fsPath, ".env");
    const envLocalPath = path.join(folder.uri.fsPath, ".env.local");
    applyEnv(parseEnvFile(envPath), "env");
    applyEnv(parseEnvFile(envLocalPath), "env.local");
  }

  const processEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      processEnv[key] = value;
    }
  }
  applyEnv(processEnv, "process.env");

  if (!values.baseUrl) {
    const fromConfig = resolveEnvPlaceholders(
      String(config.get("baseUrl") || config.get("jiraUrl") || ""),
      envMap,
    ).trim();
    if (fromConfig) {
      values.baseUrl = fromConfig;
      sources.baseUrl = "settings";
    }
  }
  if (!values.email) {
    const fromConfig = resolveEnvPlaceholders(String(config.get("email") || ""), envMap).trim();
    if (fromConfig) {
      values.email = fromConfig;
      sources.email = "settings";
    }
  }
  if (!values.apiToken) {
    const fromConfigRaw = resolveEnvPlaceholders(
      String(config.get("apiToken") || ""),
      envMap,
    ).trim();
    if (fromConfigRaw) {
      values.apiToken = isMaskedSecret(fromConfigRaw) ? MASKED_SECRET : fromConfigRaw;
      sources.apiToken = "settings";
    }
  }

  if (!values.baseUrl || !values.email || !values.apiToken) {
    return "none";
  }

  const uniqueSources = new Set<ConfigSource>([
    sources.baseUrl,
    sources.email,
    sources.apiToken,
  ]);
  if (uniqueSources.size === 1) {
    return uniqueSources.values().next().value ?? "none";
  }

  return "mixed";
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

function pickFirst(env: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (value) {
      return value;
    }
  }
  return "";
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

export function parseEnvFile(filePath: string): Record<string, string> {
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
