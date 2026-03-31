import { getJobStatusTone, humanizeJobStatus } from "@/lib/domain";

export function JobStatusBadge({ status }: { status?: string | null }) {
  const tone = getJobStatusTone(status);
  return <span className={`status-badge is-${tone}`}>{humanizeJobStatus(status)}</span>;
}
