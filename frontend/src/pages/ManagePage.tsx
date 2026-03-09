import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { classifyDatasetStatusRows, getGroupTitleLookupLids } from "@/lib/domain";
import { ManageTable } from "@/components/ManageTable";

type ManageMode = "datasets" | "targets" | "missions" | "spacecraft" | "instruments";

const titleLookupField = ["title"];
const primaryActionLabel: Record<ManageMode, string> = {
  datasets: "Load Dataset",
  targets: "Add Target",
  missions: "Add Mission",
  spacecraft: "Add Spacecraft",
  instruments: "Add Instrument",
};

export function ManagePage({
  title,
  statusType,
  entityType,
  mode,
}: {
  title: string;
  statusType: string;
  entityType: string;
  mode: ManageMode;
}) {
  const navigate = useNavigate();
  const [showCollections, setShowCollections] = useState(false);
  const status = useQuery({
    queryKey: ["status", statusType],
    queryFn: () => api.getStatus(statusType),
  });

  const items = useMemo(() => {
    if (!status.data) {
      return [];
    }
    if (mode !== "datasets") {
      return status.data.results;
    }
    const classified = classifyDatasetStatusRows(status.data.results);
    return showCollections ? classified : classified.filter((item) => item.is_bundle);
  }, [mode, showCollections, status.data]);

  const groupLookupLids = useMemo(() => {
    if (mode === "instruments") {
      return getGroupTitleLookupLids(
        [...new Set(items.map((item) => item.spacecraft).filter((item): item is string => Boolean(item)))].map((name) => ({
          name,
        })),
      );
    }
    if (mode === "datasets" && showCollections) {
      return getGroupTitleLookupLids(
        [...new Set(items.map((item) => item.bundle_lid).filter((item): item is string => Boolean(item)))].map((name) => ({
          name,
        })),
      );
    }
    return [];
  }, [items, mode, showCollections]);

  const lookups = useQuery({
    queryKey: ["group-lookups", statusType, groupLookupLids],
    queryFn: async () => {
      const entries = await Promise.all(
        groupLookupLids.map(async (lid) => {
          const result = await api.getLookup(lid, titleLookupField);
          return [lid, Array.isArray(result.title) ? result.title[0] : lid] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: groupLookupLids.length > 0,
  });

  if (status.isLoading) {
    return <div className="page-state">Loading {title.toLowerCase()}...</div>;
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <div className="page-header-actions">
          {mode === "datasets" ? (
            <label className="toolbar page-toggle">
              <input type="checkbox" checked={showCollections} onChange={(event) => setShowCollections(event.target.checked)} />
              Show Collections
            </label>
          ) : null}
          <button type="button" className="button-primary" onClick={() => navigate(`/${mode}/${mode === "datasets" ? "load" : "import"}`)}>
            {primaryActionLabel[mode]}
          </button>
        </div>
      </div>
      <p>There are {items.length} records in this view.</p>
      <ManageTable
        items={items}
        editHref={(lid) => `/${mode}/import?edit=${encodeURIComponent(lid)}`}
        onDelete={async (item) => {
          if (!window.confirm(`Delete ${item.name}?`)) {
            return;
          }
          await api.deleteEntity(entityType, item.lid);
          await status.refetch();
        }}
        showContext={mode === "datasets"}
        showTags={mode === "datasets" || mode === "targets" || mode === "spacecraft" || mode === "instruments"}
        showReady={mode === "missions"}
        groupBy={mode === "instruments" ? "spacecraft" : mode === "datasets" && showCollections ? "bundle_lid" : undefined}
        groupLabels={lookups.data}
      />
    </div>
  );
}
