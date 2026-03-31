import type {
  DatasetRecord,
  HarvestResponse,
  JobCheckRecord,
  LookupRelationship,
  RelationshipType,
  StatusListItem,
  TagRecord,
  ToolRecord,
} from "@/types";

type TemplateFactory<T> = () => T;

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
};

export const isEmptyObject = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(([key, item]) => key.startsWith("$$") || !hasValue(item));
};

export function sanitizeFormObject<T extends Record<string, unknown>>(
  formObject: T | null | undefined,
  templateModel: TemplateFactory<T>,
) {
  if (!formObject) {
    return null;
  }

  const sanitized = templateModel();
  for (const [key, value] of Object.entries(formObject)) {
    if (!Object.prototype.hasOwnProperty.call(formObject, key) || key.startsWith("$$") || !hasValue(value)) {
      continue;
    }
    if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.filter((item) => !isEmptyObject(item)) as T[keyof T];
    } else {
      sanitized[key as keyof T] = (isEmptyObject(value) ? null : value) as T[keyof T];
    }
  }

  const tagList = (sanitized as Record<string, unknown>).tags;
  if (Array.isArray(tagList)) {
    (sanitized as Record<string, unknown>).tags = tagList.map((tag) =>
      typeof tag === "string" ? tag : (tag as { name: string }).name,
    );
  }

  return sanitized;
}

export function prepForForm<T extends Record<string, unknown>>(
  model: T | null | undefined,
  templateFn: TemplateFactory<T>,
) {
  if (!model) {
    return null;
  }

  const template = templateFn();
  const prepped = { ...model } as T;
  for (const key of Object.keys(template)) {
    if (prepped[key as keyof T] === undefined) {
      prepped[key as keyof T] = template[key as keyof T];
    }
  }

  if ((prepped as Record<string, unknown>).start_date) {
    (prepped as Record<string, unknown>).start_date = new Date((prepped as Record<string, unknown>).start_date as string);
  }
  if ((prepped as Record<string, unknown>).end_date) {
    (prepped as Record<string, unknown>).end_date = new Date((prepped as Record<string, unknown>).end_date as string);
  }
  const preppedTags = (prepped as Record<string, unknown>).tags;
  if (Array.isArray(preppedTags)) {
    (prepped as Record<string, unknown>).tags = preppedTags.map((tag) =>
      typeof tag === "object" && tag && "name" in tag ? tag : { name: tag as string },
    );
  }

  return prepped;
}

export const isBundle = (lidvid?: string | null) => {
  if (!lidvid) {
    return false;
  }
  const lid = lidvid.split("::")[0];
  return lid.split(":").length === 4;
};

export function buildDatasetAutocomplete(
  datasets: DatasetRecord[],
  model: string,
  current: string,
  parentObj?: keyof DatasetRecord,
  activeLogicalIdentifier?: string,
) {
  let values = [current];
  let fieldPool: unknown[] = datasets;

  if (parentObj) {
    fieldPool = datasets.reduce<unknown[]>((pool, dataset) => {
      const item = dataset[parentObj];
      if (!item) {
        return pool;
      }
      return Array.isArray(item) ? pool.concat(item) : [...pool, item];
    }, []);

    if (parentObj === "related_data") {
      const otherDatasets = datasets.filter((dataset) => dataset.logical_identifier !== activeLogicalIdentifier);
      if (model === "name") {
        values = values.concat(otherDatasets.map((dataset) => String(dataset.display_name ?? "")));
      } else if (model === "lid") {
        values = values.concat(
          otherDatasets.map((dataset) => String(dataset.logical_identifier ?? "").split("::")[0]),
        );
      }
    }
  }

  return values.concat(
    fieldPool
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>)[model] : undefined))
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .reduce<string[]>((pool, item) => (pool.includes(item) ? pool : [...pool, item]), []),
  );
}

export function prepDatasetsFromHarvest(harvested: Pick<HarvestResponse, "bundle" | "collections"> | null | undefined) {
  const mapping = {
    logical_identifier: "lidvid",
    display_name: "name",
    display_description: "abstract",
    browse_url: "browseUrl",
    target_lid: "target_lid",
    target_name: "target_name",
    mission_lid: "mission_lid",
    instrument_lid: "instrument_lid",
  } as const;

  const prep = (fromHarvest?: HarvestResponse["bundle"] | HarvestResponse["collections"][number] | null): DatasetRecord | null => {
    if (!fromHarvest) {
      return null;
    }

    const dataset: DatasetRecord = {
      tags: [],
      tools: [],
      publication: {},
      example: {},
      related_data: [],
      superseded_data: [],
      download_packages: [],
    };

    for (const [datasetKey, harvestKey] of Object.entries(mapping)) {
      const value = fromHarvest[harvestKey as keyof typeof fromHarvest];
      if (typeof value === "string" && value.length > 0) {
        dataset[datasetKey as keyof DatasetRecord] = value as never;
      }
    }

    return dataset;
  };

  return {
    bundle: prep(harvested?.bundle),
    collections: (harvested?.collections ?? [])
      .map((collection) => prep(collection))
      .filter((collection): collection is DatasetRecord => Boolean(collection)),
  };
}

export const isValidUrn = (value?: string | null) =>
  Boolean(value && value.startsWith("urn:") && value.split(":").length > 3);

export function mergeRelationshipsByLid(
  existing: LookupRelationship[],
  incoming: LookupRelationship[],
) {
  const merged = [...existing];
  for (const candidate of incoming) {
    const prior = merged.find((item) => item.lid === candidate.lid);
    if (!prior) {
      merged.push(candidate);
      continue;
    }
    prior.name = candidate.name;
    prior.relationshipId = candidate.relationshipId;
    prior.label = candidate.label;
  }
  return merged;
}

export function hydrateToolSelection(tools: ToolRecord[], selected: Array<string | { toolId: string; directUrl?: string }>) {
  const normalizedSelected = selected.map((item) =>
    typeof item === "string" ? { toolId: item } : item,
  );
  return tools.map((tool) => {
    const existing = normalizedSelected.find((item) => item.toolId === tool.toolId);
    return {
      ...tool,
      name: tool.name ?? tool.display_name ?? tool.toolId,
      selected: Boolean(existing),
      directUrl: existing?.directUrl,
    };
  });
}

export function deriveSelectedTools(tools: ToolRecord[]) {
  return tools
    .filter((tool) => tool.selected)
    .map((tool) => ({ toolId: tool.toolId, directUrl: tool.directUrl }));
}

export function classifyDatasetStatusRows(items: StatusListItem[]) {
  return items.map((dataset) => {
    if (!isBundle(dataset.lid)) {
      return {
        ...dataset,
        is_bundle: false,
        bundle_lid: dataset.lid.split(":").slice(0, 4).join(":"),
        context: "",
      };
    }

    return {
      ...dataset,
      is_bundle: true,
      bundle_lid: dataset.lid.split("::")[0],
      context:
        dataset.context && dataset.context.split("_").length > 1
          ? dataset.context
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")
          : "Missing Context!",
    };
  });
}

export function groupItems<T extends Record<string, unknown>>(items: T[], groupBy?: string, groupSort: "name" | "first-item" = "name") {
  const groups: Array<{ name?: string; items: T[] }> = [];
  const ungrouped: T[] = [];

  if (!groupBy) {
    return { groups: [{ items }], ungrouped };
  }

  for (const item of items) {
    const value = item[groupBy];
    if (!value || typeof value !== "string") {
      ungrouped.push(item);
      continue;
    }
    let group = groups.find((entry) => entry.name === value);
    if (!group) {
      group = { name: value, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  if (groupSort === "name") {
    groups.sort((left, right) => (left.name ?? "").localeCompare(right.name ?? ""));
  }
  return { groups, ungrouped };
}

export function getGroupTitleLookupLids(groups: Array<{ name?: string }>) {
  return groups.filter((group) => group.name?.startsWith("urn:")).map((group) => group.name!) as string[];
}

export function groupRelationshipTypes(types: RelationshipType[]) {
  const groups = {
    always: [] as RelationshipType[],
    sometimes: [] as RelationshipType[],
    never: [] as RelationshipType[],
  };
  for (const type of types) {
    if (type.order < 100) {
      groups.always.push(type);
    } else if (type.order < 1000) {
      groups.sometimes.push(type);
    } else {
      groups.never.push(type);
    }
  }
  for (const key of Object.keys(groups) as Array<keyof typeof groups>) {
    groups[key].sort((left, right) => left.order - right.order);
  }
  return groups;
}

export function flattenRelationshipTypeGroups(groups: Record<"always" | "sometimes" | "never", RelationshipType[]>) {
  const withOffsets = (items: RelationshipType[], offset: number) =>
    items.map((type, index) => ({ ...type, order: offset + index }));

  return [
    ...withOffsets(groups.always, 0),
    ...withOffsets(groups.sometimes, 100),
    ...withOffsets(groups.never, 1000),
  ];
}

export function extractDistinctGroups(tags: TagRecord[]) {
  return [...new Set(tags.map((tag) => tag.group).filter((group): group is string => Boolean(group)))];
}

export function parseDelimitedLines(value: string) {
  return [...new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))];
}

export function getJobStatusTone(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "completed":
    case "success":
      return "success";
    case "running":
    case "in_progress":
    case "processing":
      return "info";
    case "queued":
    case "pending":
      return "pending";
    case "warning":
      return "warning";
    case "failed":
    case "error":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function humanizeJobStatus(status?: string | null) {
  if (!status) {
    return "Unknown";
  }
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatTimestamp(value?: string | null) {
  if (!value) {
    return "Not available";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function summarizeJobRequest(record: Pick<JobCheckRecord, "request">) {
  return [record.request.depth, record.request.mode, record.request.file_types].filter(Boolean).join(" • ");
}
