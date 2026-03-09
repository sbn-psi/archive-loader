import { Link } from "react-router-dom";

type ConnectedLinkItem = {
  label: string;
  to: string;
  meta?: string;
};

export function ConnectedLinksPanel({
  title,
  intro,
  items,
}: {
  title: string;
  intro?: string;
  items: ConnectedLinkItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="page-card">
      <h3>{title}</h3>
      {intro ? <p className="muted">{intro}</p> : null}
      <div className="stack-list">
        {items.map((item) => (
          <Link key={`${item.label}-${item.to}`} className="surface-link" to={item.to}>
            <strong>{item.label}</strong>
            {item.meta ? <span>{item.meta}</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
