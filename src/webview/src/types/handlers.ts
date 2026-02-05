export type ConfigSource =
  | "env.local"
  | "env"
  | "process.env"
  | "settings"
  | "mixed"
  | "none";

export type WebviewState = {
  baseUrl: string;
  email: string;
  apiTokenConfigured: boolean;
  configSource: ConfigSource;
  authType?: "apiToken" | "oauth" | "none";
  hasStoredToken?: boolean;
  devMode?: boolean;
  extensionId?: string;
  uriScheme?: string;
  dev?: {
    lastExtensionBuildAt: number | null;
    lastWebviewRenderAt: number | null;
  };
};

export type JiraIssueDetails = {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  project: string;
  description?: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  created?: string;
  updated?: string;
  url?: string;
};

export type TextDocumentLike = {
  fileName?: string;
};

export type ObservableHandler<T> = {
  next: (value: T) => void;
};

export type HandlersType = {
  showInformation: (message: string) => void;
  getTheme: () => string;
  setTheme: (theme: string) => Promise<void>;
  onThemeChange: (observer: ObservableHandler<string>) => Promise<() => void>;
  registerChannel: (channel: string) => void;
  unregisterChannel: (channel: string) => boolean | Promise<boolean>;
  sendMessage: (channel: string, message: unknown) => Promise<string | void>;
  addMessageListener: (channel: string, listener: (msg: unknown) => void) => Promise<number>;
  rmMessageListener: (channel: string, listenerNumber: number) => boolean | Promise<boolean>;
  execCommand: (command: string, ...rest: unknown[]) => Promise<unknown>;
  axiosGet: (url: string, config?: unknown) => Promise<unknown>;
  axiosPost: (url: string, data?: unknown, config?: unknown) => Promise<unknown>;
  axiosPut: (url: string, data?: unknown, config?: unknown) => Promise<unknown>;
  axiosDelete: (url: string, config?: unknown) => Promise<unknown>;
  onDidOpenTextDocument: (observer: ObservableHandler<TextDocumentLike>) => Promise<() => void>;
  getState: () => Promise<WebviewState>;
  getIssue: (key: string) => Promise<JiraIssueDetails | null>;
  saveApiToken: (baseUrl: string, email: string, apiToken: string) => Promise<void>;
  disconnect: () => Promise<void>;
  openSettings: () => Promise<void>;
  syncEnvToSettings: () => Promise<void>;
  openIssueInBrowser: (key: string) => Promise<void>;
  reinstallExtension: () => Promise<void>;
  runDevWebview: () => Promise<void>;
  restartExtensionHost: () => Promise<void>;
  reloadWebviews: () => Promise<void>;
};
