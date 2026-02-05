import type { Uri, UriHandler } from "vscode";
import { log } from "../providers/data/atlassian/logger";
import { resolveWebviewRoute, type WebviewRoute } from "./webview-route";

type UriHandlerDeps = {
  showApp: () => Promise<void>;
  navigate: (route: WebviewRoute) => void | Promise<void>;
};

export class AtlassianUriHandler implements UriHandler {
  constructor(private readonly deps: UriHandlerDeps) {}

  async handleUri(uri: Uri): Promise<void> {
    const route = resolveWebviewRoute(uri);
    log(`URI handler triggered: ${uri.toString()} (route=${route?.name ?? "none"})`);
    await this.deps.showApp();
    if (route) {
      await this.deps.navigate(route);
    }
  }
}
