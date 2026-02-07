import type { UniversalStage } from "@shared/universal";

type StageRailProps = {
  stages: UniversalStage[];
  activeStage: string;
  onNavigate: (path: string) => void;
};

const STAGE_ICONS: Record<string, string> = {
  calendar: "\u{1F4C5}",
  play: "\u25B6",
  eye: "\u{1F441}",
  rocket: "\u{1F680}",
  pulse: "\u{1F4C8}",
  book: "\u{1F4D6}",
  gear: "\u2699",
};

export function StageRail({ stages, activeStage, onNavigate }: StageRailProps) {
  const mainStages = stages.filter((s) => s.id !== "system").sort((a, b) => a.order - b.order);
  const systemStage = stages.find((s) => s.id === "system");

  return (
    <nav className="stage-rail" aria-label="Stage navigation">
      <div className="stage-rail-main">
        {mainStages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className={`stage-rail-item${activeStage === stage.id ? " stage-rail-active" : ""}`}
            onClick={() => onNavigate(stage.defaultRoute)}
            title={stage.label}
            aria-current={activeStage === stage.id ? "page" : undefined}
          >
            <span className="stage-rail-icon">{STAGE_ICONS[stage.icon ?? ""] ?? stage.label[0]}</span>
            <span className="stage-rail-label">{stage.label}</span>
          </button>
        ))}
      </div>
      {systemStage ? (
        <div className="stage-rail-footer">
          <div className="stage-rail-divider" />
          <button
            type="button"
            className={`stage-rail-item${activeStage === "system" ? " stage-rail-active" : ""}`}
            onClick={() => onNavigate(systemStage.defaultRoute)}
            title={systemStage.label}
            aria-current={activeStage === "system" ? "page" : undefined}
          >
            <span className="stage-rail-icon">{STAGE_ICONS.gear}</span>
            <span className="stage-rail-label">{systemStage.label}</span>
          </button>
        </div>
      ) : null}
    </nav>
  );
}
