import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/LoadingState";
import type { ContextOverviewGroup, RecentContextItem } from "@/types";
import { getRecordEditHref } from "@/lib/navigation";

function formatLastEdited(value?: string | null) {
  if (!value) {
    return "Recently edited";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
}

function recordLinks(items: RecentContextItem[]) {
  return items.slice(0, 6).map((item) => (
    <Link key={`${item.type}-${item.lid}`} className="pill-link" to={getRecordEditHref(item.type, item.lid)}>
      {item.name}
    </Link>
  ));
}

export function RecentContextActivity() {
  const overview = useQuery({ queryKey: ["status", "context-overview"], queryFn: api.getContextOverview });

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <h2>Recently Edited Context Objects</h2>
          <p className="page-subtitle">Recent work grouped by mission when possible.</p>
        </div>
      </div>
      {overview.isLoading ? <LoadingState compact title="Loading recent activity" detail="Looking up the latest mission and context-object edits." /> : null}
      {!overview.isLoading && overview.data ? (
        <div className="stack-list">
          {overview.data.groups.map((group: ContextOverviewGroup) => (
            <div key={group.mission.lid} className="page-panel">
              <div className="page-panel-header">
                <div>
                  <h3>{group.mission.name}</h3>
                  <div className="muted">{formatLastEdited(group.latest_updated_at || group.mission.updated_at)}</div>
                </div>
                <Link className="pill-link is-primary" to={getRecordEditHref("mission", group.mission.lid)}>
                  Open Mission
                </Link>
              </div>
              {group.targets.length > 0 ? (
                <div className="recent-row">
                  <div className="recent-label">Targets</div>
                  <div className="pill-row">{recordLinks(group.targets)}</div>
                </div>
              ) : null}
              {group.spacecraft.length > 0 ? (
                <div className="recent-row">
                  <div className="recent-label">Spacecraft</div>
                  <div className="pill-row">{recordLinks(group.spacecraft)}</div>
                </div>
              ) : null}
              {group.instruments.length > 0 ? (
                <div className="recent-row">
                  <div className="recent-label">Instruments</div>
                  <div className="pill-row">{recordLinks(group.instruments)}</div>
                </div>
              ) : null}
            </div>
          ))}
          {overview.data.standalone.targets.length > 0 || overview.data.standalone.spacecraft.length > 0 || overview.data.standalone.instruments.length > 0 ? (
            <div className="page-panel page-panel-muted">
              <div className="page-panel-header">
                <div>
                  <h3>Other Recently Edited Records</h3>
                </div>
              </div>
              {overview.data.standalone.targets.length > 0 ? (
                <div className="recent-row">
                  <div className="recent-label">Targets</div>
                  <div className="pill-row">{recordLinks(overview.data.standalone.targets)}</div>
                </div>
              ) : null}
              {overview.data.standalone.spacecraft.length > 0 ? (
                <div className="recent-row">
                  <div className="recent-label">Spacecraft</div>
                  <div className="pill-row">{recordLinks(overview.data.standalone.spacecraft)}</div>
                </div>
              ) : null}
              {overview.data.standalone.instruments.length > 0 ? (
                <div className="recent-row">
                  <div className="recent-label">Instruments</div>
                  <div className="pill-row">{recordLinks(overview.data.standalone.instruments)}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
