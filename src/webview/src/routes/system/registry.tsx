import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import {
  DEFAULT_UNIVERSAL_INTENT_SCHEME,
  ROUTE_META,
  SETTINGS_REGISTRY,
  UNIVERSAL_INTENT_KINDS,
  buildDeepLinkUrl,
  buildUniversalIntentUrl,
} from "@shared/contracts";
import type { DocsIndex, DocGroup } from "@shared/docs-contract";
import type {
  UniversalAction,
  UniversalCommand,
  UniversalConfig,
  UniversalEnvironment,
  UniversalEvent,
  UniversalPlatform,
  UniversalRoute,
  UniversalStorageTarget,
} from "@shared/universal";
import { DEFAULT_UNIVERSAL_CONFIG } from "@shared/universal";
import { KvGrid } from "../../components/KvGrid";
import { useAppContext } from "../../contexts/app-context";
import { useHandlers } from "../../hooks/use-handlers";
import { executeUniversalAction } from "../../lib/execute-universal-action";
import { useUrlParam, parseAsSectionList } from "../../lib/use-url-state";

export const Route = createFileRoute("/system/registry")({
  component: RegistryPage,
  staticData: ROUTE_META.systemRegistry,
});

const safeString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const sortById = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.id.localeCompare(b.id));

const routeIsNavigable = (route: UniversalRoute): boolean =>
  typeof route.path === "string" &&
  route.path.length > 0 &&
  !route.path.includes(":") &&
  !route.path.includes("$");

function RegistryPage() {
  const handlers = useHandlers();
  const navigate = useNavigate();
  const { universalConfig, deepLinkBase, isWebview, state } = useAppContext();

  const config: UniversalConfig = universalConfig ?? DEFAULT_UNIVERSAL_CONFIG;
  const appId = config.app.id ?? DEFAULT_UNIVERSAL_CONFIG.app.id ?? "atlassian";
  const intentScheme =
    config.app.intentScheme ?? DEFAULT_UNIVERSAL_CONFIG.app.intentScheme ?? DEFAULT_UNIVERSAL_INTENT_SCHEME;
  const hasVsCodeApi = typeof (window as any).acquireVsCodeApi === "function";

  const [fullConfig, setFullConfig] = useState<Record<string, unknown> | null>(null);
  const [fullConfigError, setFullConfigError] = useState("");
  const [docsIndex, setDocsIndex] = useState<DocsIndex | null>(null);

  const urlStateConfig = config.urlState;

  const [filter, setFilter] = useUrlParam("q", urlStateConfig);
  const [openSections, setOpenSections] = useQueryState(
    "open",
    parseAsSectionList.withDefault(["matrix", "entrypoints"]).withOptions({ history: "replace" }),
  );
  const [focus, setFocus] = useUrlParam("focus", urlStateConfig);

  const matrixOpen = openSections.includes("matrix");
  const entryPointsOpen = openSections.includes("entrypoints");
  const runtimeOpen = openSections.includes("runtime");
  const navigationOpen = openSections.includes("navigation");
  const intentsOpen = openSections.includes("intents");
  const operationsOpen = openSections.includes("operations");
  const signalsOpen = openSections.includes("signals");
  const preferencesOpen = openSections.includes("preferences");
  const storageOpen = openSections.includes("storage");

  useEffect(() => {
    if (!isWebview) return;
    let cancelled = false;
    setFullConfigError("");
    handlers
      .getFullConfig()
      .then((result) => {
        if (!cancelled) setFullConfig(result as unknown as Record<string, unknown>);
      })
      .catch((err) => {
        if (!cancelled) {
          setFullConfigError(err instanceof Error ? err.message : "Failed to load config.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [handlers, isWebview]);

  useEffect(() => {
    if (!isWebview) return;
    let cancelled = false;
    handlers
      .getDocsIndex()
      .then((result) => {
        if (!cancelled) setDocsIndex(result);
      })
      .catch(() => {
        if (!cancelled) setDocsIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, [handlers, isWebview]);

  const wsBridgePort = useMemo(() => {
    const dev = (fullConfig?.dev ?? null) as Record<string, unknown> | null;
    const port = dev ? dev.wsBridgePort : undefined;
    return typeof port === "number" && Number.isFinite(port) ? port : 5174;
  }, [fullConfig]);

  const wsBridgeHost = useMemo(() => {
    const dev = (fullConfig?.dev ?? null) as Record<string, unknown> | null;
    const host = dev ? dev.wsBridgeHost : undefined;
    return typeof host === "string" && host.trim() ? host.trim() : "127.0.0.1";
  }, [fullConfig]);

  const wsBridgeToken = useMemo(() => {
    const dev = (fullConfig?.dev ?? null) as Record<string, unknown> | null;
    const token = dev ? dev.wsBridgeToken : undefined;
    return typeof token === "string" && token.trim() ? token.trim() : "";
  }, [fullConfig]);

  const preferredWebOrigin = useMemo(() => {
    const settings = (fullConfig?.settings ?? null) as Record<string, unknown> | null;
    const env = (fullConfig?.env ?? null) as Record<string, unknown> | null;
    const fromSettings = settings ? safeString(settings.webviewServerUrl) : "";
    const fromEnv = env ? safeString(env.ATLASSIAN_WEBVIEW_SERVER_URL) : "";
    const raw = (fromSettings || fromEnv || "http://localhost:5173").trim();
    try {
      const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
      return url.origin;
    } catch {
      return "http://localhost:5173";
    }
  }, [fullConfig]);

  const copyText = useCallback(async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall back
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  }, []);

  const scrollToSection = useCallback((id: string) => {
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new Event("atlassian:commandPalette"));
  }, []);

  const setSectionOpen = useCallback(
    (sectionId: string, open: boolean) => {
      void setOpenSections((prev) => {
        const next = Array.from(new Set(prev ?? []));
        const idx = next.indexOf(sectionId);
        if (open && idx === -1) {
          next.push(sectionId);
        } else if (!open && idx !== -1) {
          next.splice(idx, 1);
        }
        next.sort((a, b) => a.localeCompare(b));
        return next;
      });
    },
    [setOpenSections],
  );

  const toggleSectionOpen = useCallback(
    (sectionId: string) => {
      setSectionOpen(sectionId, !openSections.includes(sectionId));
    },
    [openSections, setSectionOpen],
  );

  const openAndFocus = useCallback(
    (sectionId: string, focusId: string) => {
      setSectionOpen(sectionId, true);
      void setFocus(focusId);
      scrollToSection(focusId);
    },
    [scrollToSection, setFocus, setSectionOpen],
  );

  useEffect(() => {
    const id = focus.trim();
    if (!id) return;
    // Convention: focus targets like "registry-navigation" map to "navigation" section IDs.
    if (id.startsWith("registry-")) {
      const sectionId = id.slice("registry-".length);
      if (sectionId) {
        setSectionOpen(sectionId, true);
      }
    }
    scrollToSection(id);
  }, [focus, scrollToSection, setSectionOpen]);

  const routes: UniversalRoute[] = useMemo(
    () => Object.values(config.routes ?? {}) as UniversalRoute[],
    [config.routes],
  );
  const actions: UniversalAction[] = useMemo(
    () => Object.values(config.actions ?? {}) as UniversalAction[],
    [config.actions],
  );
  const commands: UniversalCommand[] = useMemo(
    () => Object.values(config.commands ?? {}) as UniversalCommand[],
    [config.commands],
  );
  const events: UniversalEvent[] = useMemo(
    () => Object.values(config.events ?? {}) as UniversalEvent[],
    [config.events],
  );
  const platforms: UniversalPlatform[] = useMemo(
    () => Object.values(config.platforms ?? {}) as UniversalPlatform[],
    [config.platforms],
  );
  const environments: UniversalEnvironment[] = useMemo(
    () => Object.values(config.environments ?? {}) as UniversalEnvironment[],
    [config.environments],
  );

  const storageTargets: UniversalStorageTarget[] = useMemo(
    () => Object.values(config.storage?.targets ?? {}) as UniversalStorageTarget[],
    [config.storage?.targets],
  );

  const filterText = filter.trim().toLowerCase();
  const filterEnabled = Boolean(filterText);
  const formatCount = (filtered: number, total: number): string =>
    filterEnabled ? `${filtered}/${total}` : `${total}`;

  const filteredRoutes: UniversalRoute[] = useMemo(() => {
    if (!filterEnabled) return routes;
    return routes.filter((route) =>
      `${route.id} ${route.path}`.toLowerCase().includes(filterText),
    );
  }, [filterEnabled, filterText, routes]);

  const filteredActions: UniversalAction[] = useMemo(() => {
    if (!filterEnabled) return actions;
    return actions.filter((action) =>
      `${action.id} ${safeString(action.route)} ${safeString(action.rpc)} ${safeString(action.command)}`
        .toLowerCase()
        .includes(filterText),
    );
  }, [actions, filterEnabled, filterText]);

  const filteredCommands: UniversalCommand[] = useMemo(() => {
    if (!filterEnabled) return commands;
    return commands.filter((cmd) =>
      `${cmd.id} ${cmd.kind} ${safeString(cmd.payloadSchema)}`.toLowerCase().includes(filterText),
    );
  }, [commands, filterEnabled, filterText]);

  const filteredEvents: UniversalEvent[] = useMemo(() => {
    if (!filterEnabled) return events;
    return events.filter((evt) =>
      `${evt.id} ${evt.kind} ${safeString(evt.payloadSchema)}`.toLowerCase().includes(filterText),
    );
  }, [events, filterEnabled, filterText]);

  const filteredSettings = useMemo(() => {
    const all = Object.values(SETTINGS_REGISTRY).sort((a, b) => a.id.localeCompare(b.id));
    if (!filterEnabled) return all;
    return all.filter((setting) =>
      `${setting.id} ${setting.key} ${setting.type} ${(setting.envKeys ?? []).join(" ")} ${setting.description ?? ""}`
        .toLowerCase()
        .includes(filterText),
    );
  }, [filterEnabled, filterText]);

  const filteredStorageTargets: UniversalStorageTarget[] = useMemo(() => {
    if (!filterEnabled) return storageTargets;
    return storageTargets.filter((target) =>
      `${target.id} ${target.kind} ${safeString(target.scope)} ${safeString(target.location)} ${target.description ?? ""}`
        .toLowerCase()
        .includes(filterText),
    );
  }, [filterEnabled, filterText, storageTargets]);

  const filteredPlatforms: UniversalPlatform[] = useMemo(() => {
    if (!filterEnabled) return platforms;
    return platforms.filter((platform) =>
      `${platform.id} ${safeString(platform.kind)} ${platform.description ?? ""}`
        .toLowerCase()
        .includes(filterText),
    );
  }, [filterEnabled, filterText, platforms]);

  const filteredEnvironments: UniversalEnvironment[] = useMemo(() => {
    if (!filterEnabled) return environments;
    return environments.filter((env) =>
      `${env.id} ${safeString(env.kind)} ${env.description ?? ""}`.toLowerCase().includes(filterText),
    );
  }, [environments, filterEnabled, filterText]);

  const deepLinkExamples = useMemo(() => {
    const route = "/plan";
    const legacyDeepPath = `/open${route}`;
    const legacyUrl = buildDeepLinkUrl(deepLinkBase, legacyDeepPath);
    const legacyWebUrl = `${preferredWebOrigin}/#${route}`;

    const intent = buildUniversalIntentUrl({ kind: "route", path: route }, intentScheme, appId);
    const appPath = `/app/${appId}/route${route}`;
    const appUrl = buildDeepLinkUrl(deepLinkBase, appPath);
    const webAppUrl = `${preferredWebOrigin}/#${appPath}`;

    return { appUrl, webAppUrl, intent, legacyUrl, legacyWebUrl };
  }, [appId, deepLinkBase, intentScheme, preferredWebOrigin]);

  const browserAuthUrl = useMemo(() => {
    if (!wsBridgeToken) return "";
    // NOTE: `wsToken` must be BEFORE the hash. The browser client reads it from `window.location.search`.
    // Example: http://localhost:5173/?wsToken=...#/app/atlassian/route/plan
    const appPath = `/app/${appId}/route/plan`;
    return `${preferredWebOrigin}/?wsToken=${encodeURIComponent(wsBridgeToken)}#${appPath}`;
  }, [appId, preferredWebOrigin, wsBridgeToken]);

  const docsCounts = useMemo(() => {
    const empty: Record<DocGroup, number> = { docs: 0, runbooks: 0, plans: 0, skills: 0 };
    const entries = docsIndex?.entries ?? [];
    for (const entry of entries) {
      empty[entry.group] = (empty[entry.group] ?? 0) + 1;
    }
    return empty;
  }, [docsIndex]);

  const storageTargetsCount = useMemo(
    () => Object.keys(config.storage?.targets ?? {}).length,
    [config.storage?.targets],
  );

  const actionsByCommandOrRpc = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const action of actions) {
      const add = (key: string) => {
        if (!key) return;
        if (!map[key]) map[key] = [];
        map[key].push(action.id);
      };
      if (action.command) add(String(action.command));
      if (action.rpc) add(String(action.rpc));
    }
    Object.values(map).forEach((list) => list.sort((a, b) => a.localeCompare(b)));
    return map;
  }, [actions]);

  const actionsByRouteRef = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const action of actions) {
      if (!action.route) continue;
      const key = String(action.route);
      if (!map[key]) map[key] = [];
      map[key].push(action.id);
    }
    Object.values(map).forEach((list) => list.sort((a, b) => a.localeCompare(b)));
    return map;
  }, [actions]);

  return (
    <section className="settings-unified">
      <div className="section">
        <div className="section-heading">Registry</div>
        <p className="note">
          This page is the contract surface for routes, actions, commands, events, settings, and
          storage. The goal is to keep IDs and envelopes stable across transports (VS Code IPC vs WS
          bridge).
        </p>

        <div className="registry-toolbar">
          <input
            type="text"
            className="registry-filter"
            value={filter}
            onChange={(e) => void setFilter(e.target.value)}
            placeholder="Filter routes, actions, commands, events, settings..."
            spellCheck={false}
            aria-label="Filter registry"
          />
          {filterEnabled ? (
            <button type="button" className="secondary" onClick={() => void setFilter(null)}>
              Clear
            </button>
          ) : null}
          <span className="registry-toolbar-sep" aria-hidden="true" />
          <button type="button" className="secondary" onClick={openCommandPalette}>
            Palette
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => navigate({ to: "/system/docs" })}
          >
            Docs
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => navigate({ to: "/system/settings" })}
          >
            Settings
          </button>
          <button type="button" className="secondary" onClick={() => navigate({ to: "/system/dev" })}>
            Dev
          </button>
        </div>

        <p className="note">
          Tip: paste <code>{intentScheme}://...</code>, <code>vscode://...</code>, or{" "}
          <code>#/...</code> into the URL bar or command palette.
        </p>
      </div>

      <div className="section">
        <button type="button" className="section-toggle" onClick={() => toggleSectionOpen("matrix")}>
          <span className="section-toggle-icon">{matrixOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Matrix of matrices</span>
        </button>
        {matrixOpen && (
          <div className="section-body">
            <div className="matrix-flow">
              <div className="matrix-step">
                <div className="matrix-step-title">Intent</div>
                <div className="matrix-step-sub">
                  <code>{intentScheme}://...</code>
                </div>
              </div>
              <span className="matrix-flow-arrow">{"\u2192"}</span>
              <div className="matrix-step">
                <div className="matrix-step-title">Action</div>
                <div className="matrix-step-sub">
                  <code>atlassian.*</code>
                </div>
              </div>
              <span className="matrix-flow-arrow">{"\u2192"}</span>
              <div className="matrix-step">
                <div className="matrix-step-title">Command/RPC</div>
                <div className="matrix-step-sub">
                  <code>atlassian.openApp</code> / <code>getState</code>
                </div>
              </div>
              <span className="matrix-flow-arrow">{"\u2192"}</span>
              <div className="matrix-step">
                <div className="matrix-step-title">Envelope</div>
                <div className="matrix-step-sub">
                  <code>IpcEnvelope</code>
                </div>
              </div>
              <span className="matrix-flow-arrow">{"\u2192"}</span>
              <div className="matrix-step">
                <div className="matrix-step-title">Transport</div>
                <div className="matrix-step-sub">
                  <code>{hasVsCodeApi ? "postMessage" : "ws"}</code>
                </div>
              </div>
              <span className="matrix-flow-arrow">{"\u2192"}</span>
              <div className="matrix-step">
                <div className="matrix-step-title">Effects</div>
                <div className="matrix-step-sub">
                  <code>storage</code> + <code>events</code> + <code>route</code>
                </div>
              </div>
            </div>

            <p className="note" style={{ marginTop: 8 }}>
              The thing you actually want to unify long-term is the contract (intent/actions/routes/envelope), not the transport.
            </p>

            <div className="matrix-cards">
              <button
                type="button"
                className="matrix-card"
                onClick={() => navigate({ to: "/system/docs", search: { doc: "docs/universal-matrix.md" } })}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Identity</div>
                  <div className="matrix-card-count">{Object.keys(config.namespaces ?? {}).length}</div>
                </div>
                <div className="matrix-card-sub">namespaces + prefixes</div>
                <div className="matrix-card-examples">
                  <code>{(config.namespaces?.app?.prefix ?? "atlassian")}.&#42;</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => navigate({ to: "/system/docs", search: { doc: "docs/routing-matrix.md" } })}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Intent</div>
                  <div className="matrix-card-count">{UNIVERSAL_INTENT_KINDS.length}</div>
                </div>
                <div className="matrix-card-sub">canonical meaning links</div>
                <div className="matrix-card-examples">
                  <code>{buildUniversalIntentUrl({ kind: "route", path: "/plan" }, intentScheme, appId)}</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => openAndFocus("navigation", "registry-navigation")}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Navigation</div>
                  <div className="matrix-card-count">{routes.length}</div>
                </div>
                <div className="matrix-card-sub">routes + deep links</div>
                <div className="matrix-card-examples">
                  <code>/plan</code> <code>/review/issues/:key</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => openAndFocus("intents", "registry-intents")}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Intents</div>
                  <div className="matrix-card-count">{actions.length}</div>
                </div>
                <div className="matrix-card-sub">user intent IDs</div>
                <div className="matrix-card-examples">
                  <code>atlassian.app.open</code> <code>atlassian.issue.open</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => openAndFocus("operations", "registry-operations")}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Operations</div>
                  <div className="matrix-card-count">{commands.length}</div>
                </div>
                <div className="matrix-card-sub">vscode/rpc/ipc entrypoints</div>
                <div className="matrix-card-examples">
                  <code>atlassian.openApp</code> <code>getState</code> <code>atlassian.route.navigate</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => openAndFocus("signals", "registry-signals")}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Signals</div>
                  <div className="matrix-card-count">{events.length}</div>
                </div>
                <div className="matrix-card-sub">observable signals</div>
                <div className="matrix-card-examples">
                  <code>atlassian.route.changed</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => openAndFocus("preferences", "registry-preferences")}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Preferences</div>
                  <div className="matrix-card-count">{Object.keys(SETTINGS_REGISTRY).length}</div>
                </div>
                <div className="matrix-card-sub">settings registry</div>
                <div className="matrix-card-examples">
                  <code>atlassian.docsPath</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => openAndFocus("storage", "registry-storage")}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Persistence</div>
                  <div className="matrix-card-count">{storageTargetsCount}</div>
                </div>
                <div className="matrix-card-sub">storage targets</div>
                <div className="matrix-card-examples">
                  <code>settings</code> <code>secrets</code> <code>state</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => openAndFocus("runtime", "registry-runtime")}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">Runtime</div>
                  <div className="matrix-card-count">{platforms.length + environments.length}</div>
                </div>
                <div className="matrix-card-sub">platforms + environments</div>
                <div className="matrix-card-examples">
                  <code>vscode</code> <code>web</code> <code>dev</code> <code>prod</code>
                </div>
              </button>

              <button
                type="button"
                className="matrix-card"
                onClick={() => navigate({ to: "/system/docs" })}
              >
                <div className="matrix-card-head">
                  <div className="matrix-card-title">_agents</div>
                  <div className="matrix-card-count">{docsIndex?.entries?.length ?? 0}</div>
                </div>
                <div className="matrix-card-sub">docs + runbooks + plans + skills</div>
                <div className="matrix-card-examples">
                  <code>docs:{docsCounts.docs}</code> <code>runbooks:{docsCounts.runbooks}</code>{" "}
                  <code>plans:{docsCounts.plans}</code> <code>skills:{docsCounts.skills}</code>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="section" id="registry-entrypoints">
        <button
          type="button"
          className="section-toggle"
          onClick={() => toggleSectionOpen("entrypoints")}
        >
          <span className="section-toggle-icon">{entryPointsOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Entry points</span>
        </button>
        {entryPointsOpen && (
          <div className="section-body">
            {fullConfigError ? <div className="error">{fullConfigError}</div> : null}
            <KvGrid
              items={[
                { label: "Wrapper base", value: deepLinkBase || "\u2014" },
                { label: "Preferred wrapper (/app)", value: deepLinkExamples.appUrl || "\u2014" },
                { label: "Preferred web URL (hash + /app)", value: deepLinkExamples.webAppUrl },
                { label: "Intent scheme", value: intentScheme || "\u2014", muted: true },
                { label: "Canonical intent URL", value: deepLinkExamples.intent, muted: true },
                { label: "Legacy deep link (/open)", value: deepLinkExamples.legacyUrl || "\u2014", muted: true },
                { label: "Legacy web URL (hash route)", value: deepLinkExamples.legacyWebUrl, muted: true },
                { label: "IPC (VS Code)", value: "webview.postMessage (JSON-RPC + ipc envelopes)" },
                {
                  label: "WS bridge (browser dev)",
                  value: `ws://${wsBridgeHost}:${wsBridgePort}/?token=${wsBridgeToken ? "…" : "<missing>"}`,
                },
                { label: "Extension", value: state.extensionId || "\u2014", muted: true },
                { label: "URI scheme", value: state.uriScheme || "\u2014", muted: true },
              ]}
            />

            <div className="actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => copyText(wsBridgeToken)}
                disabled={!wsBridgeToken}
              >
                Copy WS token
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => copyText(browserAuthUrl)}
                disabled={!browserAuthUrl}
                title="Opens localhost with ?wsToken=... once; token persists in localStorage"
              >
                Copy browser auth URL
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => copyText(deepLinkExamples.appUrl)}
                disabled={!deepLinkBase}
              >
                Copy preferred wrapper
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => copyText(deepLinkExamples.legacyUrl)}
                disabled={!deepLinkBase}
              >
                Copy legacy deep link
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  copyText(buildUniversalIntentUrl({ kind: "route", path: "/plan" }, intentScheme, appId))
                }
              >
                Copy universal URL
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  navigate({ to: "/system/docs", search: { doc: "docs/universal-matrix.md" } })
                }
              >
                Open matrix doc
              </button>
            </div>

            <p className="note" style={{ marginTop: 10 }}>
              Browser dev auth: open the copied <code>browser auth URL</code> once. It stores{" "}
              <code>wsToken</code> in <code>localStorage</code> and removes it from the URL.
            </p>
          </div>
        )}
      </div>

      <div className="section" id="registry-runtime">
        <button type="button" className="section-toggle" onClick={() => toggleSectionOpen("runtime")}>
          <span className="section-toggle-icon">{runtimeOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Runtime</span>
          <span className="section-count">
            platforms {formatCount(filteredPlatforms.length, platforms.length)} {"\u00b7"} env{" "}
            {formatCount(filteredEnvironments.length, environments.length)}
          </span>
        </button>
        {runtimeOpen && (
          <div className="section-body">
            <div className="registry-split">
              <div className="registry-split-panel">
                <div className="registry-subhead">
                  <span>Platforms</span>
                  <span className="section-count">
                    {formatCount(filteredPlatforms.length, platforms.length)}
                  </span>
                </div>
                <ul className="list">
                  {sortById(filteredPlatforms)
                    .filter((platform) => Boolean(platform?.id))
                    .map((platform) => (
                      <li key={platform.id}>
                        <code>{platform.id}</code>{" "}
                        {platform.kind ? <span className="note">({platform.kind})</span> : null}{" "}
                        {platform.description ? <span className="note">{platform.description}</span> : null}
                      </li>
                    ))}
                </ul>
              </div>

              <div className="registry-split-panel">
                <div className="registry-subhead">
                  <span>Environments</span>
                  <span className="section-count">
                    {formatCount(filteredEnvironments.length, environments.length)}
                  </span>
                </div>
                <ul className="list">
                  {sortById(filteredEnvironments)
                    .filter((env) => Boolean(env?.id))
                    .map((env) => (
                      <li key={env.id}>
                        <code>{env.id}</code> {env.kind ? <span className="note">({env.kind})</span> : null}{" "}
                        {env.description ? <span className="note">{env.description}</span> : null}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="section" id="registry-navigation">
        <button
          type="button"
          className="section-toggle"
          onClick={() => toggleSectionOpen("navigation")}
        >
          <span className="section-toggle-icon">{navigationOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Navigation</span>
          <span className="section-count">{formatCount(filteredRoutes.length, routes.length)}</span>
        </button>
        {navigationOpen && (
          <div className="section-body">
            <ul className="list">
              {filteredRoutes
                .filter((route) => Boolean(route?.id && route?.path))
                .sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""))
                .map((route) => {
                  const canNav = routeIsNavigable(route);
                  const intent = buildUniversalIntentUrl(
                    { kind: "route", path: route.path },
                    intentScheme,
                    appId,
                  );
                  const preferredDeepLink =
                    deepLinkBase && canNav
                      ? buildDeepLinkUrl(deepLinkBase, `/app/${appId}/route${route.path}`)
                      : "";
                  const linkedActions = actionsByRouteRef[route.id] ?? [];
                  return (
                    <li key={route.id}>
                      <code>{route.path}</code> <span className="note">({route.id})</span>{" "}
                      {canNav ? (
                        <a
                          href="#"
                          className="inline-route-link"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate({ to: route.path });
                          }}
                        >
                          open
                        </a>
                      ) : null}{" "}
                      <a
                        href="#"
                        className="inline-route-link"
                        onClick={(e) => {
                          e.preventDefault();
                          void copyText(intent);
                        }}
                      >
                        copy intent
                      </a>
                      {preferredDeepLink ? (
                        <>
                          {" "}
                          <a
                            href="#"
                            className="inline-route-link"
                            onClick={(e) => {
                              e.preventDefault();
                              void copyText(preferredDeepLink);
                            }}
                          >
                            copy deep link
                          </a>
                        </>
                      ) : null}{" "}
                      {linkedActions.length > 0 ? (
                        <a
                          href="#"
                          className="inline-route-link"
                          onClick={(e) => {
                            e.preventDefault();
                            void setFilter(route.id);
                            openAndFocus("intents", "registry-intents");
                          }}
                        >
                          actions {linkedActions.length}
                        </a>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      <div className="section" id="registry-intents">
        <button type="button" className="section-toggle" onClick={() => toggleSectionOpen("intents")}>
          <span className="section-toggle-icon">{intentsOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Intents</span>
          <span className="section-count">{formatCount(filteredActions.length, actions.length)}</span>
        </button>
        {intentsOpen && (
          <div className="section-body">
            <ul className="list">
              {sortById(filteredActions)
                .filter((action) => Boolean(action?.id))
                .map((action) => {
                  const routeRef = safeString(action.route);
                  const routePath = routeRef ? safeString(config.routes?.[routeRef]?.path) : "";
                  const intent = buildUniversalIntentUrl({ kind: "action", id: action.id }, intentScheme, appId);
                  return (
                    <li key={action.id}>
                      <code>{action.id}</code>{" "}
                      <a
                        href="#"
                        className="inline-route-link"
                        onClick={(e) => {
                          e.preventDefault();
                          void copyText(intent);
                        }}
                      >
                        copy intent
                      </a>{" "}
                      <a
                        href="#"
                        className="inline-route-link"
                        onClick={(e) => {
                          e.preventDefault();
                          void executeUniversalAction(action.id, {
                            config,
                            handlers,
                            onNavigate: (path) => navigate({ to: path }),
                          });
                        }}
                      >
                        run
                      </a>
                      {action.description ? <span className="note"> {action.description}</span> : null}
                      {routeRef ? (
                        <>
                          {" "}
                          <span className="note">route</span> <code>{routeRef}</code>
                          {routePath ? (
                            <>
                              {" "}
                              <a
                                href="#"
                                className="inline-route-link"
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate({ to: routePath });
                                }}
                              >
                                open
                              </a>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      {action.rpc ? (
                        <>
                          {" "}
                          <span className="note">rpc</span> <code>{safeString(action.rpc)}</code>
                        </>
                      ) : null}
                      {action.command ? (
                        <>
                          {" "}
                          <span className="note">cmd</span> <code>{safeString(action.command)}</code>
                        </>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      <div className="section" id="registry-operations">
        <button
          type="button"
          className="section-toggle"
          onClick={() => toggleSectionOpen("operations")}
        >
          <span className="section-toggle-icon">{operationsOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Operations</span>
          <span className="section-count">{formatCount(filteredCommands.length, commands.length)}</span>
        </button>
        {operationsOpen && (
          <div className="section-body">
            <ul className="list">
              {sortById(filteredCommands)
                .filter((cmd) => Boolean(cmd?.id))
                .map((cmd) => {
                  const linkedActions = actionsByCommandOrRpc[cmd.id] ?? [];
                  return (
                    <li key={cmd.id}>
                      <code>{cmd.id}</code> <span className="note">({cmd.kind})</span>
                      {cmd.payloadSchema ? (
                        <>
                          {" "}
                          <span className="note">payload</span> <code>{cmd.payloadSchema}</code>
                        </>
                      ) : null}{" "}
                      {linkedActions.length > 0 ? (
                        <a
                          href="#"
                          className="inline-route-link"
                          onClick={(e) => {
                            e.preventDefault();
                            void setFilter(cmd.id);
                            openAndFocus("intents", "registry-intents");
                          }}
                        >
                          actions {linkedActions.length}
                        </a>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      <div className="section" id="registry-signals">
        <button type="button" className="section-toggle" onClick={() => toggleSectionOpen("signals")}>
          <span className="section-toggle-icon">{signalsOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Signals</span>
          <span className="section-count">{formatCount(filteredEvents.length, events.length)}</span>
        </button>
        {signalsOpen && (
          <div className="section-body">
            <ul className="list">
              {sortById(filteredEvents)
                .filter((evt) => Boolean(evt?.id))
                .map((evt) => (
                  <li key={evt.id}>
                    <code>{evt.id}</code> <span className="note">({evt.kind})</span>
                    {evt.payloadSchema ? (
                      <>
                        {" "}
                        <span className="note">payload</span> <code>{evt.payloadSchema}</code>
                      </>
                    ) : null}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      <div className="section" id="registry-preferences">
        <button
          type="button"
          className="section-toggle"
          onClick={() => toggleSectionOpen("preferences")}
        >
          <span className="section-toggle-icon">{preferencesOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Preferences</span>
          <span className="section-count">
            {formatCount(filteredSettings.length, Object.keys(SETTINGS_REGISTRY).length)}
          </span>
        </button>
        {preferencesOpen && (
          <div className="section-body">
            <ul className="list">
              {filteredSettings.map((setting) => (
                <li key={setting.id}>
                  <code>{setting.id}</code> <span className="note">({setting.type})</span>{" "}
                  {setting.sensitive ? <span className="note">sensitive</span> : null}{" "}
                  {setting.envKeys && setting.envKeys.length > 0 ? (
                    <span className="note">env: {setting.envKeys.join(", ")}</span>
                  ) : null}{" "}
                  {setting.description ? <span className="note">{setting.description}</span> : null}
                </li>
              ))}
            </ul>

            <div className="actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => navigate({ to: "/system/settings" })}
              >
                Open app settings
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void handlers.execCommand("workbench.action.openSettings")}
                disabled={!isWebview}
              >
                Open VS Code settings
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="section" id="registry-storage">
        <button type="button" className="section-toggle" onClick={() => toggleSectionOpen("storage")}>
          <span className="section-toggle-icon">{storageOpen ? "\u25BE" : "\u25B8"}</span>
          <span className="section-heading">Persistence</span>
          <span className="section-count">
            {formatCount(filteredStorageTargets.length, storageTargets.length)}
          </span>
        </button>
        {storageOpen && (
          <div className="section-body">
            <p className="note">
              Storage targets describe where data is allowed to live. The transport should not affect
              storage semantics.
            </p>
            <ul className="list">
              {sortById(filteredStorageTargets).map((target) => (
                <li key={target.id}>
                  <code>{target.id}</code>{" "}
                  <span className="note">
                    ({target.kind}
                    {target.scope ? `, ${target.scope}` : ""})
                  </span>{" "}
                  {target.description ? <span className="note">{target.description}</span> : null}
                </li>
              ))}
            </ul>

            <div className="actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  navigate({
                    to: "/system/docs",
                    search: { doc: "docs/configuration-matrix.md" },
                  })
                }
              >
                Open storage doc
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
