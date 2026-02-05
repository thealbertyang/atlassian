import type { RouteHint } from "./route-contract";

export const IPC_EVENTS = {
  WEBVIEW_READY: "webview-ready",
  ROUTE_CHANGED: "route-changed",
} as const;

export const IPC_COMMANDS = {
  NAVIGATE: "navigate",
  REFRESH_WEBVIEW: "refresh-webview",
} as const;

export type IpcEventName = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];
export type IpcCommandName = (typeof IPC_COMMANDS)[keyof typeof IPC_COMMANDS];

export type NavigatePayload = { route?: RouteHint | string };
export type RouteChangedPayload = { path: string; query?: Record<string, string> };
