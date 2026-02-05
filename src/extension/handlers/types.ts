import type { ExtensionContext } from "vscode";
import type { AtlassianClient } from "../providers/data/atlassian/atlassianClient";
import type { AtlassianIssuesProvider } from "../providers/data/atlassian/issueProvider";
import type { WebviewDevServer } from "../service/webview-dev-server";
import type { StorageService } from "../service/storage-service";

export type HandlerDependencies = {
  context: ExtensionContext;
  storage: StorageService;
  client: AtlassianClient;
  provider: AtlassianIssuesProvider;
  devWebviewServer: WebviewDevServer;
  extensionInstaller: import("../service/extension-installer").ExtensionInstaller;
  buildWatcher: import("../service/extension-build-watcher").ExtensionBuildWatcher;
  renderTracker: import("../service/webview-render-tracker").WebviewRenderTracker;
  showApp: () => Promise<void>;
  refreshApp: () => Promise<void>;
  closeApp: () => void;
};
