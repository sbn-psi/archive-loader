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
};

export type StatusListResponse = {
  count: number;
  results: StatusListItem[];
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
};

export type HarvestResponse = {
  bundle: {
    name: string;
    lidvid: string;
    lid: string;
    browseUrl: string;
  } | null;
  collections: Array<{
    name: string;
    lidvid: string;
    lid: string;
    browseUrl: string;
  }>;
  harvestOutput: string;
};
