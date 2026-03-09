import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageIntro } from "@/components/PageIntro";
import { RecentContextActivity } from "@/components/RecentContextActivity";
import { connectedRecordCards, pageMeta } from "@/lib/navigation";

export function ConnectedRecordsPage() {
  const overview = useQuery({ queryKey: ["status", "context-overview"], queryFn: api.getContextOverview });

  return (
    <div className="page-card">
      <PageIntro title={pageMeta.contextObjectsHome.title} subtitle={pageMeta.contextObjectsHome.subtitle} />
      <div className="workbench-grid">
        {connectedRecordCards.map((card) => (
          <Link key={card.id} className="surface-tile" to={card.to}>
            <strong>{card.title}</strong>
            <span>{card.description}</span>
            {card.id === "target-relationships" ? <span className="muted">Open relationship editor</span> : null}
            {card.id !== "target-relationships" ? (
              <span className="muted">
                {overview.data
                  ? `${overview.data.counts[card.id as keyof typeof overview.data.counts] ?? 0} records`
                  : "Loading count..."}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      <RecentContextActivity />
    </div>
  );
}
