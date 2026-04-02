import type { MinerStatus } from "../lib/types";

interface StatusBadgeProps {
  label: string;
  status: MinerStatus;
}

function formatStatus(status: MinerStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function StatusBadge({ label, status }: StatusBadgeProps) {
  return (
    <div className={`status-badge status-${status}`}>
      <span className="status-dot" />
      <span className="status-meta">
        <span className="status-label">{label}</span>
        <strong>{formatStatus(status)}</strong>
      </span>
    </div>
  );
}
