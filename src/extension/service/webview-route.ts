import type { Uri } from "vscode";
import {
  extractIssueKey,
  normalizeRoutePath,
  type RouteHint,
} from "../../shared/route-contract";

export type WebviewRouteName = string;
export type WebviewRoute = RouteHint;

export const resolveWebviewRoute = (uri: Uri): WebviewRoute | undefined => {
  const path = uri.path.replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const queryParams = new URLSearchParams(uri.query);
  const queryRoute = queryParams.get("route") ?? undefined;
  const queryIssue = queryParams.get("issue") ?? undefined;
  queryParams.delete("route");
  queryParams.delete("issue");
  const query = Object.fromEntries(queryParams.entries());

  const normalizedQuery = Object.keys(query).length ? query : undefined;

  const fromQuery = () => {
    if (queryIssue) {
      return normalizeRoutePath(`/jira/issues/${queryIssue}`);
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
    if (head === "open" || head === "openApp" || head === "app") {
      const tail = segments.slice(1);
      if (tail.length === 0) {
        resolvedPath = fromQuery();
      } else {
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
