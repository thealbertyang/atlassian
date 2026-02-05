# IPC Contract

This extension uses two lanes for communication between the webview and the
extension host:

1. **JSON-RPC** (request/response, data fetching)
2. **IPC Envelope** (events + commands, UI actions and lifecycle)

The JSON-RPC channel is wrapped in an IPC envelope so non-RPC messages do not
break parsing.

## IPC Envelope

```ts
export type IpcEnvelope =
  | { kind: "rpc"; payload: string }
  | { kind: "event"; name: string; payload?: unknown }
  | { kind: "command"; name: string; payload?: unknown };
```

## Events

Defined in `src/shared/ipc-contract.ts`:

- `webview-ready` — webview → extension host; webview finished bootstrapping
- `route-changed` — webview → extension host; route/path changed

## Commands

Defined in `src/shared/ipc-contract.ts`:

- `navigate` — extension host → webview; request navigation
  - payload: `{ route?: RouteHint | string }`
- `refresh-webview` — webview → extension host; request webview reload

## Routing Contract

Shared route normalization lives in `src/shared/route-contract.ts`.

Use these helpers in **both** the webview and extension host:

- `normalizeRoutePath`
- `routeHintToPath`
- `parseRouteHash`
- `buildRouteHash`
- `extractIssueKey`

This prevents drift between deep links (URI handler), injected initial routes,
webview hash routing, and tab navigation.

## JSON-RPC

JSON-RPC handlers live under `src/extension/handlers/**` and are exposed via
`@jsonrpc-rx/server`. The webview uses `@jsonrpc-rx/client` in
`src/webview/src/contexts/jsonrpc-rx-context.tsx`.

Only string payloads are passed into the JSON-RPC layer; all event/command
messages are handled by the IPC envelope.
