export type NavVisibility = "active" | "comingSoon" | "hiddenFromNav";

export type NavItem = {
  id: string;
  label: string;
  to: string;
  description?: string;
  legacyLabel?: string;
  visibility?: NavVisibility;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export type PageMeta = {
  title: string;
  subtitle?: string;
  legacyLabel?: string;
  visibility?: NavVisibility;
};

export const pageMeta = {
  workbench: {
    title: "Workbench",
    subtitle: "Start with the task you need to complete.",
  },
  datasetsBrowse: {
    title: "Browse Datasets",
    subtitle: "Review datasets prepared for Archive Navigator and open any one for editing.",
    legacyLabel: "Formerly dataset management",
  },
  datasetsLoad: {
    title: "Load Datasets",
    subtitle: "Preview archive content and bring detected bundle or collection records into the dataset editor.",
    legacyLabel: "Formerly Load Archived Dataset",
  },
  datasetDetails: {
    title: "Dataset Details",
    subtitle: "Edit the display, access, and page content used for datasets that appear in Archive Navigator.",
    legacyLabel: "Formerly Dataset Import",
  },
  contextObjectsHome: {
    title: "Context Objects",
    subtitle: "Browse missions, targets, spacecraft, and instruments.",
  },
  missionsBrowse: {
    title: "Missions",
    subtitle: "Browse mission records and open them for editing.",
    legacyLabel: "Formerly mission management",
  },
  spacecraftBrowse: {
    title: "Spacecraft",
    subtitle: "Browse spacecraft records and open them for editing.",
    legacyLabel: "Formerly spacecraft management",
  },
  instrumentsBrowse: {
    title: "Instruments",
    subtitle: "Browse instrument records and open them for editing.",
    legacyLabel: "Formerly instrument management",
  },
  targetsBrowse: {
    title: "Targets",
    subtitle: "Browse target records and open them for editing.",
    legacyLabel: "Formerly target management",
  },
  missionDetails: {
    title: "Mission Details",
    subtitle: "Edit mission display information and page content.",
    legacyLabel: "Formerly Add Mission",
  },
  spacecraftDetails: {
    title: "Spacecraft Details",
    subtitle: "Edit spacecraft display information and page content.",
    legacyLabel: "Formerly Add Spacecraft",
  },
  instrumentDetails: {
    title: "Instrument Details",
    subtitle: "Edit instrument display information and page content.",
    legacyLabel: "Formerly Add Instrument",
  },
  targetDetails: {
    title: "Target Details",
    subtitle: "Edit target display information and page content.",
    legacyLabel: "Formerly Add Target",
  },
  targetRelationships: {
    title: "Target Relationships",
    subtitle: "Review and update target-to-target relationships.",
    legacyLabel: "Formerly Relate Targets",
  },
  publishing: {
    title: "Publish to Archive Navigator",
    subtitle: "Publish the current Archive Loader content to Archive Navigator.",
    legacyLabel: "Formerly Sync Data",
  },
  publishingIssues: {
    title: "Publishing Issues",
    subtitle: "Review issues that can affect what appears on Archive Navigator.",
    legacyLabel: "Formerly Reported Issues",
  },
  relationshipTypes: {
    title: "Relationship Types",
    subtitle: "Manage the relationship labels used between context objects.",
  },
  tagGroups: {
    title: "Target Tag Groups",
    subtitle: "Organize target tags into reusable groups.",
    legacyLabel: "Formerly Target Tags",
  },
  registryValidate: {
    title: "Validate Archive",
    subtitle: "Validation jobs will check archive content for PDS4 compliance before downstream loading or publishing.",
    visibility: "comingSoon",
  },
  registryHarvest: {
    title: "Harvest to Registry",
    subtitle: "Upcoming Registry jobs will load archive content into the external Registry without exposing the current internal publishing implementation.",
    visibility: "comingSoon",
  },
  registryIntegrity: {
    title: "Registry Integrity",
    subtitle: "Integrity checks will compare the external Registry against the archive and flag gaps or mismatches.",
  },
} satisfies Record<string, PageMeta>;

export const navSections: NavSection[] = [
  {
    id: "workbench",
    label: "Workbench",
    items: [
      {
        id: "workbench-home",
        label: pageMeta.workbench.title,
        to: "/workbench",
        description: "Task-oriented starting point for loading, editing, and publishing work.",
      },
    ],
  },
  {
    id: "datasets",
    label: "Datasets",
    items: [
      {
        id: "datasets-browse",
        label: pageMeta.datasetsBrowse.title,
        to: "/datasets/manage",
      },
      {
        id: "datasets-load",
        label: pageMeta.datasetsLoad.title,
        to: "/datasets/load",
      },
    ],
  },
  {
    id: "connected-records",
    label: "Context Objects",
    items: [
      {
        id: "connected-records-home",
        label: pageMeta.contextObjectsHome.title,
        to: "/connected-records",
      },
      {
        id: "connected-records-missions",
        label: pageMeta.missionsBrowse.title,
        to: "/connected-records/missions",
      },
      {
        id: "connected-records-spacecraft",
        label: pageMeta.spacecraftBrowse.title,
        to: "/connected-records/spacecraft",
      },
      {
        id: "connected-records-instruments",
        label: pageMeta.instrumentsBrowse.title,
        to: "/connected-records/instruments",
      },
      {
        id: "connected-records-targets",
        label: pageMeta.targetsBrowse.title,
        to: "/connected-records/targets",
      },
      {
        id: "connected-records-target-relationships",
        label: pageMeta.targetRelationships.title,
        to: "/connected-records/targets/relationships",
      },
    ],
  },
  {
    id: "publishing",
    label: "Publishing",
    items: [
      {
        id: "publishing-archive-navigator",
        label: pageMeta.publishing.title,
        to: "/publishing/archive-navigator",
      },
      {
        id: "publishing-issues",
        label: pageMeta.publishingIssues.title,
        to: "/publishing/issues",
      },
    ],
  },
  {
    id: "registry-jobs",
    label: "Registry Jobs",
    items: [
      {
        id: "registry-validate",
        label: pageMeta.registryValidate.title,
        to: "/registry-jobs/validate",
        visibility: "comingSoon",
      },
      {
        id: "registry-harvest",
        label: pageMeta.registryHarvest.title,
        to: "/registry-jobs/harvest",
        visibility: "comingSoon",
      },
      {
        id: "registry-integrity",
        label: pageMeta.registryIntegrity.title,
        to: "/registry-jobs/integrity",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "settings-relationship-types",
        label: pageMeta.relationshipTypes.title,
        to: "/settings/relationship-types",
      },
      {
        id: "settings-tags",
        label: pageMeta.tagGroups.title,
        to: "/settings/tags",
      },
    ],
  },
];

type RecordKind = "mission" | "spacecraft" | "instrument" | "target" | "bundle";

const recordEditRouteMap: Record<RecordKind, string> = {
  mission: "/missions/import",
  spacecraft: "/spacecraft/import",
  instrument: "/instruments/import",
  target: "/targets/import",
  bundle: "/datasets/import",
};

export function getRecordEditHref(kind: RecordKind, lid: string) {
  return `${recordEditRouteMap[kind]}?edit=${encodeURIComponent(lid)}`;
}

export const connectedRecordCards = [
  {
    id: "missions",
    title: pageMeta.missionsBrowse.title,
    description: "Open mission records for editing.",
    to: "/connected-records/missions",
  },
  {
    id: "spacecraft",
    title: pageMeta.spacecraftBrowse.title,
    description: "Open spacecraft records for editing.",
    to: "/connected-records/spacecraft",
  },
  {
    id: "instruments",
    title: pageMeta.instrumentsBrowse.title,
    description: "Open instrument records for editing.",
    to: "/connected-records/instruments",
  },
  {
    id: "targets",
    title: pageMeta.targetsBrowse.title,
    description: "Open target records for editing.",
    to: "/connected-records/targets",
  },
  {
    id: "target-relationships",
    title: pageMeta.targetRelationships.title,
    description: "Update target-to-target relationships.",
    to: "/connected-records/targets/relationships",
  },
];
