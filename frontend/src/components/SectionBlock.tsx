import type { ReactNode } from "react";

export function SectionBlock({
  title,
  subtitle,
  summary,
  children,
}: {
  title: string;
  subtitle?: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page-section section-block">
      <div className="page-section-header section-block-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {summary ? <div className="section-block-summary">{summary}</div> : null}
      </div>
      {children}
    </section>
  );
}
