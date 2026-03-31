export type LoginResponse = {
  user: string;
};

export type StatusListItem = {
  name: string;
  lid: string;
  tags?: string[];
  is_ready?: boolean;
  context?: string;
  spacecraft?: string | null;
  bundle_lid?: string;
  is_bundle?: boolean;
  updated_at?: string | null;
};

export type StatusListResponse = {
  count: number;
  results: StatusListItem[];
};

export type MissingContextDataset = {
  name: string;
  lid: string;
  updated_at?: string | null;
};

export type MissingContextDatasetsResponse = {
  count: number;
  results: MissingContextDataset[];
};

export type ObjectRelationshipStatus = {
  relationshipId?: string | null;
  label?: string | null;
  target?: string | null;
  instrument?: string | null;
  instrument_host?: string | null;
  investigation?: string | null;
  bundle?: string | null;
};

export type TagRecord = {
  name: string;
  type: string;
  group?: string;
};

export type ToolRecord = {
  toolId: string;
  name?: string;
  display_name?: string;
  image_url: string;
  url?: string;
  directUrl?: string;
  selected?: boolean;
};

export type RelationshipType = {
  relationshipId?: string;
  name: string;
  order: number;
};

export type LookupRelationship = {
  lid: string;
  name?: string;
  relationshipId?: string | null;
  label?: string | null;
};

export type EditResponse<T> = {
  object: T;
  relationships: Record<string, unknown>[];
};

export type DatasetRecord = {
  logical_identifier?: string;
  display_name?: string;
  display_description?: string;
  browse_url?: string;
  download_url?: string;
  download_size?: string;
  dataset_info_url?: string;
  doi?: string;
  citation?: string;
  primary_context?: string;
  html1?: string;
  html2?: string;
  tags?: string[] | { name: string }[];
  tools?: { toolId: string; directUrl?: string }[];
  publication?: Record<string, unknown>;
  example?: Record<string, unknown>;
  related_data?: Record<string, unknown>[];
  superseded_data?: Record<string, unknown>[];
  download_packages?: Record<string, unknown>[];
  target_lid?: string;
  target_name?: string;
  mission_lid?: string;
  instrument_lid?: string;
};

export type ContextObjectRecord = {
  logical_identifier?: string;
  display_name?: string;
  display_description?: string;
  image_url?: string;
  html1?: string;
  html2?: string;
  tags?: string[] | { name: string }[];
  tools?: { toolId: string; directUrl?: string }[];
  derived_html?: string;
  start_date?: string | Date;
  end_date?: string | Date;
  mission_bundle?: string;
  instrument_bundle?: string;
  other_html?: string;
  is_ready?: boolean;
  mission_override?: string;
  pds3_instrument_id?: string;
  pds3_instrument_host_id?: string;
  updated_at?: string | null;
};

export type RecentContextItem = {
  lid: string;
  name: string;
  type: "mission" | "spacecraft" | "instrument" | "target";
  updated_at?: string | null;
};

export type ContextOverviewGroup = {
  mission: RecentContextItem;
  missions: RecentContextItem[];
  spacecraft: RecentContextItem[];
  instruments: RecentContextItem[];
  targets: RecentContextItem[];
  latest_updated_at?: string | null;
};

export type ContextOverviewResponse = {
  counts: {
    missions: number;
    spacecraft: number;
    instruments: number;
    targets: number;
  };
  groups: ContextOverviewGroup[];
  standalone: {
    spacecraft: RecentContextItem[];
    instruments: RecentContextItem[];
    targets: RecentContextItem[];
  };
};

export type HarvestResponse = {
  bundle: {
    name: string;
    lidvid: string;
    lid: string;
    browseUrl: string;
    abstract?: string;
    target_lid?: string;
    target_name?: string;
    mission_lid?: string;
    instrument_lid?: string;
  } | null;
  collections: Array<{
    name: string;
    lidvid: string;
    lid: string;
    browseUrl: string;
    abstract?: string;
    target_lid?: string;
    target_name?: string;
    mission_lid?: string;
    instrument_lid?: string;
  }>;
  harvestOutput: string;
};

export type JobCheckRecord = {
  providerId: string;
  jobId: string;
  jobType: string;
  title: string;
  request: {
    lids: string[];
    depth: string;
    mode: string;
    file_types: string;
    webhook_url?: string | null;
    webhook_secret_configured?: boolean;
  };
  status: string;
  summary: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  remoteCreatedAt: string | null;
  remoteStartedAt: string | null;
  remoteCompletedAt: string | null;
  webhookConfigured: boolean;
  webhookSecretConfigured: boolean;
  syncError: string | null;
};

export type JobCheckListResponse = {
  provider: {
    id: string;
    jobType: string;
  };
  count: number;
  results: JobCheckRecord[];
};

export type JobCheckIssueList = {
  warnings?: unknown[];
  errors?: unknown[];
  [key: string]: unknown;
} | null;

export type JobCheckResultsPage = {
  page?: number;
  page_size?: number;
  total_pages?: number;
  total?: number;
  results?: Array<{
    id?: string;
    result_type?: string;
    status?: string;
    timestamp?: string;
    result_data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
} | null;

export type JobCheckDetailResponse = {
  record: JobCheckRecord;
  remoteJob: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  issues: JobCheckIssueList;
  results: JobCheckResultsPage;
};
