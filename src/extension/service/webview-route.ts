import type { Uri } from "vscode";
import { resolveRouteFromDeepLink, type RouteHint } from "../../shared/contracts";

export type WebviewRouteName = string;
export type WebviewRoute = RouteHint;

export const resolveWebviewRoute = (uri: Uri): WebviewRoute | undefined => {
  return resolveRouteFromDeepLink({ path: uri.path, query: uri.query });
};
