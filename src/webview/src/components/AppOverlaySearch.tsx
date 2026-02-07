import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_UNIVERSAL_CONFIG } from "@shared/universal";
import type { UniversalAction, UniversalConfig, UniversalRoute } from "@shared/universal";
import { DEFAULT_UNIVERSAL_INTENT_SCHEME, buildUniversalIntentUrl, normalizeRoutePath } from "@shared/contracts";
import { useAppContext } from "../contexts/app-context";
import { parseNavTarget } from "../lib/parse-nav-target";

type SearchItem = {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
  stayOpen?: boolean;
};

type AppOverlaySearchProps = {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (actionId: string) => void;
  onNavigate: (path: string) => void;
  extraItems?: SearchItem[];
  initialQuery?: string;
};

const routeIsNavigable = (route: UniversalRoute): boolean =>
  typeof route.path === "string" &&
  route.path.length > 0 &&
  !route.path.includes(":") &&
  !route.path.includes("$");

const IconSearch = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M8.5 2a6.5 6.5 0 104.03 11.6l3.43 3.44a1 1 0 001.42-1.42l-3.44-3.43A6.5 6.5 0 008.5 2zm0 2a4.5 4.5 0 110 9 4.5 4.5 0 010-9z"
    />
  </svg>
);

const IconArrow = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M10.25 4.3a1 1 0 011.41 0l5 5a1 1 0 010 1.41l-5 5a1 1 0 01-1.41-1.41l3.3-3.3H4a1 1 0 110-2h9.55l-3.3-3.3a1 1 0 010-1.4z"
    />
  </svg>
);

const IconBolt = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M11.4 1.5a1 1 0 01.83 1.12l-.62 4.28h4.05a1 1 0 01.83 1.56l-7.9 10.96a1 1 0 01-1.82-.72l.87-5.14H4.2a1 1 0 01-.83-1.56L10.6 1.94a1 1 0 01.8-.44z"
    />
  </svg>
);

const IconDoc = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.83a2 2 0 00-.59-1.41l-2.83-2.83A2 2 0 0011.17 3H6zm6 1.5V6a1 1 0 001 1h2.5L12 3.5zM6 9a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
    />
  </svg>
);

const itemIcon = (id: string) => {
  if (id.startsWith("action:")) return <IconBolt />;
  if (id.startsWith("route:")) return <IconArrow />;
  if (id.startsWith("go:")) return <IconArrow />;
  if (id.startsWith("doc:")) return <IconDoc />;
  if (id.startsWith("nav:")) return <IconArrow />;
  return <IconArrow />;
};

type RecentEntry = {
  kind: "route" | "action" | "nav";
  value: string;
  ts: number;
};

const RECENTS_STORAGE_KEY = "atlassian.commandPalette.recents.v1";
const MAX_RECENTS = 14;

const readRecents = (): RecentEntry[] => {
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RecentEntry => {
        if (!entry || typeof entry !== "object") return false;
        const kind = (entry as any).kind;
        const value = (entry as any).value;
        const ts = (entry as any).ts;
        return (
          (kind === "route" || kind === "action" || kind === "nav") &&
          typeof value === "string" &&
          value.trim().length > 0 &&
          typeof ts === "number" &&
          Number.isFinite(ts)
        );
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
};

const writeRecents = (entries: RecentEntry[]) => {
  try {
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENTS)));
  } catch {
    // ignore
  }
};

type SegmentKind = "route" | "action" | "command" | "rpc";

type SegmentContext =
  | {
      kind: SegmentKind;
      dispatcher: true;
      appId: string;
      segments: string[];
      queryString: string;
    }
  | {
      kind: "route";
      dispatcher: false;
      appId: null;
      segments: string[];
      queryString: string;
    };

const splitQuery = (value: string): { pathPart: string; queryString: string } => {
  const [pathPart, queryPart] = String(value ?? "").split("?");
  return {
    pathPart,
    queryString: queryPart ? `?${queryPart}` : "",
  };
};

const parseSegmentContextFromTarget = (target: string): SegmentContext | null => {
  const { pathPart, queryString } = splitQuery(target);

  if (pathPart.startsWith("/app/")) {
    const segments = pathPart.split("/").filter(Boolean);
    const appId = segments[1] ?? "";
    const kind = segments[2] ?? "";
    if (!appId || kind !== "route") {
      if (kind !== "action" && kind !== "command" && kind !== "rpc") {
        return null;
      }
      const rawIdSegments = segments.slice(3).filter(Boolean);
      // Accept legacy dot-form ids under the dispatcher by splitting them into path segments.
      const idSegments =
        rawIdSegments.length === 1 && rawIdSegments[0]?.includes(".")
          ? rawIdSegments[0].replace(new RegExp(`^${appId}\\\\.`), "").split(".").filter(Boolean)
          : rawIdSegments;
      return {
        kind: kind as SegmentKind,
        dispatcher: true,
        appId,
        segments: idSegments,
        queryString,
      };
    }
    const routePath = normalizeRoutePath(`/${segments.slice(3).join("/")}`);
    const routeSegments = routePath.split("/").filter(Boolean);
    return {
      kind: "route",
      dispatcher: true,
      appId,
      segments: routeSegments,
      queryString,
    };
  }

  const routePath = normalizeRoutePath(pathPart);
  const routeSegments = routePath.split("/").filter(Boolean);
  return {
    kind: "route",
    dispatcher: false,
    appId: null,
    segments: routeSegments,
    queryString,
  };
};

const looksLikeLinkOrPath = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
};

export function AppOverlaySearch({
  isOpen,
  onClose,
  onExecute,
  onNavigate,
  extraItems,
  initialQuery,
}: AppOverlaySearchProps) {
  const { universalConfig } = useAppContext();
  const config: UniversalConfig = universalConfig ?? DEFAULT_UNIVERSAL_CONFIG;
  const appId = config.app.id ?? DEFAULT_UNIVERSAL_CONFIG.app.id ?? "atlassian";
  const intentScheme =
    config.app.intentScheme ?? DEFAULT_UNIVERSAL_CONFIG.app.intentScheme ?? DEFAULT_UNIVERSAL_INTENT_SCHEME;
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  const recordRecent = useCallback((entry: Omit<RecentEntry, "ts">) => {
    const next: RecentEntry = { ...entry, ts: Date.now() };
    setRecents((prev) => {
      const deduped = prev.filter((e) => !(e.kind === next.kind && e.value === next.value));
      const merged = [next, ...deduped].slice(0, MAX_RECENTS);
      writeRecents(merged);
      return merged;
    });
  }, []);

  const directTarget = useMemo(() => {
    if (!looksLikeLinkOrPath(query)) return null;
    return parseNavTarget(query);
  }, [query]);
  const directItem: SearchItem | null = useMemo(() => {
    if (!query.trim() || !directTarget) {
      return null;
    }
    const isDispatch = directTarget.startsWith("/app/") || directTarget.startsWith("/intent?") || directTarget.startsWith("/u/");
    return {
      id: `go:${directTarget}`,
      label: isDispatch ? "Open" : "Go to",
      hint: query.trim(),
      action: () => {
        recordRecent({ kind: "nav", value: directTarget });
        onNavigate(directTarget);
      },
    };
  }, [directTarget, onNavigate, query, recordRecent]);

  const segmentContext = useMemo(() => {
    if (!directTarget) return null;
    // Only treat as "segment-editable" when it's link-like (no spaces).
    const trimmed = query.trim();
    if (/\s/.test(trimmed)) return null;
    return parseSegmentContextFromTarget(directTarget);
  }, [directTarget, query]);

  useEffect(() => {
    if (!segmentContext) {
      setSegmentIndex(0);
      return;
    }
    setSegmentIndex((prev) => Math.min(prev, Math.max(0, segmentContext.segments.length - 1)));
  }, [segmentContext?.segments.join("/")]);

  useEffect(() => {
    if (!segmentContext) return;
    if (segmentContext.segments.length === 0) return;
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement !== input) return;

    const raw = input.value;
    const { pathPart } = splitQuery(raw);
    const focus = Math.min(segmentIndex, Math.max(0, segmentContext.segments.length - 1));

    let cursor = 0;
    if (segmentContext.dispatcher) {
      const marker = `/app/${segmentContext.appId}/${segmentContext.kind}/`;
      const idx = pathPart.indexOf(marker);
      if (idx === -1) return;
      cursor = idx + marker.length;
    } else {
      cursor = pathPart.startsWith("/") ? 1 : 0;
    }

    for (let i = 0; i < segmentContext.segments.length; i++) {
      const segment = segmentContext.segments[i] ?? "";
      const start = cursor;
      const end = start + segment.length;
      if (i === focus) {
        try {
          input.setSelectionRange(start, end);
        } catch {
          // ignore selection errors
        }
        return;
      }
      cursor = end + 1;
    }
  }, [segmentContext, segmentIndex, query]);

  const routePathLists = useMemo(() => {
    const routes = Object.values(config.routes ?? {}) as UniversalRoute[];
    return routes
      .filter(routeIsNavigable)
      .map((route) => normalizeRoutePath(route.path).split("/").filter(Boolean));
  }, [config.routes]);

  const namespace = config.app.namespace ?? DEFAULT_UNIVERSAL_CONFIG.app.namespace ?? appId;

  const actionPathLists = useMemo(() => {
    const actions = Object.values(config.actions ?? {}) as UniversalAction[];
    return actions
      .filter((action) => typeof action?.id === "string" && action.id.trim().length > 0)
      .map((action) =>
        action.id
          .replace(new RegExp(`^${namespace}\\\\.`), "")
          .split(".")
          .filter(Boolean),
      );
  }, [config.actions, namespace]);

  const commandPathLists = useMemo(() => {
    const commands = Object.values(config.commands ?? {}) as UniversalCommand[];
    return commands
      .filter((cmd) => typeof cmd?.id === "string" && cmd.id.trim().length > 0)
      .filter((cmd) => cmd.id.startsWith(`${namespace}.`))
      .map((cmd) => cmd.id.replace(new RegExp(`^${namespace}\\\\.`), "").split(".").filter(Boolean));
  }, [config.commands, namespace]);

  const rpcPathLists = useMemo(() => {
    const commands = Object.values(config.commands ?? {}) as UniversalCommand[];
    return commands
      .filter((cmd) => cmd.kind === "rpc")
      .filter((cmd) => typeof cmd?.id === "string" && cmd.id.trim().length > 0)
      .map((cmd) => String(cmd.id).split(".").filter(Boolean));
  }, [config.commands]);

  const defaultRouteByHead = useMemo(() => {
    const map: Record<string, string> = {};
    const stages = Object.values(config.stages ?? {});
    stages.forEach((stage) => {
      const raw = typeof stage?.defaultRoute === "string" ? stage.defaultRoute : "";
      if (!raw) return;
      const normalized = normalizeRoutePath(raw);
      const head = normalized.split("/").filter(Boolean)[0];
      if (head && !map[head]) {
        map[head] = normalized;
      }
    });
    return map;
  }, [config.stages]);

  useEffect(() => {
    if (!isOpen) return;
    setRecents(readRecents());
  }, [isOpen]);

  const findBestRoutePath = useCallback(
    (prefix: string[]): string => {
      if (prefix.length === 0) return "/plan";

      const matches = routePathLists.filter((segments) =>
        prefix.every((value, idx) => segments[idx] === value),
      );

      const hasExact = matches.find((segments) => segments.length === prefix.length);
      if (hasExact) {
        return `/${hasExact.join("/")}`;
      }

      if (prefix.length === 1) {
        const head = prefix[0];
        const stageDefault = defaultRouteByHead[head];
        if (stageDefault) {
          return stageDefault;
        }
      }

      if (matches.length === 0) {
        return normalizeRoutePath(`/${prefix.join("/")}`);
      }

      const best = [...matches].sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        return `/${a.join("/")}`.localeCompare(`/${b.join("/")}`);
      })[0];

      return `/${best.join("/")}`;
    },
    [defaultRouteByHead, routePathLists],
  );

  const segmentOptions = useMemo(() => {
    if (!segmentContext) return [];

    const lists =
      segmentContext.kind === "route"
        ? routePathLists
        : segmentContext.kind === "action"
          ? actionPathLists
          : segmentContext.kind === "command"
            ? commandPathLists
            : rpcPathLists;

    if (segmentContext.segments.length === 0) return [];
    const focus = Math.min(segmentIndex, Math.max(0, segmentContext.segments.length - 1));
    const prefix = segmentContext.segments.slice(0, focus);
    const options = new Set<string>();
    for (const segments of lists) {
      if (segments.length <= focus) continue;
      let matches = true;
      for (let i = 0; i < prefix.length; i++) {
        if (segments[i] !== prefix[i]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      const candidate = segments[focus];
      if (candidate) options.add(candidate);
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [
    actionPathLists,
    commandPathLists,
    rpcPathLists,
    routePathLists,
    segmentContext,
    segmentIndex,
  ]);

  const segmentItems: SearchItem[] = useMemo(() => {
    if (!segmentContext) return [];
    if (segmentOptions.length === 0) return [];
    const focus = Math.min(segmentIndex, Math.max(0, segmentContext.segments.length - 1));
    const prefix = segmentContext.segments.slice(0, focus);

    const buildPreview = (value: string) => {
      if (segmentContext.kind === "route") {
        const bestPath = findBestRoutePath([...prefix, value]);
        return segmentContext.dispatcher ? `/app/${segmentContext.appId}/route${bestPath}` : bestPath;
      }

      const lists =
        segmentContext.kind === "action"
          ? actionPathLists
          : segmentContext.kind === "command"
            ? commandPathLists
            : rpcPathLists;

      const nextPrefix = [...prefix, value];
      const matches = lists.filter((segments) => nextPrefix.every((v, idx) => segments[idx] === v));
      const exact = matches.find((segments) => segments.length === nextPrefix.length);
      const best = exact
        ? exact
        : matches.length === 0
          ? nextPrefix
          : [...matches].sort((a, b) => a.length - b.length || a.join("/").localeCompare(b.join("/")))[0];
      const bestPath = best.join("/");
      return `/app/${segmentContext.appId}/${segmentContext.kind}/${bestPath}`;
    };

    return segmentOptions.map((value) => ({
      id: `seg:${focus}:${value}`,
      label: value,
      hint: buildPreview(value),
      action: () => {
        if (segmentContext.kind === "route") {
          const bestPath = findBestRoutePath([...prefix, value]);
          recordRecent({ kind: "route", value: bestPath });
          onNavigate(`${bestPath}${segmentContext.queryString}`);
          return;
        }

        const preview = buildPreview(value);
        if (segmentContext.kind === "action") {
          const marker = `/app/${segmentContext.appId}/action/`;
          const tail = preview.startsWith(marker) ? preview.slice(marker.length) : "";
          const actionIdTail = tail.split("/").filter(Boolean).join(".");
          const actionId = actionIdTail ? `${namespace}.${actionIdTail}` : `${namespace}.${[...prefix, value].join(".")}`;
          recordRecent({ kind: "action", value: actionId });
        }
        onNavigate(`${preview}${segmentContext.queryString}`);
      },
    }));
  }, [
    actionPathLists,
    commandPathLists,
    findBestRoutePath,
    namespace,
    onNavigate,
    recordRecent,
    rpcPathLists,
    segmentContext,
    segmentIndex,
    segmentOptions,
  ]);

  const routeItems: SearchItem[] = useMemo(() => {
    const routes = Object.values(config.routes ?? {}) as UniversalRoute[];
    return routes
      .filter(routeIsNavigable)
      .sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""))
      .map((route) => ({
        id: `route:${route.id}`,
        label: `Go: ${route.path}`,
        hint: buildUniversalIntentUrl({ kind: "route", path: route.path }, intentScheme, appId),
        action: () => {
          recordRecent({ kind: "route", value: route.path });
          onNavigate(route.path);
        },
      }));
  }, [appId, config.routes, intentScheme, onNavigate, recordRecent]);

  const actionItems: SearchItem[] = useMemo(() => {
    const actions = Object.values(config.actions ?? {}) as UniversalAction[];
    return actions
      .filter((action) => Boolean(action?.id))
      .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""))
      .map((action) => ({
        id: `action:${action.id}`,
        label: `Run: ${action.id.replace(/^atlassian\\./, "").replace(/\\./g, " ")}`,
        hint: buildUniversalIntentUrl({ kind: "action", id: action.id }, intentScheme, appId),
        action: () => {
          recordRecent({ kind: "action", value: action.id });
          onExecute(action.id);
        },
      }));
  }, [appId, config.actions, intentScheme, onExecute, recordRecent]);

  const commonItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];
    const stages = Object.values(config.stages ?? {}).filter(Boolean);
    stages
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((stage) => {
        const defaultRoute = typeof stage.defaultRoute === "string" ? stage.defaultRoute : "";
        if (!defaultRoute) return;
        const normalized = normalizeRoutePath(defaultRoute);
        items.push({
          id: `go:stage:${stage.id}`,
          label: `Go: ${stage.label}`,
          hint: buildUniversalIntentUrl({ kind: "route", path: normalized }, intentScheme, appId),
          action: () => {
            recordRecent({ kind: "route", value: normalized });
            onNavigate(normalized);
          },
        });

        if (stage.id === "system" && stage.subnav) {
          Object.values(stage.subnav)
            .filter(Boolean)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .forEach((entry) => {
              const path = typeof entry.path === "string" ? entry.path : "";
              if (!path) return;
              const normalizedSub = normalizeRoutePath(path);
              items.push({
                id: `go:subnav:${stage.id}:${entry.label}:${normalizedSub}`,
                label: `Go: ${stage.label} / ${entry.label}`,
                hint: buildUniversalIntentUrl({ kind: "route", path: normalizedSub }, intentScheme, appId),
                action: () => {
                  recordRecent({ kind: "route", value: normalizedSub });
                  onNavigate(normalizedSub);
                },
              });
            });
        }
      });

    return items;
  }, [appId, config.stages, intentScheme, onNavigate, recordRecent]);

  const recentItems: SearchItem[] = useMemo(() => {
    if (recents.length === 0) return [];
    const items: SearchItem[] = [];
    for (const entry of recents) {
      if (entry.kind === "route") {
        const path = normalizeRoutePath(entry.value);
        items.push({
          id: `recent:route:${path}`,
          label: `Recent: ${path}`,
          hint: buildUniversalIntentUrl({ kind: "route", path }, intentScheme, appId),
          action: () => onNavigate(path),
        });
      } else if (entry.kind === "action") {
        const id = entry.value;
        items.push({
          id: `recent:action:${id}`,
          label: `Recent: ${id.replace(/^atlassian\\./, "").replace(/\\./g, " ")}`,
          hint: buildUniversalIntentUrl({ kind: "action", id }, intentScheme, appId),
          action: () => onExecute(id),
        });
      } else if (entry.kind === "nav") {
        const target = entry.value;
        items.push({
          id: `recent:nav:${target}`,
          label: `Recent: ${target}`,
          hint: target,
          action: () => onNavigate(target),
        });
      }
    }
    return items.slice(0, 6);
  }, [appId, intentScheme, onExecute, onNavigate, recents]);

  const normalizedQuery = query.trim().toLowerCase();
  const linkMode = useMemo(() => {
    if (!segmentContext) return false;
    if (!query.trim()) return false;
    return !/\s/.test(query.trim());
  }, [query, segmentContext]);

  const allItems = useMemo(() => {
    if (!query.trim()) {
      return [...recentItems, ...commonItems, ...(extraItems ?? []), ...routeItems, ...actionItems];
    }
    if (linkMode) {
      return [...(directItem ? [directItem] : []), ...segmentItems, ...(extraItems ?? [])];
    }
    return [...(directItem ? [directItem] : []), ...(extraItems ?? []), ...routeItems, ...actionItems];
  }, [actionItems, commonItems, directItem, extraItems, linkMode, query, recentItems, routeItems, segmentItems]);

  const filtered = linkMode
    ? allItems
    : normalizedQuery
      ? allItems.filter((item) =>
          `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(normalizedQuery),
        )
      : allItems.slice(0, 12);

  useEffect(() => {
    if (isOpen) {
      const seed = typeof initialQuery === "string" ? initialQuery : "";
      const normalizedSeed = seed && looksLikeLinkOrPath(seed) ? parseNavTarget(seed) ?? seed : seed;
      setQuery(normalizedSeed);
      setActiveIndex(0);
      setSegmentIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (normalizedSeed) {
          inputRef.current?.select();
        }
      });
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    const active = itemRefs.current[activeIndex];
    if (!active) return;
    active.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && segmentContext) {
        e.preventDefault();
        const max = Math.max(0, segmentContext.segments.length - 1);

        // At the leaf segment, ArrowRight acts like a "preview/open" that keeps the palette open.
        // This makes segment navigation feel closer to a tree/mega-menu interaction.
        if (e.key === "ArrowRight" && segmentIndex >= max) {
          const item = filtered[activeIndex];
          if (item) {
            item.action();
          }
          return;
        }

        const delta = e.key === "ArrowRight" ? 1 : -1;
        setSegmentIndex((prev) => Math.min(max, Math.max(0, prev + delta)));
        setActiveIndex(0);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        const item = filtered[activeIndex];
        item.action();
        if (!item.stayOpen) {
          onClose();
        }
      }
    },
    [filtered, activeIndex, onClose, segmentContext, segmentIndex],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="command-palette-backdrop"
      role="presentation"
      onMouseDown={() => onClose()}
    >
      <div
        className="command-palette-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="command-palette-header">
          <span className="command-palette-search-icon" aria-hidden="true">
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search actions or paste a link..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
          <button type="button" className="command-palette-close" onClick={onClose}>
            Esc
          </button>
        </div>

        {segmentContext ? (
          <div className="command-palette-pathbar" aria-hidden="true">
            <span className="command-palette-pathbar-label">{segmentContext.kind}</span>
            <div className="command-palette-pathbar-segments">
              {segmentContext.segments.map((segment, idx) => (
                <button
                  key={`${segment}-${idx}`}
                  type="button"
                  className={`command-palette-segment${idx === segmentIndex ? " segment-active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSegmentIndex(idx);
                    setActiveIndex(0);
                  }}
                  title="Use \u2190/\u2192 to select a segment"
                >
                  {segment}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <div className="command-palette-results">
            {filtered.map((item, i) => (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                className={`command-palette-item${i === activeIndex ? " palette-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  item.action();
                  if (!item.stayOpen) {
                    onClose();
                  }
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="command-palette-item-icon" aria-hidden="true">
                  {itemIcon(item.id)}
                </span>
                <span className="command-palette-item-label">{item.label}</span>
                {item.hint ? <span className="command-palette-item-hint">{item.hint}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="command-palette-empty">No matches.</div>
        )}

        <div className="command-palette-footer" aria-hidden="true">
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>,
    document.getElementById("root") ?? document.body,
  );
}
