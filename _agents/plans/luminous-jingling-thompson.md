---
source: claude
app: atlassian-sprint-view
workspace: repos/vscode/extensions/atlassian
created: 2026-02-05
tags: [websocket, ipc, browser-dev, vscode-extension, ws-bridge]
---

# WebSocket IPC Bridge for Browser Dev Mode

## Context

When developing the webview UI, `bun run dev:webview` serves the app at `localhost:5173`. Opening this URL in a browser shows "Webview Unavailable" because `window.acquireVsCodeApi` doesn't exist outside VS Code. This means the entire IPC layer (JSON-RPC handlers + IPC commands/events) is dead — no data loads, no actions work.

The goal is to bridge the browser webview to the extension host over WebSocket, so the full app works in a regular browser during development. This enables faster iteration (browser DevTools, instant reload) without losing handler functionality.

## Architecture

### Current IPC Flow (VS Code webview)
```
Webview                                    Extension Host
vscodeApi.postMessage({kind:"rpc",...})  ->  webview.onDidReceiveMessage -> JsonrpcServer -> handlers
window.addEventListener("message")       <-  webview.postMessage({kind:"rpc",...})
```

### WebSocket Bridge Flow (browser dev mode)
```
Browser                                    Extension Host
ws.send(JSON.stringify(envelope))        ->  WebSocketServer -> parse envelope -> dispatch
window.dispatchEvent(MessageEvent)       <-  ws.send(JSON.stringify(envelope))
```

**Key insight:** By making the WebSocket client produce a `VsCodeApi`-compatible interface (`postMessage` sends over WS) and dispatching incoming WS messages as `window.dispatchEvent(new MessageEvent("message", { data }))`, ALL existing code paths work without modification.

## Files Summary

| Action | File | What |
|--------|------|------|
| Create | `src/extension/service/webview-ws-bridge.ts` | WS server bridging IPC envelopes to handlers |
| Modify | `src/extension/extension.ts` | Start bridge alongside dev server |
| Modify | `src/webview/src/contexts/jsonrpc-rx-context.tsx` | WS client when not in VS Code |
| Modify | `src/webview/src/App.tsx` | Reactive `isConnected` state |
| Modify | `package.json` | Add `ws` + `@types/ws` |
