import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/LoadingState";
import { PageIntro } from "@/components/PageIntro";
import { SectionBlock } from "@/components/SectionBlock";
import { isBundle } from "@/lib/domain";
import { getRecordEditHref } from "@/lib/navigation";
import { pageMeta } from "@/lib/navigation";
import type { ObjectRelationshipStatus, StatusListItem } from "@/types";

function buildNameMap(items?: StatusListItem[]) {
  return new Map((items ?? []).map((item) => [item.lid, item.name]));
}

function getRelationshipFields(relationship: ObjectRelationshipStatus) {
  return [
    relationship.investigation ? ({ kind: "mission", lid: relationship.investigation, label: "Mission file" } as const) : null,
    relationship.instrument_host ? ({ kind: "spacecraft", lid: relationship.instrument_host, label: "Spacecraft file" } as const) : null,
    relationship.instrument ? ({ kind: "instrument", lid: relationship.instrument, label: "Instrument" } as const) : null,
    relationship.target ? ({ kind: "target", lid: relationship.target, label: "Target" } as const) : null,
    relationship.bundle ? ({ kind: "bundle", lid: relationship.bundle, label: "Bundle" } as const) : null,
  ].filter((field): field is NonNullable<typeof field> => Boolean(field));
}

function getRelationshipPair(relationship: ObjectRelationshipStatus) {
  const fields = getRelationshipFields(relationship);
  return {
    source: fields[0] ?? null,
    related: fields[1] ?? null,
  };
}

export function ReportsPage({ onError }: { onError: (message: string | null) => void }) {
  void onError;
  const targetTypes = useQuery({ queryKey: ["relationship-types", "target"], queryFn: () => api.getRelationshipTypes("target") });
  const instrumentTypes = useQuery({ queryKey: ["relationship-types", "instrument"], queryFn: () => api.getRelationshipTypes("instrument") });
  const relationships = useQuery({ queryKey: ["status", "relationships"], queryFn: api.getRelationshipStatus });
  const datasetsMissingContext = useQuery({ queryKey: ["status", "datasets-missing-context"], queryFn: api.getDatasetsMissingContext });
  const missions = useQuery({ queryKey: ["status", "missions"], queryFn: () => api.getStatus("missions") });
  const spacecraft = useQuery({ queryKey: ["status", "spacecraft"], queryFn: () => api.getStatus("spacecraft") });
  const targets = useQuery({ queryKey: ["status", "targets"], queryFn: () => api.getStatus("targets") });
  const instruments = useQuery({ queryKey: ["status", "instruments"], queryFn: () => api.getStatus("instruments") });

  if (
    targetTypes.isLoading ||
    instrumentTypes.isLoading ||
    relationships.isLoading ||
    datasetsMissingContext.isLoading ||
    missions.isLoading ||
    spacecraft.isLoading ||
    targets.isLoading ||
    instruments.isLoading
  ) {
    return <LoadingState title="Loading reports" detail="Gathering relationship types and current publishing issues." />;
  }

  const hiddenTypes = [...(targetTypes.data ?? []), ...(instrumentTypes.data ?? [])].filter((type) => type.order >= 1000);
  const missionNames = buildNameMap(missions.data?.results);
  const spacecraftNames = buildNameMap(spacecraft.data?.results);
  const targetNames = buildNameMap(targets.data?.results);
  const instrumentNames = buildNameMap(instruments.data?.results);
  const getName = (kind: "mission" | "spacecraft" | "instrument" | "target" | "bundle", lid: string) => {
    switch (kind) {
      case "mission":
        return missionNames.get(lid) ?? lid;
      case "spacecraft":
        return spacecraftNames.get(lid) ?? lid;
      case "instrument":
        return instrumentNames.get(lid) ?? lid;
      case "target":
        return targetNames.get(lid) ?? lid;
      case "bundle":
        return lid;
    }
  };
  const grouped = hiddenTypes.map((type) => ({
    name: type.name,
    relationships: (relationships.data ?? []).filter((relationship) => relationship.relationshipId === type.relationshipId),
  }));
  const bundlesMissingContext = (datasetsMissingContext.data?.results ?? []).filter((dataset) => isBundle(dataset.lid));

  return (
    <div className="page-card">
      <PageIntro
        title={pageMeta.publishingIssues.title}
        subtitle={pageMeta.publishingIssues.subtitle}
        legacyLabel={pageMeta.publishingIssues.legacyLabel}
      />
      <SectionBlock
        title="Bundles Missing Context"
        subtitle="Bundle records that still need a primary context selected before publishing."
        summary={<span className="badge">{bundlesMissingContext.length} bundles</span>}
      >
        {bundlesMissingContext.length > 0 ? (
          <div className="report-list">
            {bundlesMissingContext.map((dataset) => (
              <div key={dataset.lid} className="report-item">
                <div className="report-item-main">
                  <strong>{dataset.name}</strong>
                  <div className="muted">{dataset.lid}</div>
                </div>
                <Link className="pill-link" to={`/datasets/import?edit=${encodeURIComponent(dataset.lid)}`}>
                  Open Dataset
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="page-panel page-panel-muted">
            <p className="page-subtitle">No bundle records are currently missing primary context.</p>
          </div>
        )}
      </SectionBlock>
      <SectionBlock
        title="Context Product Relationship Cleanup"
        subtitle="These relationships are still present in context product files even though their type is marked ignored here. Use this list to identify the source product file that needs a new version published without that relationship."
        summary={<span className="badge">{grouped.reduce((count, group) => count + group.relationships.length, 0)} relationships</span>}
      >
        {grouped.length > 0 ? (
          <div className="stack-list">
            {grouped.map((group) => (
              <div key={group.name} className="page-panel">
                <div className="page-panel-header">
                  <h4>{group.name}</h4>
                  <span className="badge">{group.relationships.length}</span>
                </div>
                <div className="report-list">
                  {Array.from(
                    group.relationships.reduce<
                      Map<
                        string,
                        {
                          source: ReturnType<typeof getRelationshipPair>["source"];
                          related: Array<ReturnType<typeof getRelationshipPair>["related"]>;
                        }
                      >
                    >((map, relationship) => {
                      const pair = getRelationshipPair(relationship);
                      const sourceKey = pair.source ? `${pair.source.kind}:${pair.source.lid}` : `unknown:${group.name}`;
                      const existing = map.get(sourceKey) ?? { source: pair.source, related: [] };

                      if (pair.related && !existing.related.some((item) => item?.kind === pair.related?.kind && item?.lid === pair.related?.lid)) {
                        existing.related.push(pair.related);
                      }

                      map.set(sourceKey, existing);
                      return map;
                    }, new Map()),
                  ).map(([sourceKey, entry]) => (
                    <div key={sourceKey} className="report-item report-source-group">
                      <div className="report-source-header">
                        <div className="report-source-main">
                          <span className="report-pair-label">{entry.source?.label ?? "Source product file"}</span>
                          <strong>{entry.source ? getName(entry.source.kind, entry.source.lid) : "Unknown source"}</strong>
                          {entry.source ? <div className="muted">{entry.source.lid}</div> : null}
                        </div>
                        {entry.source ? (
                          <Link className="pill-link" to={getRecordEditHref(entry.source.kind, entry.source.lid)}>
                            Open Source Record
                          </Link>
                        ) : null}
                      </div>
                      {entry.related.length > 0 ? (
                        <div className="report-related-list">
                          {entry.related.map((related) =>
                            related ? (
                              <div key={`${sourceKey}-${related.kind}-${related.lid}`} className="report-related-item">
                                <div className="report-related-copy">
                                  <span className="report-pair-label">{related.label}</span>
                                  <strong>{getName(related.kind, related.lid)}</strong>
                                  <div className="muted">{related.lid}</div>
                                </div>
                                <Link className="pill-link" to={getRecordEditHref(related.kind, related.lid)}>
                                  Open Related Record
                                </Link>
                              </div>
                            ) : null,
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="page-panel page-panel-muted">
            <p className="page-subtitle">No hidden relationship types currently need cleanup.</p>
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
