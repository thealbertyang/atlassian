export type RouteName = string;
export type RouteHint = {
  name?: RouteName;
  path?: string;
  issueKey?: string;
  query?: Record<string, string>;
};

export const DEFAULT_ROUTE_PATH = "/overview";

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
  if (segments[0] === "jira") {
    if (segments.length === 2 && segments[1] !== "issues") {
      return `/jira/issues/${segments[1]}`;
    }
    if (segments.length === 1) {
      return "/jira";
    }
  }
  return prefixed || DEFAULT_ROUTE_PATH;
};

export const extractIssueKey = (path: string): string | undefined => {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "jira") {
    return undefined;
  }
  if (segments[1] === "issues" && segments[2]) {
    return segments[2];
  }
  return segments[1] && segments[1] !== "issues" ? segments[1] : undefined;
};

export const routeHintToPath = (hint?: RouteHint): string => {
  if (!hint) {
    return DEFAULT_ROUTE_PATH;
  }
  if (hint.path) {
    return normalizeRoutePath(hint.path);
  }
  if (hint.name === "overview") {
    return "/overview";
  }
  if (hint.name === "jira") {
    return hint.issueKey ? `/jira/issues/${hint.issueKey}` : "/jira";
  }
  if (hint.name) {
    return normalizeRoutePath(hint.name);
  }
  return DEFAULT_ROUTE_PATH;
};

export type HashState = {
  path: string;
  query: URLSearchParams;
};

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
