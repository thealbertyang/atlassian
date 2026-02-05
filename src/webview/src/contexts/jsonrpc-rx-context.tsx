import { JsonrpcClient, MessageReceiver, MessageSender } from "@jsonrpc-rx/client";
import { createContext } from "react";
import { getRpcPayload, wrapRpcMessage } from "../ipc";

type VsCodeApi = {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => unknown;
};

const isBrowser = typeof window !== "undefined";
const isWebview = isBrowser && typeof (window as any).acquireVsCodeApi === "function";

const fallbackApi: VsCodeApi = {
  postMessage: (message: unknown) => console.debug("[webview] postMessage", message),
  getState: () => undefined,
  setState: (state: unknown) => state,
};

export const getVsCodeApi = (): VsCodeApi => {
  if (!isWebview) {
    return fallbackApi;
  }
  const existing = (window as any).__vscodeApi as VsCodeApi | undefined;
  if (existing) {
    return existing;
  }
  const api = (window as any).acquireVsCodeApi() as VsCodeApi;
  (window as any).__vscodeApi = api;
  return api;
};

const noopSender: MessageSender = () => undefined;
const noopReceiver: MessageReceiver = () => undefined;

const createBrowserClient = () => {
  const vscodeApi = getVsCodeApi();
  const msgSender: MessageSender = (message) => {
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    vscodeApi.postMessage(wrapRpcMessage(payload));
  };
  const msgReceiver: MessageReceiver = (handler) =>
    window.addEventListener("message", (event) => {
      const payload = getRpcPayload(event.data);
      if (payload) {
        handler(payload);
      }
    });
  return new JsonrpcClient(msgSender, msgReceiver);
};

let browserClient: JsonrpcClient | null = null;
const getJsonrpcClient = () => {
  if (!isBrowser) {
    return new JsonrpcClient(noopSender, noopReceiver);
  }
  if (!browserClient) {
    browserClient = createBrowserClient();
  }
  return browserClient;
};

export const JsonrpcClientContext = createContext<JsonrpcClient>(getJsonrpcClient());

export const JsonrpcClientContextProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <JsonrpcClientContext.Provider value={getJsonrpcClient()}>
      {children}
    </JsonrpcClientContext.Provider>
  );
};
