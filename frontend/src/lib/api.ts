import type {
  ContextObjectRecord,
  DatasetRecord,
  EditResponse,
  HarvestResponse,
  LoginResponse,
  LookupRelationship,
  RelationshipType,
  StatusListResponse,
  TagRecord,
  ToolRecord,
} from "@/types";

class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown) {
    super(typeof payload === "string" ? payload : `Request failed with ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 403 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("archive-loader:forbidden"));
    }
    throw new ApiError(response.status, payload);
  }
  return payload as T;
}

export { ApiError };

export const api = {
  getUser: () => request<LoginResponse>("/user"),
  login: (body: { username: string; password: string }) =>
    request<LoginResponse>("/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<void>("/logout"),

  getStatus: (type: string) => request<StatusListResponse>(`/status/${type}`),
  getTags: (type: string) => request<TagRecord[]>(`/tags/${type}`),
  getTools: () => request<ToolRecord[]>("/status/tools"),
  getLookup: (lid: string, fields: string[]) =>
    request<Record<string, string[]>>(`/lookup?lid=${encodeURIComponent(lid)}&fields=${encodeURIComponent(fields.join(","))}`),
  getRelated: (to: string, from: string, lid: string) =>
    request<LookupRelationship[]>(`/related/${to}?${from}=${encodeURIComponent(lid)}`),
  getRelationshipTypes: (type: string) => request<RelationshipType[]>(`/relationship-types/${type}`),
  saveRelationshipTypes: (type: string, body: RelationshipType[]) =>
    request(`/relationship-types/${type}`, { method: "POST", body: JSON.stringify(body) }),
  removeRelationshipType: (type: string, body: RelationshipType) =>
    request(`/relationship-types/${type}/remove`, { method: "POST", body: JSON.stringify(body) }),

  getDatasetEdit: (lid: string) =>
    request<EditResponse<DatasetRecord>>(`/edit/datasets?logical_identifier=${encodeURIComponent(lid)}`),
  getContextEdit: (type: string, lid: string) =>
    request<EditResponse<ContextObjectRecord>>(`/edit/${type}?logical_identifier=${encodeURIComponent(lid)}`),

  saveDatasets: (body: { bundle: DatasetRecord | null; collections: DatasetRecord[] }) =>
    request("/save/datasets", { method: "POST", body: JSON.stringify(body) }),
  saveContextObject: (type: string, body: ContextObjectRecord) =>
    request(`/save/${type}`, { method: "POST", body: JSON.stringify(body) }),
  saveRelationships: (body: Record<string, unknown>[]) =>
    request("/save/relationships", { method: "POST", body: JSON.stringify(body) }),
  saveTag: (body: TagRecord) => request("/save/tag", { method: "POST", body: JSON.stringify(body) }),

  deleteEntity: (type: string, lid: string) => request(`/delete/${type}/${encodeURIComponent(lid)}`, { method: "DELETE" }),
  deleteTag: (type: string, name: string) =>
    request(`/delete/tag/${type}/${encodeURIComponent(name)}`, { method: "DELETE" }),

  harvestDataset: (url: string) => request<HarvestResponse>(`/datasets/harvest?url=${encodeURIComponent(url)}`),
  ingestHarvest: (xml: string) => request("/solr/harvest", { method: "POST", body: JSON.stringify({ xml }) }),

  getLastIndex: () => request<Record<string, number | string>>("/solr/last-index"),
  getSyncStatus: async () => {
    try {
      await request("/solr/status");
      return true;
    } catch {
      return false;
    }
  },
  getSuffixSuggestion: () => request<string>("/solr/suffix-suggestion"),
  syncSolr: (suffix: string) => request<Record<string, unknown>>("/solr/sync", { method: "POST", body: JSON.stringify({ suffix }) }),

  getTargetRelationshipStatus: () =>
    request<{ targets: Array<{ lid: string; name: string }>; relationships: Record<string, unknown>[] }>("/status/target-relationships"),
  saveTargetRelationships: (body: Record<string, unknown>) =>
    request("/save/target-relationships", { method: "POST", body: JSON.stringify(body) }),
  getRelationshipStatus: () => request<Record<string, unknown>[]>("/status/relationships"),

  uploadImage: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/image/upload", {
      method: "POST",
      body,
      credentials: "include",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new ApiError(response.status, payload);
    }
    return payload as { url: string };
  },
};
