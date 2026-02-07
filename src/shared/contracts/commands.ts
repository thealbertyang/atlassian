import type { RouteName } from "./routes";

export const VSCODE_COMMANDS = {
  OPEN_APP: "atlassian.openApp",
  LOGIN: "atlassian.login",
  LOGOUT: "atlassian.logout",
  REFRESH: "atlassian.refresh",
  RUN_DEV_WEBVIEW: "atlassian.runDevWebview",
  RESTART_EXTENSION_HOST: "atlassian.restartExtensionHost",
  RELOAD_WEBVIEWS: "atlassian.reloadWebviews",
  SYNC_ENV_TO_SETTINGS: "atlassian.syncEnvToSettings",
  REINSTALL_EXTENSION: "atlassian.reinstallExtension",
  OPEN_ISSUE: "atlassian.openIssue",
} as const;

export type VscodeCommandId = (typeof VSCODE_COMMANDS)[keyof typeof VSCODE_COMMANDS];

export const RPC_METHODS = {
  SHOW_INFORMATION: "showInformation",
  GET_THEME: "getTheme",
  SET_THEME: "setTheme",
  ON_THEME_CHANGE: "onThemeChange",
  REGISTER_CHANNEL: "registerChannel",
  UNREGISTER_CHANNEL: "unregisterChannel",
  SEND_MESSAGE: "sendMessage",
  ADD_MESSAGE_LISTENER: "addMessageListener",
  RM_MESSAGE_LISTENER: "rmMessageListener",
  EXEC_COMMAND: "execCommand",
  AXIOS_GET: "axiosGet",
  AXIOS_POST: "axiosPost",
  AXIOS_PUT: "axiosPut",
  AXIOS_DELETE: "axiosDelete",
  ON_DID_OPEN_TEXT_DOCUMENT: "onDidOpenTextDocument",
  GET_STATE: "getState",
  GET_ISSUE: "getIssue",
  LIST_ISSUES: "listIssues",
  GET_TRIAGE_STATE: "getTriageState",
  RUN_TRIAGE: "runTriage",
  GET_DOCS_INDEX: "getDocsIndex",
  GET_DOC_CONTENT: "getDocContent",
  REVEAL_DOC_ASSET: "revealDocAsset",
  SAVE_API_TOKEN: "saveApiToken",
  DISCONNECT: "disconnect",
  OPEN_SETTINGS: "openSettings",
  SYNC_ENV_TO_SETTINGS: "syncEnvToSettings",
  OPEN_ISSUE_IN_BROWSER: "openIssueInBrowser",
  REINSTALL_EXTENSION: "reinstallExtension",
  RUN_DEV_WEBVIEW: "runDevWebview",
  RESTART_EXTENSION_HOST: "restartExtensionHost",
  RELOAD_WEBVIEWS: "reloadWebviews",
  START_DEV_TASK_TERMINAL: "startDevTaskTerminal",
  GET_AUTOMATIONS: "getAutomations",
  GET_AUTOMATION_RUNS: "getAutomationRuns",
  GET_UNIVERSAL_CONFIG: "getUniversalConfig",
} as const;

export type RpcMethod = (typeof RPC_METHODS)[keyof typeof RPC_METHODS];

export type ActionDefinition = {
  id: string;
  rpc?: RpcMethod;
  vscode?: VscodeCommandId;
  route?: RouteName;
  description?: string;
};

export const ACTIONS = {
  APP_OPEN: {
    id: "atlassian.app.open",
    vscode: VSCODE_COMMANDS.OPEN_APP,
    route: "overview",
  },
  APP_LOGIN: {
    id: "atlassian.app.login",
    vscode: VSCODE_COMMANDS.LOGIN,
    route: "setup",
  },
  APP_LOGOUT: {
    id: "atlassian.app.logout",
    vscode: VSCODE_COMMANDS.LOGOUT,
  },
  APP_REFRESH: {
    id: "atlassian.app.refresh",
    vscode: VSCODE_COMMANDS.REFRESH,
  },
  ISSUE_OPEN: {
    id: "atlassian.issue.open",
    vscode: VSCODE_COMMANDS.OPEN_ISSUE,
    route: "jiraIssue",
  },
  DEV_RUN_WEBVIEW: {
    id: "atlassian.dev.runWebview",
    vscode: VSCODE_COMMANDS.RUN_DEV_WEBVIEW,
    rpc: RPC_METHODS.RUN_DEV_WEBVIEW,
  },
  DEV_RESTART_EXTENSION_HOST: {
    id: "atlassian.dev.restartExtensionHost",
    vscode: VSCODE_COMMANDS.RESTART_EXTENSION_HOST,
    rpc: RPC_METHODS.RESTART_EXTENSION_HOST,
  },
  DEV_RELOAD_WEBVIEWS: {
    id: "atlassian.dev.reloadWebviews",
    vscode: VSCODE_COMMANDS.RELOAD_WEBVIEWS,
    rpc: RPC_METHODS.RELOAD_WEBVIEWS,
  },
  DEV_SYNC_ENV: {
    id: "atlassian.dev.syncEnvToSettings",
    vscode: VSCODE_COMMANDS.SYNC_ENV_TO_SETTINGS,
    rpc: RPC_METHODS.SYNC_ENV_TO_SETTINGS,
  },
  DEV_REINSTALL_EXTENSION: {
    id: "atlassian.dev.reinstallExtension",
    vscode: VSCODE_COMMANDS.REINSTALL_EXTENSION,
    rpc: RPC_METHODS.REINSTALL_EXTENSION,
  },
  DEV_TASK_TERMINAL: {
    id: "atlassian.dev.startTaskTerminal",
    rpc: RPC_METHODS.START_DEV_TASK_TERMINAL,
  },
  UNIVERSAL_CONFIG_GET: {
    id: "atlassian.universal.getConfig",
    rpc: RPC_METHODS.GET_UNIVERSAL_CONFIG,
  },
  SETTINGS_OPEN: {
    id: "atlassian.settings.open",
    rpc: RPC_METHODS.OPEN_SETTINGS,
    route: "settings",
  },
  AUTH_SAVE_TOKEN: {
    id: "atlassian.auth.saveApiToken",
    rpc: RPC_METHODS.SAVE_API_TOKEN,
  },
  AUTH_DISCONNECT: {
    id: "atlassian.auth.disconnect",
    rpc: RPC_METHODS.DISCONNECT,
  },
  ISSUE_OPEN_BROWSER: {
    id: "atlassian.issue.openBrowser",
    rpc: RPC_METHODS.OPEN_ISSUE_IN_BROWSER,
  },
} as const satisfies Record<string, ActionDefinition>;

const actionsByRpc: Record<string, ActionDefinition> = {};
const actionsByCommand: Record<string, ActionDefinition> = {};

// `as const satisfies ...` preserves literal types, which makes `Object.values(ACTIONS)`
// a union of all literal objects (some without `rpc`/`vscode`). Widen to ActionDefinition.
(Object.values(ACTIONS) as ActionDefinition[]).forEach((action) => {
  if (action.rpc) {
    actionsByRpc[action.rpc] = action;
  }
  if (action.vscode) {
    actionsByCommand[action.vscode] = action;
  }
});

export const rpcActionId = (method: string): string => `atlassian.rpc.${method}`;

export const getActionByRpcMethod = (method: string): ActionDefinition => {
  return actionsByRpc[method] ?? { id: rpcActionId(method), rpc: method as RpcMethod };
};

export const getActionByVscodeCommand = (command: string): ActionDefinition => {
  return actionsByCommand[command] ?? {
    id: `atlassian.command.${command}`,
    vscode: command as VscodeCommandId,
  };
};
