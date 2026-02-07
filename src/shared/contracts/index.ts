import { IPC_COMMANDS, IPC_EVENTS } from "./ipc";
import { ROUTE_META, DEFAULT_ROUTE_PATH } from "./routes";
import { ACTIONS, VSCODE_COMMANDS, RPC_METHODS } from "./commands";
import { SETTINGS_KEYS, SETTINGS_SECTION } from "./settings";
import { SETTINGS_REGISTRY, SETTINGS_REGISTRY_METADATA } from "./settings-registry";
import { LOGGING_RULES } from "./logging";

export * from "./ipc";
export * from "./routes";
export * from "./commands";
export * from "./settings";
export * from "./settings-registry";
export * from "./state";
export * from "./logging";
export * from "./intent";
export * from "./app-state";

export const CONTRACTS = {
  ipc: {
    commands: IPC_COMMANDS,
    events: IPC_EVENTS,
  },
  routes: ROUTE_META,
  defaultRoute: DEFAULT_ROUTE_PATH,
  actions: ACTIONS,
  rpc: RPC_METHODS,
  commands: VSCODE_COMMANDS,
  settings: {
    section: SETTINGS_SECTION,
    keys: SETTINGS_KEYS,
    registry: SETTINGS_REGISTRY,
    metadata: SETTINGS_REGISTRY_METADATA,
  },
  logging: LOGGING_RULES,
} as const;
