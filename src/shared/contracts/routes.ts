export type RouteName = string;

export type RouteHint = {
  name?: RouteName;
  path?: string;
  issueKey?: string;
  query?: Record<string, string>;
};

export type RouteMeta = {
  id: RouteName;
  segment: string;
  path: string;
  stage?: string;
  tabLabel?: string;
  tabOrder?: number;
  tabHidden?: boolean;
  redirect?: string;
};

export const ROUTE_META = {
  // --- Plan stage ---
  plan: {
    id: "plan",
    segment: "plan",
    path: "/plan",
    stage: "plan",
    tabLabel: "Daily",
    tabOrder: 1,
  },
  planWeekly: {
    id: "planWeekly",
    segment: "plan/weekly",
    path: "/plan/weekly",
    stage: "plan",
    tabLabel: "Weekly",
    tabOrder: 2,
    tabHidden: true,
  },
  planMonthly: {
    id: "planMonthly",
    segment: "plan/monthly",
    path: "/plan/monthly",
    stage: "plan",
    tabLabel: "Monthly",
    tabOrder: 3,
    tabHidden: true,
  },
  planQuarterly: {
    id: "planQuarterly",
    segment: "plan/quarterly",
    path: "/plan/quarterly",
    stage: "plan",
    tabLabel: "Quarterly",
    tabOrder: 4,
    tabHidden: true,
  },
  planCareer: {
    id: "planCareer",
    segment: "plan/career",
    path: "/plan/career",
    stage: "plan",
    tabLabel: "Career",
    tabOrder: 5,
    tabHidden: true,
  },

  // --- Execute stage ---
  execute: {
    id: "execute",
    segment: "execute",
    path: "/execute",
    stage: "execute",
    tabLabel: "Tasks",
    tabOrder: 10,
  },
  executeAutomations: {
    id: "executeAutomations",
    segment: "execute/automations",
    path: "/execute/automations",
    stage: "execute",
    tabHidden: true,
    redirect: "/execute",
  },

  // --- Review stage ---
  review: {
    id: "review",
    segment: "review",
    path: "/review",
    stage: "review",
    tabLabel: "Review",
    tabOrder: 20,
  },
  reviewIssue: {
    id: "reviewIssue",
    segment: "review/issues",
    path: "/review/issues/:key",
    stage: "review",
    tabHidden: true,
  },

  // --- Ship stage ---
  ship: {
    id: "ship",
    segment: "ship",
    path: "/ship",
    stage: "ship",
    tabLabel: "Ship",
    tabOrder: 30,
  },

  // --- Observe stage ---
  observe: {
    id: "observe",
    segment: "observe",
    path: "/observe",
    stage: "observe",
    tabLabel: "Observe",
    tabOrder: 40,
  },

  // --- System (gear) ---
  systemSetup: {
    id: "systemSetup",
    segment: "system/setup",
    path: "/system/setup",
    stage: "system",
    tabHidden: true,
    redirect: "/system/settings",
  },
  systemRegistry: {
    id: "systemRegistry",
    segment: "system/registry",
    path: "/system/registry",
    stage: "system",
    tabHidden: true,
  },
  systemSettings: {
    id: "systemSettings",
    segment: "system/settings",
    path: "/system/settings",
    stage: "system",
    tabLabel: "Settings",
    tabOrder: 90,
    tabHidden: true,
  },
  systemDev: {
    id: "systemDev",
    segment: "system/dev",
    path: "/system/dev",
    stage: "system",
    tabHidden: true,
    redirect: "/system/settings",
  },
  systemDocs: {
    id: "systemDocs",
    segment: "system/docs",
    path: "/system/docs",
    stage: "system",
    tabLabel: "Docs",
    tabOrder: 93,
    tabHidden: true,
  },

  // --- Universal intent dispatcher (internal) ---
  intent: {
    id: "intent",
    segment: "intent",
    path: "/intent",
    tabHidden: true,
  },
  // --- Universal app dispatcher (internal) ---
  appDispatch: {
    id: "appDispatch",
    segment: "app",
    path: "/app/$",
    tabHidden: true,
  },

  // --- Legacy redirects ---
  overview: {
    id: "overview",
    segment: "overview",
    path: "/overview",
    tabHidden: true,
    redirect: "/plan",
  },
  setup: {
    id: "setup",
    segment: "setup",
    path: "/setup",
    tabHidden: true,
    redirect: "/system/setup",
  },
  settings: {
    id: "settings",
    segment: "settings",
    path: "/settings",
    tabHidden: true,
    redirect: "/system/settings",
  },
  jira: {
    id: "jira",
    segment: "jira",
    path: "/jira",
    tabHidden: true,
    redirect: "/review",
  },
  jiraIssue: {
    id: "jiraIssue",
    segment: "jira/issues",
    path: "/jira/issues/:key",
    tabHidden: true,
  },
  automations: {
    id: "automations",
    segment: "automations",
    path: "/automations",
    tabHidden: true,
    redirect: "/execute/automations",
  },
  dev: {
    id: "dev",
    segment: "dev",
    path: "/dev",
    tabHidden: true,
    redirect: "/system/dev",
  },
  docs: {
    id: "docs",
    segment: "docs",
    path: "/docs",
    tabHidden: true,
    redirect: "/system/docs",
  },
} as const satisfies Record<string, RouteMeta>;

export const DEFAULT_ROUTE_PATH = "/plan";

/** Maps old paths to new paths for backward compatibility. */
const LEGACY_REDIRECTS: Record<string, string> = {
  "/overview": "/plan",
  "/setup": "/system/settings",
  "/settings": "/system/settings",
  "/system/setup": "/system/settings",
  "/jira": "/review",
  "/automations": "/execute",
  "/execute/automations": "/execute",
  "/dev": "/system/settings",
  "/system/dev": "/system/settings",
  "/docs": "/system/docs",
};

// Keep local to avoid a circular dependency with `intent.ts` (which imports from this module).
const APP_DISPATCH_KINDS = new Set([
  "route",
  "doc",
  "runbook",
  "plan",
  "skill",
  "automation",
  "command",
  "rpc",
  "action",
]);

/**
 * Normalizes a route path to its canonical form.
 *
 * - Enforces leading `/`
 * - Strips trailing slashes
 * - Applies legacy redirects (e.g., `/jira/ABC-123` → `/review/issues/ABC-123`)
 * - Expands shorthands (e.g., `/review/ABC-123` → `/review/issues/ABC-123`)
 *
 * Returns {@link DEFAULT_ROUTE_PATH} for empty/falsy input.
 *
 * **Important:** This operates on *route* paths only (e.g., `/plan`, `/review/issues/X`).
 * Do NOT pass dispatcher-wrapped paths like `/app/atlassian/route/plan` — use
 * {@link buildAppDispatcherPath} and {@link isAppDispatcherPath} for those.
 */
export const normalizeRoutePath = (value?: string | null): string => {
  if (!value) {
    return DEFAULT_ROUTE_PATH;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_ROUTE_PATH;
  }
  const cleaned = trimmed.replace(/\/+$/, "");
  const prefixed = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const segments = prefixed.split("/").filter(Boolean);

  // Handle legacy /jira/ISSUE-KEY shorthand → /review/issues/ISSUE-KEY
  if (segments[0] === "jira") {
    if (segments.length === 2 && segments[1] !== "issues") {
      return `/review/issues/${segments[1]}`;
    }
    if (segments[1] === "issues" && segments[2]) {
      return `/review/issues/${segments[2]}`;
    }
    return "/review";
  }

  // Handle legacy /review/ISSUE-KEY shorthand → /review/issues/ISSUE-KEY
  if (segments[0] === "review") {
    if (segments.length === 2 && segments[1] !== "issues") {
      return `/review/issues/${segments[1]}`;
    }
  }

  // Apply legacy redirects for exact matches
  const redirect = LEGACY_REDIRECTS[prefixed];
  if (redirect) {
    return redirect;
  }

  return prefixed || DEFAULT_ROUTE_PATH;
};

/** Extracts a Jira issue key from a route path (e.g., `/review/issues/ABC-123` → `"ABC-123"`). */
export const extractIssueKey = (path: string): string | undefined => {
  const segments = path.split("/").filter(Boolean);
  // Support both /review/issues/KEY and legacy /jira/issues/KEY
  if (segments[0] === "review" || segments[0] === "jira") {
    if (segments[1] === "issues" && segments[2]) {
      return segments[2];
    }
    // shorthand: /jira/KEY or /review/KEY
    if (segments[0] === "jira" && segments[1] && segments[1] !== "issues") {
      return segments[1];
    }
  }
  return undefined;
};

/**
 * Converts a {@link RouteHint} into a canonical route path.
 *
 * Resolves named routes (`{name: "jira"}` → `/review`), issue shortcuts
 * (`{name: "jira", issueKey: "ABC-123"}` → `/review/issues/ABC-123`),
 * and explicit paths (`{path: "/plan"}` → `/plan`).
 *
 * Used by the extension host to resolve deep link navigation targets and by
 * the webview to restore persisted routes.
 */
export const routeHintToPath = (hint?: RouteHint): string => {
  if (!hint) {
    return DEFAULT_ROUTE_PATH;
  }
  if (hint.path) {
    return normalizeRoutePath(hint.path);
  }
  // Legacy name mappings
  if (hint.name === "overview") {
    return "/plan";
  }
  if (hint.name === "plan") {
    return "/plan";
  }
  if (hint.name === "jira" || hint.name === "review") {
    return hint.issueKey ? `/review/issues/${hint.issueKey}` : "/review";
  }
  if (hint.name === "setup" || hint.name === "settings") {
    return "/system/settings";
  }
  if (hint.name === "automations") {
    return "/execute";
  }
  if (hint.name === "execute") {
    return "/execute";
  }
  if (hint.name === "dev") {
    return "/system/settings";
  }
  if (hint.name === "docs") {
    return "/system/docs";
  }
  if (hint.name) {
    return normalizeRoutePath(hint.name);
  }
  return DEFAULT_ROUTE_PATH;
};

/** Derives the stage id from a pathname. */
export const stageFromPath = (pathname: string): string => {
  const segments = pathname.split("/").filter(Boolean);
  const head = segments[0] || "plan";
  if (head === "system") return "system";
  if (head === "intent" || head === "app") return "system";
  // legacy (should normalize to /system/docs)
  if (head === "docs") return "system";
  if (head === "plan") return "plan";
  if (head === "execute") return "execute";
  if (head === "review") return "review";
  if (head === "ship") return "ship";
  if (head === "observe") return "observe";
  return "plan";
};

export type HashState = {
  path: string;
  query: URLSearchParams;
};

/** Parses a hash-based route string (e.g., `#/plan?view=compact`) into path and query components. */
export const parseRouteHash = (hash: string): HashState => {
  if (!hash) {
    return { path: "/", query: new URLSearchParams() };
  }
  const cleaned = hash.replace(/^#/, "");
  const [rawPath, rawQuery] = cleaned.split("?");
  const path = normalizeRoutePath(rawPath || "/");
  const query = new URLSearchParams(rawQuery || "");
  return { path, query };
};

/** Builds a hash string from a route path and optional query (e.g., `#/plan?view=compact`). */
export const buildRouteHash = (
  path: string,
  query?: URLSearchParams | Record<string, string>,
): string => {
  const normalized = normalizeRoutePath(path);
  let search = "";
  if (query instanceof URLSearchParams) {
    search = query.toString();
  } else if (query) {
    search = new URLSearchParams(query).toString();
  }
  return `#${normalized}${search ? `?${search}` : ""}`;
};

/**
 * Builds the base URL prefix for deep links.
 *
 * - VS Code surface: `${uriScheme}://${extensionId}` (e.g., `vscode-insiders://pub.ext`)
 * - Browser surface: computed separately using `window.location.origin` + `#`
 */
export const buildDeepLinkBase = (uriScheme?: string, extensionId?: string): string => {
  if (uriScheme && extensionId) {
    return `${uriScheme}://${extensionId}`;
  }
  return "vscode://albertyang.atlassian-sprint-view";
};

/**
 * Constructs a full deep link URL by joining a base, path, and optional query.
 *
 * The `path` should already be well-formed — either a dispatcher path from
 * {@link buildAppDispatcherPath} (e.g., `/app/atlassian/route/plan`) or a
 * plain route path (e.g., `/plan`). No route normalization is applied here;
 * callers are responsible for providing the correct path format.
 *
 * @example
 * buildDeepLinkUrl("vscode://pub.ext", "/app/atlassian/route/plan")
 * // → "vscode://pub.ext/app/atlassian/route/plan"
 *
 * buildDeepLinkUrl("http://localhost:5173/#", "/app/atlassian/route/plan", { view: "compact" })
 * // → "http://localhost:5173/#/app/atlassian/route/plan?view=compact"
 */
export const buildDeepLinkUrl = (
  base: string,
  path: string,
  query?: Record<string, string>,
): string => {
  const prefixed = path.startsWith("/") ? path : `/${path}`;
  const search = query ? new URLSearchParams(query).toString() : "";
  return `${base}${prefixed}${search ? `?${search}` : ""}`;
};

/**
 * Wraps a route path in the universal app dispatcher format.
 *
 * The dispatcher path is used in deep links and URLs that route through the
 * `/app/{appId}/{kind}/...` dispatcher (which resolves intent kinds like
 * `route`, `action`, `command`, etc.).
 *
 * @example
 * buildAppDispatcherPath("atlassian", "/plan")
 * // → "/app/atlassian/route/plan"
 *
 * buildAppDispatcherPath("atlassian", "/review/issues/ABC-123")
 * // → "/app/atlassian/route/review/issues/ABC-123"
 */
export const buildAppDispatcherPath = (appId: string, routePath: string): string => {
  const normalized = normalizeRoutePath(routePath);
  return `/app/${appId}/route${normalized}`;
};

/**
 * Returns `true` when the path matches the app dispatcher format `/app/{appId}/{kind}/...`.
 *
 * Used to avoid double-wrapping paths that are already dispatcher-formatted.
 */
export const isAppDispatcherPath = (path: string): boolean => {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "app" || segments.length < 3) return false;
  return APP_DISPATCH_KINDS.has(segments[2]);
};

/** Raw deep link input before resolution. `path` is the URL pathname; `query` is the raw query string (no leading `?`). */
export type DeepLinkInput = {
  path: string;
  query?: string;
};

/**
 * Resolves a deep link path + query into a {@link RouteHint}.
 *
 * Handles these wrapper formats:
 * - `/open/plan`, `/openApp/plan` → `/plan` (legacy VS Code deep link wrappers)
 * - `/app/atlassian/route/plan` → `/plan` (universal dispatcher wrapper)
 * - `/plan?issue=ABC-123` → `/review/issues/ABC-123` (query-based shortcuts)
 * - `/jira/ABC-123` → `/review/issues/ABC-123` (via {@link normalizeRoutePath})
 *
 * @param input - Raw deep link path and optional query string (without scheme/host).
 * @returns A {@link RouteHint} with the resolved path, or `undefined` if unresolvable.
 */
export const resolveRouteFromDeepLink = (input: DeepLinkInput): RouteHint | undefined => {
  const path = input.path.replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const queryParams = new URLSearchParams(input.query || "");
  const queryRoute = queryParams.get("route") ?? undefined;
  const queryIssue = queryParams.get("issue") ?? undefined;
  queryParams.delete("route");
  queryParams.delete("issue");
  const query = Object.fromEntries(queryParams.entries());

  const normalizedQuery = Object.keys(query).length ? query : undefined;

  const fromQuery = () => {
    if (queryIssue) {
      return normalizeRoutePath(`/review/issues/${queryIssue}`);
    }
    if (queryRoute) {
      return normalizeRoutePath(queryRoute);
    }
    return undefined;
  };

  let resolvedPath: string | undefined;

  if (segments.length === 0) {
    resolvedPath = fromQuery();
  } else {
    const [head] = segments;
    if (head === "open" || head === "openApp") {
      const tail = segments.slice(1);
      if (tail.length === 0) {
        resolvedPath = fromQuery();
      } else {
        resolvedPath = normalizeRoutePath(`/${tail.join("/")}`);
      }
    } else if (head === "app") {
      const tail = segments.slice(1);
      // Universal dispatcher shape: /app/<appId>/<kind>/...
      // For "route" kind: extract the inner route path and auto-navigate.
      // For non-route kinds (action/command/rpc): keep the /app prefix so
      // the webview can show the dispatcher confirmation page.
      if (tail.length >= 2 && APP_DISPATCH_KINDS.has(tail[1] ?? "")) {
        const kind = tail[1];
        if (kind === "route") {
          // /app/{appId}/route/{routePath} → /{routePath}
          const innerPath = tail.slice(2).join("/");
          resolvedPath = normalizeRoutePath(innerPath ? `/${innerPath}` : "/");
        } else {
          // Non-route kinds go to the dispatcher page for user confirmation
          resolvedPath = `/${segments.join("/")}`;
        }
      } else if (tail.length === 0) {
        resolvedPath = fromQuery();
      } else {
        // Legacy wrapper shape: /app/<route...> (treat like /open)
        resolvedPath = normalizeRoutePath(`/${tail.join("/")}`);
      }
    } else {
      resolvedPath = normalizeRoutePath(`/${segments.join("/")}`);
    }
  }

  if (!resolvedPath) {
    return undefined;
  }

  const issueKey = extractIssueKey(resolvedPath) ?? queryIssue;
  const name = resolvedPath.split("/").filter(Boolean)[0];
  return {
    name,
    path: resolvedPath,
    issueKey,
    query: normalizedQuery,
  };
};
