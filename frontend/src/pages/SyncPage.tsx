import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/LoadingState";
import { PageIntro } from "@/components/PageIntro";
import { pageMeta } from "@/lib/navigation";

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
    return <LoadingState title="Loading publishing status" detail="Checking service availability and the most recent publish." />;
  }

  if (!available.data) {
    return (
      <div className="page-card">
        <PageIntro title={pageMeta.publishing.title} subtitle={pageMeta.publishing.subtitle} legacyLabel={pageMeta.publishing.legacyLabel} />
        <p>Publishing is unavailable right now.</p>
      </div>
    );
  }

  return (
    <div className="page-card">
      <PageIntro
        title={pageMeta.publishing.title}
        subtitle={pageMeta.publishing.subtitle}
        legacyLabel={pageMeta.publishing.legacyLabel}
        actions={
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
                onError(error instanceof Error ? error.message : "Publish failed");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Publishing..." : "Publish Update"}
          </button>
        }
      />
      <div className="field">
        <label>Publish Version Label</label>
        <input value={suffix || suggestion.data || ""} onChange={(event) => setSuffix(event.target.value)} />
      </div>
      <p className="muted">Archive Loader stages each publish with a unique label before Archive Navigator is updated.</p>
      {saving ? <LoadingState compact title="Publishing to Archive Navigator" detail="This publish can take a few minutes. Keep this page open until it finishes." /> : null}
      <div className="page-card">
        <h3>Last Successful Publish</h3>
        <pre>{JSON.stringify(lastIndex.data ?? {}, null, 2)}</pre>
      </div>
    </div>
  );
}
