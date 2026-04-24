import type { ReactNode } from "react";

export function PageIntro({
  title,
  subtitle,
  modeLabel,
  actions,
}: {
  title: string;
  subtitle?: string;
  modeLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header-block">
      <div className="page-kickers">
        {modeLabel ? <span className="badge">{modeLabel}</span> : null}
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
