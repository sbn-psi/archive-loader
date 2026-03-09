import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export function DatasetLoadPage({ onError }: { onError: (message: string | null) => void }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.harvestDataset>> | null>(null);

  return (
    <div className="page-card">
      <h1 className="page-title">Load Archived Dataset</h1>
      <div className="field">
        <label>Archive URL</label>
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </div>
      <div className="button-row">
        <button
          type="button"
          className="button-primary"
          disabled={loading || !url}
          onClick={async () => {
            try {
              setLoading(true);
              onError(null);
              const result = await api.harvestDataset(url);
              setPreview(result);
            } catch (error) {
              onError(error instanceof Error ? error.message : "Dataset fetch failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Fetching Preview..." : "Fetch Preview"}
        </button>
      </div>
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
            <h3>Ingest Preview</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{preview.harvestOutput}</pre>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              onClick={async () => {
                try {
                  setLoading(true);
                  onError(null);
                  await api.ingestHarvest(preview.harvestOutput);
                  sessionStorage.setItem("dataset-harvest", JSON.stringify(preview));
                  navigate("/datasets/import");
                } catch (error) {
                  onError(error instanceof Error ? error.message : "Dataset ingest failed");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Loading Dataset..." : "Load and Continue"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
