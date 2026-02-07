import type { ReactNode } from "react";
import type { UniversalStage } from "@shared/universal";
import { SubNav } from "./SubNav";

type StageHeaderProps = {
  stage: UniversalStage | undefined;
  currentPath: string;
  onNavigate: (path: string) => void;
  actions?: ReactNode;
};

export function StageHeader({ stage, currentPath, onNavigate, actions }: StageHeaderProps) {
  if (!stage) {
    return null;
  }

  const subnavItems = stage.subnav
    ? Object.values(stage.subnav)
    : [];

  return (
    <header className="stage-header">
      <div className="stage-header-left">
        <h1 className="stage-title">{stage.label}</h1>
        {subnavItems.length > 0 ? (
          <SubNav items={subnavItems} currentPath={currentPath} onNavigate={onNavigate} />
        ) : null}
      </div>
      {actions ? <div className="stage-header-actions">{actions}</div> : null}
    </header>
  );
}
