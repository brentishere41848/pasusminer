import type { MinerStatus } from "../lib/types";

interface StatusBadgeProps {
  label: string;
  status: MinerStatus;
}

export function StatusBadge({ label, status }: StatusBadgeProps) {
  return (
    <div className={`status-badge status-${status}`}>
      <span className="status-dot" />
      <span>
        {label}: {status}
      </span>
    </div>
  );
}

