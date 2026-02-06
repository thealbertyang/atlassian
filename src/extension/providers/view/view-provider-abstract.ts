import { ExtensionContext, Uri, Webview, WebviewPanel, WebviewView } from "vscode";
import { readFileSync } from "fs";
import { join } from "path";
import { parse as htmlParser } from "node-html-parser";
import { HandlerConfig, JsonrpcServer, expose } from "@jsonrpc-rx/server";
import { getRpcPayload } from "../../service/webview-ipc";

export type ViewProviderOptions = {
  distDir: string;
  indexPath: string;
};

export abstract class AbstractViewProvider {
  // Global variable name injected into index.html for the webview URI
  static WEBVIEW_INJECT_IN_MARK = "__webview_uri__";
  // Marker used to detect the vite webview HMR plugin
  static VSCODE_WEBVIEW_HMR_MARK = "vite-plugin-vscode-webview-hmr";

  /**
   * @param context Extension context from activation
   * @param handlers jsonrpc-rx handler configuration
   * @param wiewProviderOptions view provider options
   */
  constructor(
    protected context: ExtensionContext,
    protected handlers: HandlerConfig,
    protected wiewProviderOptions: ViewProviderOptions,
  ) {}

  /**
   * Implement webview view logic, e.g. html assignment, messaging, options setup.
   * @param webviewView A vscode.WebviewView or vscode.WebviewPanel instance.
   */
  abstract resolveWebviewView(webviewView: WebviewView | WebviewPanel): void;

  /**
   * Expose handlers to the Webview for extension <-> webview messaging.
   * @param webview Webview instance
   */
  protected exposeHandlers(webview: Webview) {
    const msgSender = (message: string) =>
      webview.postMessage({ kind: "rpc", payload: message });
    const msgReceiver = (handler: (message: string) => void) =>
      webview.onDidReceiveMessage((message) => {
        const payload = getRpcPayload(message);
        if (payload) {
          handler(payload);
        }
      });
    const jsonrpcServer = new JsonrpcServer(msgSender, msgReceiver);
    expose(jsonrpcServer, this.handlers);
  }

  /**
   * Process the frontend index.html file.
   * @param webview vscode.Webview instance
   * @returns processed index.html content
   */
  protected async getWebviewHtml(webview: Webview) {
    const { indexPath } = this.wiewProviderOptions;
    const { extensionPath } = this.context;
    const htmlText = readFileSync(join(extensionPath, indexPath), { encoding: "utf8" }).toString();
    return this.buildWebviewHtml(webview, htmlText);
  }

  protected buildWebviewHtml(webview: Webview, htmlText: string, assetBase?: string) {
    const { distDir } = this.wiewProviderOptions;
    const { extensionUri } = this.context;

    // Output folder for the bundled webview assets.
    const webviewUri = webview.asWebviewUri(Uri.joinPath(extensionUri, distDir)).toString();
    const webviewBase = webviewUri.endsWith("/") ? webviewUri.slice(0, -1) : webviewUri;
    const rewriteBase = assetBase ? assetBase.replace(/\/$/, "") : webviewBase;

    const root = htmlParser(htmlText);
    const shouldRewrite = !htmlText.includes(AbstractViewProvider.VSCODE_WEBVIEW_HMR_MARK);

    if (shouldRewrite) {
      const tagToChange = [
        ["script", "src"],
        ["link", "href"],
      ] as const;
      for (const [tag, attr] of tagToChange) {
        const elements = root.querySelectorAll(tag);
        for (const elem of elements) {
          const attrValue = elem.getAttribute?.(attr);
          if (attrValue) {
            const resolved = resolveAssetUrl(rewriteBase, attrValue);
            if (resolved) {
              elem.setAttribute(attr, resolved);
            }
          }
        }
      }
    }

    const devOrigin = assetBase ? safeOrigin(assetBase) : undefined;
    injectCsp(root, buildCsp(webview, devOrigin));

    // Inject the webview URI so the frontend can resolve assets.
    const injectScript = `<script> window.${AbstractViewProvider.WEBVIEW_INJECT_IN_MARK} = "${webviewUri}"</script>`;
    root.querySelector("head")!.insertAdjacentHTML("afterbegin", injectScript);

    return root.toString();
  }
}

function resolveAssetUrl(base: string, assetPath: string): string {
  if (
    assetPath.startsWith("http://") ||
    assetPath.startsWith("https://") ||
    assetPath.startsWith("vscode-webview://") ||
    assetPath.startsWith("data:") ||
    assetPath.startsWith("blob:")
  ) {
    return assetPath;
  }
  const normalized = assetPath.startsWith("./")
    ? assetPath.slice(2)
    : assetPath.startsWith("/")
      ? assetPath.slice(1)
      : assetPath;
  return `${base}/${normalized}`;
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function injectCsp(root: ReturnType<typeof htmlParser>, csp: string) {
  if (!csp) {
    return;
  }
  const existing = root.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (existing) {
    existing.setAttribute("content", csp);
    return;
  }
  const head = root.querySelector("head");
  if (head) {
    head.insertAdjacentHTML(
      "afterbegin",
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    );
  }
}

function buildCsp(webview: Webview, devOrigin?: string): string {
  if (devOrigin) {
    return [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data: blob:`,
      `style-src ${webview.cspSource} 'unsafe-inline' ${devOrigin}`,
      `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval' ${devOrigin}`,
      `connect-src ${devOrigin} ws: wss:`,
      `font-src ${webview.cspSource} https: data:`,
    ].join("; ");
  }
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource}`,
    `font-src ${webview.cspSource} https: data:`,
    `connect-src ${webview.cspSource}`,
  ].join("; ");
}
