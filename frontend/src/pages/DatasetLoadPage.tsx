import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/LoadingState";
import { PageIntro } from "@/components/PageIntro";
import { pageMeta } from "@/lib/navigation";

export function DatasetLoadPage({ onError }: { onError: (message: string | null) => void }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<"preview" | "ingest" | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.harvestDataset>> | null>(null);

  return (
    <div className="page-card">
      <PageIntro
        title={pageMeta.datasetsLoad.title}
        subtitle={pageMeta.datasetsLoad.subtitle}
        legacyLabel={pageMeta.datasetsLoad.legacyLabel}
      />
      <div className="field">
        <label>Archive URL</label>
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </div>
      <div className="button-row">
        <button
          type="button"
          className="button-primary"
          disabled={Boolean(loadingPhase) || !url}
          onClick={async () => {
            try {
              setLoadingPhase("preview");
              onError(null);
              const result = await api.harvestDataset(url);
              setPreview(result);
            } catch (error) {
              onError(error instanceof Error ? error.message : "Dataset fetch failed");
            } finally {
              setLoadingPhase(null);
            }
          }}
        >
          {loadingPhase === "preview" ? "Preparing Preview..." : "Preview Datasets"}
        </button>
      </div>
      {loadingPhase === "preview" ? (
        <LoadingState
          compact
          title="Preparing dataset preview"
          detail="This can take a while for larger archives. You can stay on this page while the preview is built."
        />
      ) : null}
      {preview ? (
        <div className="grid two">
          <div className="page-card">
            <h3>Detected Bundle</h3>
            {preview.bundle ? (
              <>
                <p><strong>Title:</strong> {preview.bundle.name}</p>
                <p><strong>LIDVID:</strong> {preview.bundle.lidvid}</p>
                <p><strong>URL:</strong> {preview.bundle.browseUrl}</p>
              </>
            ) : (
              <p>No bundle detected.</p>
            )}
          </div>
          <div className="page-card">
            <h3>Detected Collections</h3>
            <ul>
              {preview.collections.map((collection) => (
                <li key={collection.lidvid}>
                  {collection.name} ({collection.lidvid})
                </li>
              ))}
            </ul>
          </div>
          <div className="page-card" style={{ gridColumn: "1 / -1" }}>
            <h3>Prepared Archive Data</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{preview.harvestOutput}</pre>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              onClick={async () => {
                try {
                  setLoadingPhase("ingest");
                  onError(null);
                  await api.ingestHarvest(preview.harvestOutput);
                  sessionStorage.setItem("dataset-harvest", JSON.stringify(preview));
                  navigate("/datasets/import");
                } catch (error) {
                  onError(error instanceof Error ? error.message : "Dataset ingest failed");
                } finally {
                  setLoadingPhase(null);
                }
              }}
            >
              {loadingPhase === "ingest" ? "Opening Dataset Editor..." : "Load into Editor"}
            </button>
          </div>
          {loadingPhase === "ingest" ? (
            <LoadingState
              compact
              title="Loading dataset into the editor"
              detail="Importing the prepared archive data. This can take a minute or more."
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
