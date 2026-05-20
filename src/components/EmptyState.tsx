import type { UpdateState } from "../types";

type EmptyStateProps = {
  isOpening: boolean;
  onCheckForUpdates: () => void;
  onInstallCliCommand: () => void;
  onOpenFiles: () => void;
  updateState: UpdateState;
  updateStatus: string;
};

export function EmptyState({
  isOpening,
  onCheckForUpdates,
  onInstallCliCommand,
  onOpenFiles,
  updateState,
  updateStatus,
}: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-actions">
        <button type="button" onClick={onOpenFiles} disabled={isOpening}>
          Open Markdown Files
        </button>
        <button type="button" onClick={onInstallCliCommand}>
          Install CLI Command
        </button>
        <button
          type="button"
          onClick={onCheckForUpdates}
          disabled={updateState === "checking" || updateState === "installing"}
        >
          {updateStatus}
        </button>
      </div>
    </section>
  );
}
