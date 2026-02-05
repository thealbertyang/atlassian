import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { DocContent, DocEntry, DocsIndex, DocGroup } from "@shared/docs-contract";
import { useHandlers } from "../../hooks/use-handlers";
import { useAppContext } from "../../contexts/app-context";

export const Route = createFileRoute("/docs/")({
  component: DocsPage,
  staticData: {
    tabLabel: "Docs",
    tabOrder: 6,
  },
});

const GROUP_LABELS: Record<DocGroup, string> = {
  docs: "Docs",
  runbooks: "Runbooks",
};

const parseMarkdown = (markdown: string) => {
  const raw = marked.parse(markdown, { gfm: true, breaks: true });
  return DOMPurify.sanitize(raw);
};

const resolveDocTarget = (
  href: string,
  currentId: string,
): { id: string; anchor?: string } | null => {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("//")) {
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith("#")) {
    return { id: currentId, anchor: trimmed.slice(1) };
  }
  const baseId = currentId.replace(/^\/+/, "");
  let url: URL;
  try {
    url = new URL(trimmed, `https://docs/${baseId}`);
  } catch {
    return null;
  }
  let pathname = url.pathname.replace(/^\/+/, "");
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // ignore decode errors and use the raw path
  }
  if (!pathname.toLowerCase().endsWith(".md")) {
    return null;
  }
  return { id: pathname, anchor: url.hash ? url.hash.slice(1) : "" };
};

const scrollToAnchor = (anchor: string, container?: HTMLElement | null) => {
  if (!anchor) {
    return;
  }
  const target =
    container?.querySelector<HTMLElement>(`[id="${anchor.replace(/"/g, '\\"')}"]`) ??
    document.getElementById(anchor);
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
};

function DocsPage() {
  const handlers = useHandlers();
  const { isWebview, openSettings } = useAppContext();
  const [index, setIndex] = useState<DocsIndex | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState("");
  const [activeId, setActiveId] = useState<string>("");
  const [content, setContent] = useState<DocContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const [pendingAnchor, setPendingAnchor] = useState("");
  const markdownRef = useRef<HTMLElement | null>(null);

  const entries = index?.entries ?? [];

  const groupedEntries = useMemo(() => {
    const grouped: Record<DocGroup, DocEntry[]> = { docs: [], runbooks: [] };
    entries.forEach((entry) => grouped[entry.group].push(entry));
    return grouped;
  }, [entries]);

  useEffect(() => {
    if (!isWebview) {
      return;
    }
    let cancelled = false;
    setIndexLoading(true);
    setIndexError("");
    handlers
      .getDocsIndex()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setIndex(result);
        setIndexError(result.error ?? "");
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to load docs index.";
        setIndexError(message);
        setIndex(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIndexLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handlers, isWebview]);

  useEffect(() => {
    if (!index || activeId) {
      return;
    }
    if (index.entries.length > 0) {
      setActiveId(index.entries[0].id);
    }
  }, [index, activeId]);

  useEffect(() => {
    if (!isWebview || !activeId) {
      setContent(null);
      setContentError("");
      return;
    }
    let cancelled = false;
    setContentLoading(true);
    setContentError("");
    handlers
      .getDocContent(activeId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result) {
          setContent(null);
          setContentError("Document not found.");
          return;
        }
        setContent(result);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to load document.";
        setContentError(message);
        setContent(null);
      })
      .finally(() => {
        if (!cancelled) {
          setContentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, handlers, isWebview]);

  useEffect(() => {
    if (!pendingAnchor) {
      return;
    }
    scrollToAnchor(pendingAnchor, markdownRef.current);
    setPendingAnchor("");
  }, [pendingAnchor, content]);

  const markdownHtml = useMemo(() => {
    if (!content) {
      return "";
    }
    return parseMarkdown(content.markdown);
  }, [content]);

  const sourceLabel = index?.source
    ? index.source === "settings"
      ? "Settings"
      : index.source === "extension"
        ? "Extension"
        : index.source === "workspace"
          ? "Workspace"
          : "None"
    : "None";

  const handleMarkdownClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest("a") as HTMLAnchorElement | null;
    if (!link) {
      return;
    }
    const href = link.getAttribute("href") ?? "";
    const trimmed = href.trim();
    const isExternal =
      trimmed.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
    if (!trimmed || isExternal) {
      return;
    }
    event.preventDefault();
    const baseId = content?.relativePath || activeId;
    const docTarget = baseId ? resolveDocTarget(href, baseId) : null;
    if (!docTarget) {
      if (baseId) {
        void handlers.revealDocAsset(baseId, href);
      }
      return;
    }
    if (docTarget.id !== activeId) {
      setPendingAnchor(docTarget.anchor ?? "");
      setActiveId(docTarget.id);
      return;
    }
    if (docTarget.anchor) {
      scrollToAnchor(docTarget.anchor, markdownRef.current);
    }
  };

  if (!isWebview) {
    return (
      <section className="grid">
        <div className="card">
          <h2>Docs preview unavailable</h2>
          <p className="note">Open the extension webview inside VS Code to browse runbooks.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="docs-layout">
      <div className="card docs-sidebar">
        <div className="card-header">
          <div>
            <div className="eyebrow">Runbooks</div>
            <h2>Docs library</h2>
            <p className="card-sub">Browse Markdown docs from the configured folder.</p>
          </div>
          <span className="pill pill-muted">{sourceLabel}</span>
        </div>
        {index?.root ? (
          <div className="doc-root">
            <div className="kv-label">Docs root</div>
            <div className="doc-root-path">{index.root}</div>
          </div>
        ) : null}
        <div className="actions">
          <button className="secondary" onClick={openSettings} disabled={indexLoading}>
            Open VS Code Settings
          </button>
        </div>
        {indexError ? <div className="error">{indexError}</div> : null}
        {indexLoading ? <p className="note">Loading docs index…</p> : null}
        {!indexLoading && entries.length === 0 && !indexError ? (
          <p className="note">No Markdown files found in the docs directory.</p>
        ) : null}
        {entries.length > 0 ? (
          <div className="doc-groups">
            {Object.entries(groupedEntries).map(([group, items]) => {
              if (items.length === 0) {
                return null;
              }
              return (
                <div key={group} className="doc-group">
                  <div className="eyebrow">{GROUP_LABELS[group as DocGroup]}</div>
                  <div className="doc-list">
                    {items.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`doc-item ${activeId === entry.id ? "active" : ""}`}
                        onClick={() => setActiveId(entry.id)}
                      >
                        <span className="doc-title">{entry.title}</span>
                        <span className="doc-path">{entry.relativePath}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="card docs-content">
        <div className="card-header">
          <div>
            <div className="eyebrow">Preview</div>
            <h2>{content?.title ?? "Select a document"}</h2>
            {content?.relativePath ? (
              <p className="card-sub">{content.relativePath}</p>
            ) : (
              <p className="card-sub">Choose a file to render Markdown.</p>
            )}
          </div>
        </div>
        {contentLoading ? (
          <p className="note">Loading document…</p>
        ) : contentError ? (
          <p className="note">{contentError}</p>
        ) : content ? (
          <article
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: markdownHtml }}
            onClick={handleMarkdownClick}
            ref={markdownRef}
          />
        ) : (
          <p className="note">Select a document from the list to preview it here.</p>
        )}
      </div>
    </section>
  );
}
