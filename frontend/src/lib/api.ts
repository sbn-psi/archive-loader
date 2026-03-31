import type {
  ContextObjectRecord,
  ContextOverviewResponse,
  DatasetRecord,
  EditResponse,
  HarvestResponse,
  JobCheckDetailResponse,
  JobCheckListResponse,
  LoginResponse,
  LookupRelationship,
  MissingContextDatasetsResponse,
  ObjectRelationshipStatus,
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

const appBasePath = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${appBasePath}/api`;

export const api = {
  getUser: () => request<LoginResponse>(`${API_BASE}/user`),
  login: (body: { username: string; password: string }) =>
    request<LoginResponse>(`${API_BASE}/login`, { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<void>(`${API_BASE}/logout`),

  getStatus: (type: string) => request<StatusListResponse>(`${API_BASE}/status/${type}`),
  getTags: (type: string) => request<TagRecord[]>(`${API_BASE}/tags/${type}`),
  getTools: () => request<ToolRecord[]>(`${API_BASE}/status/tools`),
  getLookup: (lid: string, fields: string[]) =>
    request<Record<string, string[]>>(`${API_BASE}/lookup?lid=${encodeURIComponent(lid)}&fields=${encodeURIComponent(fields.join(","))}`),
  getRelated: (to: string, from: string, lid: string) =>
    request<LookupRelationship[]>(`${API_BASE}/related/${to}?${from}=${encodeURIComponent(lid)}`),
  getRelationshipTypes: (type: string) => request<RelationshipType[]>(`${API_BASE}/relationship-types/${type}`),
  saveRelationshipTypes: (type: string, body: RelationshipType[]) =>
    request(`${API_BASE}/relationship-types/${type}`, { method: "POST", body: JSON.stringify(body) }),
  removeRelationshipType: (type: string, body: RelationshipType) =>
    request(`${API_BASE}/relationship-types/${type}/remove`, { method: "POST", body: JSON.stringify(body) }),

  getDatasetEdit: (lid: string) =>
    request<EditResponse<DatasetRecord>>(`${API_BASE}/edit/datasets?logical_identifier=${encodeURIComponent(lid)}`),
  getContextEdit: (type: string, lid: string) =>
    request<EditResponse<ContextObjectRecord>>(`${API_BASE}/edit/${type}?logical_identifier=${encodeURIComponent(lid)}`),

  saveDatasets: (body: { bundle: DatasetRecord | null; collections: DatasetRecord[] }) =>
    request(`${API_BASE}/save/datasets`, { method: "POST", body: JSON.stringify(body) }),
  saveContextObject: (type: string, body: ContextObjectRecord) =>
    request(`${API_BASE}/save/${type}`, { method: "POST", body: JSON.stringify(body) }),
  saveRelationships: (body: Record<string, unknown>[]) =>
    request(`${API_BASE}/save/relationships`, { method: "POST", body: JSON.stringify(body) }),
  saveTag: (body: TagRecord) => request(`${API_BASE}/save/tag`, { method: "POST", body: JSON.stringify(body) }),

  deleteEntity: (type: string, lid: string) => request(`${API_BASE}/delete/${type}/${encodeURIComponent(lid)}`, { method: "DELETE" }),
  deleteTag: (type: string, name: string) =>
    request(`${API_BASE}/delete/tag/${type}/${encodeURIComponent(name)}`, { method: "DELETE" }),

  harvestDataset: (url: string) => request<HarvestResponse>(`${API_BASE}/datasets/harvest?url=${encodeURIComponent(url)}`),
  ingestHarvest: (xml: string) => request(`${API_BASE}/solr/harvest`, { method: "POST", body: JSON.stringify({ xml }) }),

  getLastIndex: () => request<Record<string, number | string>>(`${API_BASE}/solr/last-index`),
  getSyncStatus: async () => {
    try {
      await request(`${API_BASE}/solr/status`);
      return true;
    } catch {
      return false;
    }
  },
  getSuffixSuggestion: () => request<string>(`${API_BASE}/solr/suffix-suggestion`),
  syncSolr: (suffix: string) => request<Record<string, unknown>>(`${API_BASE}/solr/sync`, { method: "POST", body: JSON.stringify({ suffix }) }),

  getTargetRelationshipStatus: () =>
    request<{ targets: Array<{ lid: string; name: string }>; relationships: Record<string, unknown>[] }>(`${API_BASE}/status/target-relationships`),
  saveTargetRelationships: (body: Record<string, unknown>) =>
    request(`${API_BASE}/save/target-relationships`, { method: "POST", body: JSON.stringify(body) }),
  getRelationshipStatus: () => request<ObjectRelationshipStatus[]>(`${API_BASE}/status/relationships`),
  getDatasetsMissingContext: () => request<MissingContextDatasetsResponse>(`${API_BASE}/status/datasets-missing-context`),
  getContextOverview: () => request<ContextOverviewResponse>(`${API_BASE}/status/context-overview`),
  getJobChecks: (providerId: string) => request<JobCheckListResponse>(`${API_BASE}/job-checks/${encodeURIComponent(providerId)}`),
  createJobCheck: (providerId: string, body: Record<string, unknown>) =>
    request<{ record: JobCheckListResponse["results"][number] }>(`${API_BASE}/job-checks/${encodeURIComponent(providerId)}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getJobCheckDetail: (providerId: string, jobId: string, query?: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      search.set(key, String(value));
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return request<JobCheckDetailResponse>(`${API_BASE}/job-checks/${encodeURIComponent(providerId)}/${encodeURIComponent(jobId)}${suffix}`);
  },

  uploadImage: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${API_BASE}/image/upload`, {
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
