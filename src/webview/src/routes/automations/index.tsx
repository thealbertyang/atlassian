import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type {
  Automation,
  AutomationRun,
  AutomationsIndex,
} from "@shared/automations-contract";
import { useHandlers } from "../../hooks/use-handlers";
import { useAppContext } from "../../contexts/app-context";

export const Route = createFileRoute("/automations/")({
  component: AutomationsPage,
  staticData: {
    tabLabel: "Automations",
    tabOrder: 5,
  },
});

const formatRelativeTime = (timestamp?: number): string => {
  if (!timestamp) return "Never";
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 60000) return "in <1m";
    if (absDiff < 3600000) return `in ${Math.round(absDiff / 60000)}m`;
    if (absDiff < 86400000) return `in ${Math.round(absDiff / 3600000)}h`;
    return `in ${Math.round(absDiff / 86400000)}d`;
  }

  if (diff < 60000) return "<1m ago";
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
};

const truncate = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
};

type AutomationCardProps = {
  automation: Automation;
  onLoadRuns: (id: string) => Promise<AutomationRun[]>;
};

function AutomationCard({ automation, onLoadRuns }: AutomationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const handleToggleRuns = async () => {
    if (!expanded && runs.length === 0) {
      setRunsLoading(true);
      try {
        const result = await onLoadRuns(automation.id);
        setRuns(result);
      } catch (err) {
        console.warn("Failed to load runs:", err);
      } finally {
        setRunsLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  const statusClass = automation.status === "ACTIVE" ? "pill-success" : "pill-muted";

  return (
    <div className="automation-card">
      <div className="automation-header">
        <div className="automation-title">
          <span className="automation-name">{automation.name}</span>
          <span className={`pill ${statusClass}`}>{automation.status}</span>
        </div>
        <div className="automation-meta">
          <span>{automation.rruleHuman}</span>
          <span>·</span>
          <span>{automation.cwds.length} cwd{automation.cwds.length !== 1 ? "s" : ""}</span>
          {automation.hasMemory && (
            <>
              <span>·</span>
              <span className="automation-memory">has memory</span>
            </>
          )}
        </div>
      </div>

      <div className="automation-prompt">{truncate(automation.prompt, 120)}</div>

      <div className="automation-timing">
        <span>Last: {formatRelativeTime(automation.lastRunAt)}</span>
        <span>·</span>
        <span>Next: {formatRelativeTime(automation.nextRunAt)}</span>
      </div>

      <button
        type="button"
        className="automation-runs-toggle"
        onClick={handleToggleRuns}
      >
        {expanded ? "▼" : "▶"} Recent Runs
      </button>

      {expanded && (
        <div className="automation-runs">
          {runsLoading ? (
            <p className="note">Loading runs…</p>
          ) : runs.length === 0 ? (
            <p className="note">No runs recorded.</p>
          ) : (
            <div className="runs-list">
              {runs.map((run) => (
                <div key={run.threadId} className="run-item">
                  <span
                    className={`run-status ${run.status === "ACCEPTED" ? "run-accepted" : run.status === "ARCHIVED" ? "run-archived" : "run-pending"}`}
                  >
                    {run.status === "ACCEPTED" ? "✓" : run.status === "ARCHIVED" ? "○" : "⋯"}
                  </span>
                  <span className="run-status-label">{run.status}</span>
                  {run.threadTitle && (
                    <>
                      <span>·</span>
                      <span className="run-title">"{truncate(run.threadTitle, 40)}"</span>
                    </>
                  )}
                  <span className="run-time">{formatRelativeTime(run.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AutomationSectionProps = {
  title: string;
  subtitle: string;
  automations: Automation[];
  onLoadRuns: (id: string) => Promise<AutomationRun[]>;
  defaultExpanded?: boolean;
};

function AutomationSection({
  title,
  subtitle,
  automations,
  onLoadRuns,
  defaultExpanded = true,
}: AutomationSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="automation-section">
      <button
        type="button"
        className="section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="section-toggle">{expanded ? "▼" : "▶"}</span>
        <span className="section-title">{title}</span>
        <span className="section-count">({automations.length})</span>
      </button>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}

      {expanded && (
        <div className="automation-list">
          {automations.length === 0 ? (
            <p className="note">No automations found.</p>
          ) : (
            automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onLoadRuns={onLoadRuns}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AutomationsPage() {
  const handlers = useHandlers();
  const { isWebview } = useAppContext();
  const [index, setIndex] = useState<AutomationsIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isWebview) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    handlers
      .getAutomations()
      .then((result) => {
        if (cancelled) return;
        setIndex(result);
        if (result.error) setError(result.error);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load automations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [handlers, isWebview]);

  const loadRuns = async (automationId: string): Promise<AutomationRun[]> => {
    return handlers.getAutomationRuns(automationId);
  };

  if (!isWebview) {
    return (
      <section className="grid">
        <div className="card">
          <h2>Automations unavailable</h2>
          <p className="note">Open the extension webview inside VS Code to view automations.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid automations-page">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Codex</div>
            <h2>Automations</h2>
            <p className="card-sub">
              Scheduled tasks from ~/.codex/automations and workspace _agents.
            </p>
          </div>
        </div>

        {loading && <p className="note">Loading automations…</p>}
        {error && <div className="error">{error}</div>}

        {!loading && index && (
          <>
            <AutomationSection
              title="Global"
              subtitle="~/.codex/automations"
              automations={index.global}
              onLoadRuns={loadRuns}
              defaultExpanded={true}
            />

            <AutomationSection
              title="Workspace"
              subtitle="_agents/automations"
              automations={index.workspace}
              onLoadRuns={loadRuns}
              defaultExpanded={index.workspace.length > 0}
            />
          </>
        )}
      </div>
    </section>
  );
}
