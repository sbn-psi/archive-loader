import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function SyncPage({ onError }: { onError: (message: string | null) => void }) {
  const [saving, setSaving] = useState(false);
  const [suffix, setSuffix] = useState("");
  const lastIndex = useQuery({ queryKey: ["sync", "last-index"], queryFn: api.getLastIndex });
  const available = useQuery({ queryKey: ["sync", "status"], queryFn: api.getSyncStatus });
  const suggestion = useQuery({
    queryKey: ["sync", "suggestion"],
    queryFn: api.getSuffixSuggestion,
    enabled: available.data === true,
  });

  useEffect(() => {
    if (suggestion.data) {
      setSuffix(suggestion.data);
    }
  }, [suggestion.data]);

  if (lastIndex.isLoading || available.isLoading) {
    return <div className="page-state">Loading sync status...</div>;
  }

  if (!available.data) {
    return (
      <div className="page-card">
        <h1 className="page-title">Sync Data</h1>
        <p>Sync service is unavailable right now.</p>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <h1 className="page-title">Sync Data</h1>
        <div className="page-header-actions">
          <button
            type="button"
            className="button-primary"
            disabled={saving}
            onClick={async () => {
              try {
                setSaving(true);
                await api.syncSolr(suffix || suggestion.data || "");
                await lastIndex.refetch();
                await suggestion.refetch();
              } catch (error) {
                onError(error instanceof Error ? error.message : "Sync failed");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Running Sync..." : "Run Sync"}
          </button>
        </div>
      </div>
      <div className="field">
        <label>Suffix</label>
        <input value={suffix || suggestion.data || ""} onChange={(event) => setSuffix(event.target.value)} />
      </div>
      <pre>{JSON.stringify(lastIndex.data ?? {}, null, 2)}</pre>
    </div>
  );
}
