import * as crypto from "crypto";
import * as http from "http";
import * as https from "https";
import { AddressInfo } from "net";
import * as vscode from "vscode";
import { getApiTokenConfig, getOAuthConfig } from "./atlassianConfig";
import { openExtensionSettings } from "../../../util/open-extension-settings";
import type { StorageService } from "../../../service/storage-service";

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  project: string;
}

export interface JiraIssueDetails extends JiraIssue {
  description?: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  created?: string;
  updated?: string;
  url?: string;
}

type AuthType = "apiToken" | "oauth";

interface ApiTokenAuth {
  type: "apiToken";
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface OAuthAuth {
  type: "oauth";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  cloudId: string;
  resourceUrl: string;
  resourceName: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface AccessibleResource {
  id: string;
  name: string;
  url: string;
  scopes?: string[];
}

const STORAGE_KEYS = {
  authType: "atlassian.authType",
  baseUrl: "atlassian.baseUrl",
  email: "atlassian.email",
  apiToken: "atlassian.apiToken",
  oauthAccessToken: "atlassian.oauthAccessToken",
  oauthRefreshToken: "atlassian.oauthRefreshToken",
  oauthExpiresAt: "atlassian.oauthExpiresAt",
  oauthCloudId: "atlassian.oauthCloudId",
  oauthResourceUrl: "atlassian.oauthResourceUrl",
  oauthResourceName: "atlassian.oauthResourceName",
} as const;

const ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
const OAUTH_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const OAUTH_AUTHORIZE_URL = "https://auth.atlassian.com/authorize";

export class AtlassianClient {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storage: StorageService,
  ) {}

  getAuthType(): AuthType | "none" {
    return this.storage.getGlobalState<AuthType>(STORAGE_KEYS.authType) ?? "none";
  }

  async hasStoredApiToken(): Promise<boolean> {
    const token = await this.storage.getSecret(STORAGE_KEYS.apiToken);
    return Boolean(token);
  }

  async isAuthenticated(): Promise<boolean> {
    return (await this.getAuth()) !== null;
  }

  async getApiTokenDefaults(): Promise<{ baseUrl: string; email: string }> {
    const envConfig = getApiTokenConfig();
    const baseUrl =
      envConfig.baseUrl || this.storage.getGlobalState<string>(STORAGE_KEYS.baseUrl) || "";
    const email =
      envConfig.email || this.storage.getGlobalState<string>(STORAGE_KEYS.email) || "";
    return { baseUrl, email };
  }

  async saveApiTokenAuth(baseUrlInput: string, email: string, apiToken: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(baseUrlInput);
    await this.storage.setGlobalState(STORAGE_KEYS.baseUrl, baseUrl);
    await this.storage.setGlobalState(STORAGE_KEYS.email, email.trim());
    await this.storage.storeSecret(STORAGE_KEYS.apiToken, apiToken.trim());
    await this.storage.setGlobalState(STORAGE_KEYS.authType, "apiToken");
  }

  async updateApiTokenDefaults(baseUrlInput?: string, email?: string): Promise<void> {
    if (baseUrlInput) {
      const baseUrl = normalizeBaseUrl(baseUrlInput);
      await this.storage.setGlobalState(STORAGE_KEYS.baseUrl, baseUrl);
    }
    if (email) {
      await this.storage.setGlobalState(STORAGE_KEYS.email, email.trim());
    }
  }

  async startOAuthFlow(): Promise<boolean> {
    const { clientId, clientSecret, scopes, redirectPort } = getOAuthConfig();

    if (!clientId || !clientSecret) {
      vscode.window.showWarningMessage(
        "Set Atlassian OAuth client ID and secret in Settings, or use an API token.",
      );
      await openExtensionSettings(this.context);
      return false;
    }

    const state = randomString(24);
    const codeVerifier = randomString(64);
    const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());

    const { redirectUri, waitForCode } = await startLocalAuthServer(state, redirectPort);

    const authUrl = new URL(OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.set("audience", "api.atlassian.com");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    vscode.window.showInformationMessage("Opening Atlassian OAuth login in your browser.");
    await vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));

    const code = await waitForCode;

    const token = await requestJson<OAuthTokenResponse>(OAUTH_TOKEN_URL, {
      method: "POST",
      body: {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      },
    });

    await this.saveOAuthTokens(token);
    await this.selectOAuthResource(token.access_token);
    await this.storage.setGlobalState(STORAGE_KEYS.authType, "oauth");
    return true;
  }

  async clearAuth(): Promise<void> {
    await this.storage.setGlobalState(STORAGE_KEYS.authType, undefined);
    await this.storage.deleteSecret(STORAGE_KEYS.apiToken);
    await this.storage.deleteSecret(STORAGE_KEYS.oauthAccessToken);
    await this.storage.deleteSecret(STORAGE_KEYS.oauthRefreshToken);
    await this.storage.setGlobalState(STORAGE_KEYS.oauthExpiresAt, undefined);
    await this.storage.setGlobalState(STORAGE_KEYS.oauthCloudId, undefined);
    await this.storage.setGlobalState(STORAGE_KEYS.oauthResourceUrl, undefined);
    await this.storage.setGlobalState(STORAGE_KEYS.oauthResourceName, undefined);
  }

  async getIssueUrl(key: string): Promise<string | null> {
    const auth = await this.getAuth();
    if (!auth) {
      return null;
    }
    const baseUrl = auth.type === "apiToken" ? auth.baseUrl : auth.resourceUrl;
    return `${baseUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(key)}`;
  }

  async searchMyOpenSprintIssues(): Promise<JiraIssue[]> {
    const auth = await this.getAuth();
    if (!auth) {
      const envConfig = getApiTokenConfig();
      if (envConfig.baseUrl && envConfig.email && envConfig.apiToken) {
        await this.saveApiTokenAuth(envConfig.baseUrl, envConfig.email, envConfig.apiToken);
        if (envConfig.jql) {
          await this.storage.updateSetting(
            "jql",
            envConfig.jql,
            vscode.ConfigurationTarget.Workspace,
          );
        }
        return this.searchMyOpenSprintIssues();
      }
      return [];
    }

    const envConfig = getApiTokenConfig();
    const jql = (envConfig.jql || this.storage.getSetting<string>("jql") || "").trim();
    const maxResults = Math.max(
      1,
      Math.min(100, this.storage.getSetting<number>("maxResults") ?? 50),
    );

    const fields = ["summary", "status", "issuetype", "project"].join(",");
    const query = new URLSearchParams({
      jql: jql || "assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC",
      maxResults: String(maxResults),
      fields,
    });

    let url: string;
    let headers: Record<string, string> = {};

    if (auth.type === "apiToken") {
      url = `${auth.baseUrl.replace(/\/$/, "")}/rest/api/3/search/jql?${query.toString()}`;
      const basic = Buffer.from(`${auth.email}:${auth.apiToken}`).toString("base64");
      headers = { Authorization: `Basic ${basic}` };
    } else {
      const accessToken = await this.getFreshOAuthToken();
      url = `https://api.atlassian.com/ex/jira/${auth.cloudId}/rest/api/3/search/jql?${query.toString()}`;
      headers = { Authorization: `Bearer ${accessToken}` };
    }

    const response = await requestJson<{ issues: Array<any> }>(url, {
      method: "GET",
      headers,
    });

    return response.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || "",
      status: issue.fields?.status?.name || "Unknown",
      issueType: issue.fields?.issuetype?.name || "Issue",
      project: issue.fields?.project?.key || "",
    }));
  }

  async getIssueDetails(key: string): Promise<JiraIssueDetails | null> {
    const auth = await this.getAuth();
    if (!auth) {
      return null;
    }

    const fields = [
      "summary",
      "status",
      "issuetype",
      "project",
      "priority",
      "assignee",
      "reporter",
      "created",
      "updated",
      "description",
    ].join(",");

    const query = new URLSearchParams({ fields });
    let url: string;
    let headers: Record<string, string> = {};

    if (auth.type === "apiToken") {
      url = `${auth.baseUrl.replace(/\/$/, "")}/rest/api/3/issue/${encodeURIComponent(
        key,
      )}?${query.toString()}`;
      const basic = Buffer.from(`${auth.email}:${auth.apiToken}`).toString("base64");
      headers = { Authorization: `Basic ${basic}` };
    } else {
      const accessToken = await this.getFreshOAuthToken();
      url = `https://api.atlassian.com/ex/jira/${auth.cloudId}/rest/api/3/issue/${encodeURIComponent(
        key,
      )}?${query.toString()}`;
      headers = { Authorization: `Bearer ${accessToken}` };
    }

    const issue = await requestJson<any>(url, { method: "GET", headers });
    const issueFields = issue.fields ?? {};

    return {
      key: issue.key || key,
      summary: issueFields.summary || "",
      status: issueFields.status?.name || "Unknown",
      issueType: issueFields.issuetype?.name || "Issue",
      project: issueFields.project?.key || "",
      priority: issueFields.priority?.name,
      assignee: issueFields.assignee?.displayName,
      reporter: issueFields.reporter?.displayName,
      created: issueFields.created,
      updated: issueFields.updated,
      description: formatDescription(issueFields.description),
      url: await this.getIssueUrl(key),
    };
  }

  private async getAuth(): Promise<ApiTokenAuth | OAuthAuth | null> {
    const authType = this.storage.getGlobalState<AuthType>(STORAGE_KEYS.authType);
    if (authType === "apiToken") {
      const baseUrl = this.storage.getGlobalState<string>(STORAGE_KEYS.baseUrl) ?? "";
      const email = this.storage.getGlobalState<string>(STORAGE_KEYS.email) ?? "";
      const apiToken = await this.storage.getSecret(STORAGE_KEYS.apiToken);
      if (!baseUrl || !email || !apiToken) {
        return null;
      }
      return { type: "apiToken", baseUrl, email, apiToken };
    }

    if (authType === "oauth") {
      const accessToken = await this.storage.getSecret(STORAGE_KEYS.oauthAccessToken);
      const refreshToken = await this.storage.getSecret(STORAGE_KEYS.oauthRefreshToken);
      const expiresAt = this.storage.getGlobalState<number>(STORAGE_KEYS.oauthExpiresAt);
      const cloudId = this.storage.getGlobalState<string>(STORAGE_KEYS.oauthCloudId) ?? "";
      const resourceUrl = this.storage.getGlobalState<string>(STORAGE_KEYS.oauthResourceUrl) ?? "";
      const resourceName =
        this.storage.getGlobalState<string>(STORAGE_KEYS.oauthResourceName) ?? "";
      if (!accessToken || !cloudId || !resourceUrl) {
        return null;
      }
      return {
        type: "oauth",
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt: expiresAt || undefined,
        cloudId,
        resourceUrl,
        resourceName,
      };
    }

    return null;
  }

  private async getFreshOAuthToken(): Promise<string> {
    const auth = await this.getAuth();
    if (!auth || auth.type !== "oauth") {
      throw new Error("Not authenticated with OAuth.");
    }

    const now = Date.now();
    if (!auth.expiresAt || auth.expiresAt - 60_000 > now) {
      return auth.accessToken;
    }

    if (!auth.refreshToken) {
      return auth.accessToken;
    }

    const { clientId, clientSecret } = getOAuthConfig();

    if (!clientId || !clientSecret) {
      return auth.accessToken;
    }

    const token = await requestJson<OAuthTokenResponse>(OAUTH_TOKEN_URL, {
      method: "POST",
      body: {
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: auth.refreshToken,
      },
    });

    await this.saveOAuthTokens(token);
    return token.access_token;
  }

  private async saveOAuthTokens(token: OAuthTokenResponse): Promise<void> {
    await this.storage.storeSecret(STORAGE_KEYS.oauthAccessToken, token.access_token);
    if (token.refresh_token) {
      await this.storage.storeSecret(STORAGE_KEYS.oauthRefreshToken, token.refresh_token);
    }
    if (token.expires_in) {
      await this.storage.setGlobalState(
        STORAGE_KEYS.oauthExpiresAt,
        Date.now() + token.expires_in * 1000,
      );
    }
  }

  private async selectOAuthResource(accessToken: string): Promise<void> {
    const resources = await requestJson<AccessibleResource[]>(ACCESSIBLE_RESOURCES_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!resources.length) {
      throw new Error("No accessible Jira resources found for this account.");
    }

    let selected = resources[0];
    if (resources.length > 1) {
      const pick = await vscode.window.showQuickPick(
        resources.map((resource) => ({
          label: resource.name,
          description: resource.url,
          resource,
        })),
        {
          placeHolder: "Select the Jira site to use",
        },
      );
      if (!pick) {
        throw new Error("No Jira site selected.");
      }
      selected = pick.resource;
    }

    await this.storage.setGlobalState(STORAGE_KEYS.oauthCloudId, selected.id);
    await this.storage.setGlobalState(STORAGE_KEYS.oauthResourceUrl, selected.url);
    await this.storage.setGlobalState(STORAGE_KEYS.oauthResourceName, selected.name);
  }
}

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/$/, "");
  if (!trimmed) {
    return trimmed;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function formatDescription(description: any): string | undefined {
  if (!description) {
    return undefined;
  }
  if (typeof description === "string") {
    return description;
  }
  if (typeof description === "object" && Array.isArray(description.content)) {
    const lines: string[] = [];
    const visit = (node: any) => {
      if (!node) {
        return;
      }
      if (node.type === "text" && typeof node.text === "string") {
        lines.push(node.text);
        return;
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(visit);
        if (node.type === "paragraph") {
          lines.push("\\n");
        }
      }
    };
    visit(description);
    const raw = lines.join("").replace(/\\n{3,}/g, "\\n\\n").trim();
    return raw || undefined;
  }
  return undefined;
}

async function startLocalAuthServer(
  expectedState: string,
  port: number,
): Promise<{ redirectUri: string; waitForCode: Promise<string> }> {
  let resolveCode: (code: string) => void;
  let rejectCode: (err: Error) => void;

  const waitForCode = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = http.createServer((req, res) => {
    if (!req.url || !req.headers.host) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid request.");
      rejectCode(new Error("Invalid OAuth callback request."));
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    if (requestUrl.pathname !== "/callback") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found.");
      return;
    }

    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");

    if (!code || state !== expectedState) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid OAuth response.");
      rejectCode(new Error("OAuth state mismatch."));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h2>Atlassian authentication complete.</h2><p>You can close this tab and return to VS Code.</p>",
    );
    resolveCode(code);
    server.close();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err) => reject(err));
    server.listen(port, "127.0.0.1", resolve);
  });
  const actualPort = (server.address() as AddressInfo).port;
  const redirectUri = `http://127.0.0.1:${actualPort}/callback`;

  const timeout = setTimeout(
    () => {
      rejectCode(new Error("OAuth login timed out."));
      server.close();
    },
    2 * 60 * 1000,
  );

  waitForCode.then(
    () => clearTimeout(timeout),
    () => clearTimeout(timeout),
  );

  return { redirectUri, waitForCode };
}

async function requestJson<T>(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: any },
): Promise<T> {
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  const body = options.body ? JSON.stringify(options.body) : undefined;
  if (body) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(body).toString();
  }

  const urlObj = new URL(url);
  const transport = urlObj.protocol === "http:" ? http : https;

  return new Promise<T>((resolve, reject) => {
    const req = transport.request(
      {
        method,
        hostname: urlObj.hostname,
        path: `${urlObj.pathname}${urlObj.search}`,
        port: urlObj.port,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) {
            if (!data) {
              resolve({} as T);
              return;
            }
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error("Failed to parse JSON response."));
            }
            return;
          }

          const message = data.length > 500 ? `${data.slice(0, 500)}...` : data;
          reject(new Error(`Request failed (${status}): ${message}`));
        });
      },
    );

    req.on("error", (err) => reject(err));

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function randomString(length: number): string {
  return base64Url(crypto.randomBytes(length));
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
