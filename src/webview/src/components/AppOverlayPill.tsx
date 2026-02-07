type AppOverlayPillProps = {
  isConnected: boolean;
  stageLabel: string;
  onClick: () => void;
};

export function AppOverlayPill({
  isConnected,
  stageLabel,
  onClick,
}: AppOverlayPillProps) {
  return (
    <button type="button" className="overlay-pill" onClick={onClick}>
      <span className="overlay-action-icon">{isConnected ? "\u{1F7E2}" : "\u{1F7E1}"}</span>
      <span>{isConnected ? "Connected" : "Disconnected"}</span>
      <span className="overlay-pill-label">{stageLabel}</span>
    </button>
  );
}
