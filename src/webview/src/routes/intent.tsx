import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_UNIVERSAL_INTENT_SCHEME, ROUTE_META, parseUniversalIntentUrl } from "@shared/contracts";
import { DEFAULT_UNIVERSAL_CONFIG } from "@shared/universal";
import { useAppContext } from "../contexts/app-context";
import { toSearchParams } from "../lib/to-search-params";

export const Route = createFileRoute("/intent")({
  component: IntentPage,
  staticData: ROUTE_META.intent,
});

const getIntentParam = (search: unknown): string => {
  try {
    const params = toSearchParams(search);
    return params.get("u") || params.get("intent") || "";
  } catch {
    return "";
  }
};

const toAppDispatchPath = (raw: string): string | null => {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const protocol = url.protocol.replace(/:$/, "");
  if (protocol === DEFAULT_UNIVERSAL_INTENT_SCHEME) {
    const appId = url.host;
    const segments = (url.pathname || "/").split("/").filter(Boolean);
    const kind = segments[0] ?? "";
    const idOrPath = segments.slice(1).join("/");
    if (!appId || !kind) return null;
    return `/app/${appId}/${kind}${idOrPath ? `/${idOrPath}` : ""}${url.search ?? ""}`;
  }

  // Legacy format: <scheme>://<kind>/<idOrPath>
  const appId = protocol;
  const kind = url.host;
  const idOrPath = (url.pathname || "/").replace(/^\/+/, "");
  if (!appId || !kind) return null;
  return `/app/${appId}/${kind}${idOrPath ? `/${idOrPath}` : ""}${url.search ?? ""}`;
};

function IntentPage() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const { universalConfig } = useAppContext();

  // `location.search` is parsed (object). We want the raw query string for `/intent?u=...`.
  const raw = useMemo(() => getIntentParam(location.searchStr), [location.searchStr]);
  const intentScheme =
    universalConfig?.app.intentScheme ?? DEFAULT_UNIVERSAL_CONFIG.app.intentScheme ?? DEFAULT_UNIVERSAL_INTENT_SCHEME;
  const allowedSchemes = useMemo(() => {
    const configured = universalConfig?.app.intentScheme;
    // DEFAULT_UNIVERSAL_CONFIG is also the "legacy" scheme selector; when it's `app`, it means "use the canonical grammar".
    const legacy = DEFAULT_UNIVERSAL_CONFIG.app.intentScheme ?? DEFAULT_UNIVERSAL_INTENT_SCHEME;
    return configured ? [configured, legacy] : [legacy];
  }, [universalConfig?.app.intentScheme]);

  const [error, setError] = useState("");

  useEffect(() => {
    setError("");

    if (!raw) {
      navigate({ to: "/plan", replace: true });
      return;
    }

    if (!parseUniversalIntentUrl(raw, allowedSchemes)) {
      setError("Invalid intent URL.");
      return;
    }

    const target = toAppDispatchPath(raw);
    if (!target) {
      setError("Unable to map intent to /app dispatcher.");
      return;
    }

    navigate({ to: target, replace: true });
  }, [allowedSchemes, navigate, raw]);

  return (
    <section className="settings-unified">
      <div className="section">
        <div className="section-heading">Intent</div>
        <p className="note">
          Legacy dispatcher. Prefer <code>/app</code> universal links (canonical{" "}
          <code>{intentScheme}://</code>).
        </p>
      </div>

      <div className="section">
        <div className="section-heading">Redirect</div>
        {error ? <div className="error">{error}</div> : null}
        <div className="note" style={{ marginTop: 6 }}>
          <code>{raw || "\u2014"}</code>
        </div>
        <div className="note" style={{ marginTop: 12 }}>
          Redirecting...
        </div>
      </div>
    </section>
  );
}
