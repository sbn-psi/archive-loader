export function LoadingState({
  title = "Loading",
  detail,
  compact = false,
}: {
  title?: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <div className={`page-state${compact ? " is-compact" : ""}`} role="status" aria-live="polite">
      <div className="loading-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="loading-copy">
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}

