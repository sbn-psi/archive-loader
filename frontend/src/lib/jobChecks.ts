export type JobCheckProviderDefinition = {
  id: string;
  jobType: string;
  title: string;
  subtitle: string;
  createButtonLabel: string;
  defaultRequest: {
    lids: string[];
    depth: string;
    mode: string;
    file_types: string;
    webhook_url: string;
    webhook_secret: string;
  };
  depthOptions: Array<{ value: string; label: string; description: string }>;
  modeOptions: Array<{ value: string; label: string; description: string }>;
  fileTypeOptions: Array<{ value: string; label: string; description: string }>;
};

export const registryIntegrityProvider: JobCheckProviderDefinition = {
  id: "registry-integrity",
  jobType: "registry_verification",
  title: "Registry Integrity",
  subtitle: "Create and monitor registry verification jobs while keeping the dashboard decoupled from the underlying job service.",
  createButtonLabel: "Create Integrity Job",
  defaultRequest: {
    lids: [],
    depth: "product",
    mode: "head",
    file_types: "all",
    webhook_url: "",
    webhook_secret: "",
  },
  depthOptions: [
    { value: "product", label: "Product", description: "Verify bundles, collections, and all products recursively." },
    { value: "collection", label: "Collection", description: "Verify bundle and collection files without descending to products." },
    { value: "bundle", label: "Bundle", description: "Verify only the bundle-level files." },
  ],
  modeOptions: [
    { value: "head", label: "HEAD", description: "Fast reachability checks using HTTP HEAD requests." },
    { value: "checksum", label: "Checksum", description: "Download files and verify MD5 checksums against the Registry." },
  ],
  fileTypeOptions: [
    { value: "all", label: "All Files", description: "Verify both labels and data files." },
    { value: "labels", label: "Labels Only", description: "Verify only PDS label files." },
    { value: "data", label: "Data Only", description: "Verify only data products." },
  ],
};
