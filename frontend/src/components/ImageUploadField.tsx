import { useState } from "react";
import { api } from "@/lib/api";

type ImageUploadFieldProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
};

export function ImageUploadField({ label, value, onChange, onError }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className="page-card">
      <h3>{label}</h3>
      {value ? <img src={value} alt="" style={{ maxWidth: "240px", display: "block", marginBottom: "0.75rem" }} /> : null}
      <div className="field">
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            try {
              setUploading(true);
              const result = await api.uploadImage(file);
              onChange(result.url);
            } catch (error) {
              onError(error instanceof Error ? error.message : "Image upload failed");
            } finally {
              setUploading(false);
            }
          }}
        />
      </div>
      <div className="field">
        <input type="url" value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder="Image URL" />
      </div>
      {uploading ? <p>Uploading...</p> : null}
    </div>
  );
}
