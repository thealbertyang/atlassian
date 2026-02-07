import type { Uri, UriHandler } from "vscode";
import { log } from "../providers/data/atlassian/logger";
import { parseAnyLink } from "../../shared/link";
import { resolveWebviewRoute, type WebviewRoute } from "./webview-route";

type UriHandlerDeps = {
  showApp: () => Promise<void>;
  navigate: (route: WebviewRoute) => void | Promise<void>;
};

/**
 * Handles `vscode://` and `vscode-insiders://` URIs for deep link navigation.
 *
 * **Navigation flow:**
 * 1. Parse the URI into a route (via {@link parseAnyLink} or legacy {@link resolveWebviewRoute}).
 * 2. Call `navigate()` FIRST — this sets `ViewProviderPanel.initialRoute` so that
 *    {@link ViewProviderPanel.injectInitialRoute} can embed the target hash in the HTML.
 * 3. Call `showApp()` — this reveals/creates the panel. If the panel is freshly created,
 *    `injectInitialRoute` uses the route set in step 2. If already visible, the IPC
 *    NAVIGATE command (sent by `requestNavigate`) handles it.
 */
export class AtlassianUriHandler implements UriHandler {
  constructor(private readonly deps: UriHandlerDeps) {}

  async handleUri(uri: Uri): Promise<void> {
    const parsed = parseAnyLink(uri.toString());
    if (parsed) {
      log(`URI handler triggered: ${uri.toString()} (parsed.to=${parsed.to})`);
      // Navigate BEFORE showApp so initialRoute is set for HTML injection.
      await this.deps.navigate({ path: parsed.to, query: parsed.search });
      await this.deps.showApp();
      return;
    }

    // Fallback to legacy route resolution
    const route = resolveWebviewRoute(uri);
    log(`URI handler triggered: ${uri.toString()} (route=${route?.name ?? "none"})`);
    if (route) {
      await this.deps.navigate(route);
    }
    await this.deps.showApp();
  }
}
