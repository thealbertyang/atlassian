import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useHandlers } from "./hooks/use-handlers";
import { getVsCodeApi } from "./contexts/jsonrpc-rx-context";
import { AppContextProvider, type FormState } from "./contexts/app-context";
import type { JiraIssueDetails, WebviewState } from "./types/handlers";
import { createWebviewIpc } from "./ipc";
import { IPC_COMMANDS, IPC_EVENTS } from "../../shared/ipc-contract";
import {
  DEFAULT_ROUTE_PATH,
  extractIssueKey,
  normalizeRoutePath,
  routeHintToPath,
  type RouteHint,
} from "../../shared/route-contract";
import { TAB_ROUTES, type TabRoute } from "./route-tabs";
import { MASKED_SECRET } from "./constants";
import "./App.css";

type AppProps = {
  children: ReactNode;
};

type RouteName = string;

type Breadcrumb = {
  label: string;
  path: string;
};

const EMPTY_STATE: WebviewState = {
  baseUrl: "",
  email: "",
  apiTokenConfigured: false,
  configSource: "none",
  authType: "none",
  hasStoredToken: false,
  devMode: false,
  extensionId: "",
  uriScheme: "",
};

const isWebview =
  typeof window !== "undefined" && typeof (window as any).acquireVsCodeApi === "function";

const formatTimestamp = (value: number | null | undefined) => {
  if (!value) {
    return "Not set";
  }
  return new Date(value).toLocaleString();
};

const toSearchParams = (value: unknown): URLSearchParams => {
  if (value instanceof URLSearchParams) {
    return value;
  }
  if (typeof value === "string") {
    return new URLSearchParams(value);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)] as [string, string]);
    return new URLSearchParams(entries);
  }
  return new URLSearchParams();
};

function App({ children }: AppProps) {
  const handlers = useHandlers();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const ipcRef = useRef<ReturnType<typeof createWebviewIpc> | null>(null);
  const initialRouteApplied = useRef(false);

  const [state, setState] = useState<WebviewState>(EMPTY_STATE);
  const [form, setForm] = useState<FormState>({
    baseUrl: "",
    email: "",
    apiToken: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState<JiraIssueDetails | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState("");

  const pathname = normalizeRoutePath(location.pathname || DEFAULT_ROUTE_PATH);
  const searchParams = useMemo(() => toSearchParams(location.search), [location.search]);
  const pathSegments = pathname.split("/").filter(Boolean);
  const activeSegment = pathSegments[0] || "overview";
  const routeName = activeSegment as RouteName;
  const issueKey = extractIssueKey(pathname)?.toUpperCase();

  const status = useMemo(() => {
    const isConnected = state.apiTokenConfigured;
    const source =
      state.configSource === "env.local"
        ? ".env.local"
        : state.configSource === "env"
          ? ".env"
          : state.configSource === "process.env"
            ? "Environment"
            : state.configSource === "settings"
              ? "Settings"
              : state.configSource === "mixed"
                ? "Mixed"
                : "Not configured";
    return { isConnected, source };
  }, [state]);

  const issueView = searchParams.get("view") === "compact" ? "compact" : "full";
  const authLabel =
    state.authType === "oauth" ? "OAuth 2.0" : state.authType === "apiToken" ? "API token" : "";

  const loadState = async () => {
    if (!isWebview) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextState = await handlers.getState();
      setState(nextState);
      const shouldMaskToken = Boolean(nextState.apiTokenConfigured && nextState.authType !== "oauth");
      setForm((prev) => ({
        baseUrl: nextState.baseUrl || prev.baseUrl,
        email: nextState.email || prev.email,
        apiToken: shouldMaskToken ? MASKED_SECRET : "",
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load state.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    if (!isWebview || initialRouteApplied.current) {
      return;
    }
    const hint = (window as any).__atlassianRoute as RouteHint | undefined;
    if (!hint) {
      return;
    }
    initialRouteApplied.current = true;
    const target = normalizeRoutePath(routeHintToPath(hint));
    navigate({
      to: target,
      search: hint.query ?? {},
      replace: true,
    });
  }, [navigate]);

  useEffect(() => {
    if (!isWebview) {
      return;
    }
    const vscodeApi = getVsCodeApi();
    const ipc = createWebviewIpc(vscodeApi.postMessage.bind(vscodeApi));
    ipcRef.current = ipc;
    const disposeNavigate = ipc.onCommand(IPC_COMMANDS.NAVIGATE, (payload) => {
      const routePayload = payload as { route?: RouteHint | string } | undefined;
      const route = routePayload?.route ?? payload;
      if (typeof route === "string") {
        const trimmed = route.trim();
        const target = normalizeRoutePath(trimmed);
        navigate({ to: target });
        return;
      }
      if (route) {
        const hint = route as RouteHint;
        const target = normalizeRoutePath(routeHintToPath(hint));
        navigate({ to: target, search: hint.query ?? {} });
      }
    });
    ipc.sendEvent(IPC_EVENTS.WEBVIEW_READY);
    return () => {
      disposeNavigate();
      ipc.dispose();
      ipcRef.current = null;
    };
  }, [navigate]);

  useEffect(() => {
    if (!isWebview || !ipcRef.current) {
      return;
    }
    ipcRef.current.sendEvent(IPC_EVENTS.ROUTE_CHANGED, {
      path: pathname,
      query: Object.fromEntries(searchParams.entries()),
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isWebview) {
      return;
    }
    if (routeName !== "jira" || !issueKey) {
      setIssue(null);
      setIssueError("");
      return;
    }
    let cancelled = false;
    setIssueLoading(true);
    setIssueError("");
    handlers
      .getIssue(issueKey)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setIssue(result);
        if (!result) {
          setIssueError("Issue not found or not authorized.");
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load issue.";
        setIssueError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIssueLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handlers, issueKey, routeName]);

  const updateForm = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const saveToken = async () => {
    setError("");
    const baseUrl = form.baseUrl.trim();
    const email = form.email.trim();
    const rawToken = form.apiToken.trim();
    const hasExistingToken = Boolean(state.apiTokenConfigured) && state.authType !== "oauth";
    if (!baseUrl || !email || (!rawToken && !hasExistingToken)) {
      setError("All fields are required.");
      return;
    }
    const tokenToSave = rawToken || (hasExistingToken ? MASKED_SECRET : "");
    await handlers.saveApiToken(baseUrl, email, tokenToSave);
    await loadState();
  };

  const disconnect = async () => {
    setError("");
    await handlers.disconnect();
    await loadState();
  };

  const syncEnv = async () => {
    setError("");
    await handlers.syncEnvToSettings();
    await loadState();
  };

  const runDevWebview = async () => {
    setError("");
    await handlers.runDevWebview();
  };

  const restartExtensionHost = async () => {
    setError("");
    await handlers.restartExtensionHost();
  };

  const reloadWebviews = async () => {
    setError("");
    await handlers.reloadWebviews();
  };

  const reinstallExtension = async () => {
    setError("");
    await handlers.reinstallExtension();
  };

  const openSettings = async () => {
    setError("");
    await handlers.openSettings();
  };

  const navigateTo = useCallback(
    (nextPath: string) => {
      navigate({ to: normalizeRoutePath(nextPath) });
    },
    [navigate],
  );

  const setIssueView = (view: "compact" | "full") => {
    if (routeName !== "jira" || !issueKey) {
      return;
    }
    navigate({
      to: `/jira/issues/${issueKey}`,
      search: (prev) => {
        const next = {
          ...(typeof prev === "object" && prev ? prev : {}),
        } as Record<string, string>;
        if (view === "full") {
          delete next.view;
        } else {
          next.view = "compact";
        }
        return next;
      },
      replace: true,
    });
  };

  const openIssueInBrowser = async () => {
    if (!issueKey) {
      return;
    }
    await handlers.openIssueInBrowser(issueKey);
  };

  const deepLinkBase =
    state.uriScheme && state.extensionId
      ? `${state.uriScheme}://${state.extensionId}`
      : "vscode://albertyang.atlassian-sprint-view";
  const deepPath = pathname === "/" ? "/open" : `/open${pathname}`;
  const deepLinkUrl = `${deepLinkBase}${deepPath}${
    searchParams.toString() ? `?${searchParams}` : ""
  }`;

  const copyDeepLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(deepLinkUrl);
        handlers.showInformation("Link copied.");
        return;
      }
    } catch {
      // fall back to execCommand
    }
    const textArea = document.createElement("textarea");
    textArea.value = deepLinkUrl;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      handlers.showInformation("Link copied.");
    } catch {
      // ignore
    }
    document.body.removeChild(textArea);
  };

  const tabs = useMemo(() => TAB_ROUTES, []);
  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(pathname, tabs, issueKey),
    [pathname, tabs, issueKey],
  );

  return (
    <AppContextProvider
      value={{
        state,
        status,
        form,
        loading,
        error,
        isWebview,
        deepLinkBase,
        deepLinkUrl,
        copyDeepLink,
        updateForm,
        saveToken,
        disconnect,
        openSettings,
        syncEnv,
        runDevWebview,
        reloadWebviews,
        reinstallExtension,
        restartExtensionHost,
        formatTimestamp,
        issue,
        issueLoading,
        issueError,
        issueKey,
        issueView,
        setIssueView,
        openIssueInBrowser,
        navigate: navigateTo,
        routeName,
      }}
    >
      <div className="app">
        <header className="hero">
          <div className="hero-content">
            <div className="hero-title">Atlassian Sprint</div>
            <p className="hero-sub">
              Connect your Jira workspace, tune sprint settings, and run dev tooling without
              leaving VS Code.
            </p>
            <div className="hero-meta">
              <span className={`pill ${status.isConnected ? "pill-ok" : "pill-warn"}`}>
                {status.isConnected ? "Connected" : "Not connected"}
              </span>
              <span className="pill pill-muted">{status.source}</span>
              {authLabel ? <span className="pill pill-outline">{authLabel}</span> : null}
            </div>
          </div>
          <div className="hero-actions">
            {status.isConnected ? (
              <button className="danger" onClick={disconnect} disabled={loading}>
                Disconnect
              </button>
            ) : (
              <button onClick={() => navigateTo("/setup")} disabled={loading}>
                Configure
              </button>
            )}
          </div>
        </header>

        <nav className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.segment}
              type="button"
              className={`tab ${activeSegment === tab.segment ? "active" : ""}`}
              onClick={() => navigateTo(tab.path)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {breadcrumbs.length > 1 ? (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.path}-${index}`} className="crumb-item">
                <button type="button" className="crumb" onClick={() => navigateTo(crumb.path)}>
                  {crumb.label}
                </button>
                {index < breadcrumbs.length - 1 ? <span className="crumb-sep">/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}

        {error ? <div className="error">{error}</div> : null}
        {!isWebview ? (
          <div className="card">
            <h2>Webview Unavailable</h2>
            <p className="note">
              This UI is running outside VS Code. Open the extension webview panel to connect to
              Atlassian and use the dev controls.
            </p>
          </div>
        ) : null}

        {children}
      </div>
    </AppContextProvider>
  );
}

export default App;

const buildBreadcrumbs = (
  path: string,
  tabs: TabRoute[],
  issueKey?: string,
): Breadcrumb[] => {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [];
  }
  const crumbs: Breadcrumb[] = [];
  const tabMap = new Map(tabs.map((tab) => [tab.segment, tab]));
  segments.forEach((segment, index) => {
    const isRoot = index === 0;
    const routePath = `/${segments.slice(0, index + 1).join("/")}`;
    let label = segment;
    if (isRoot) {
      label = tabMap.get(segment)?.label ?? titleCase(segment);
    } else if (issueKey && segments[0] === "jira" && segments[1] === "issues" && index === 2) {
      label = issueKey;
    } else {
      label = titleCase(segment);
    }
    crumbs.push({ label, path: routePath });
  });
  return crumbs;
};

const titleCase = (value: string): string =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
