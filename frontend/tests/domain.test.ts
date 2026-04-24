import {
  buildDatasetAutocomplete,
  buildHierarchicalGroups,
  classifyDatasetStatusRows,
  deriveSelectedTools,
  flattenRelationshipTypeGroups,
  groupRelationshipTypes,
  hydrateToolSelection,
  isBundle,
  mergeRelationshipsByLid,
  prepDatasetsFromHarvest,
  prepForForm,
  sanitizeFormObject,
} from "@/lib/domain";

describe("domain behavior parity", () => {
  it("sanitizes tags and trims empty repeated objects", () => {
    const result = sanitizeFormObject(
      { tags: [{ name: "science" }], related_data: [{}, { name: "Kept" }] },
      () => ({ tags: [], related_data: [] }),
    );
    expect(result).toEqual({ tags: ["science"], related_data: [{ name: "Kept" }] });
  });

  it("hydrates dates and tag objects for edit mode", () => {
    const result = prepForForm(
      { start_date: "2024-01-01T00:00:00.000Z", tags: ["science"] },
      () => ({ tags: [], start_date: undefined }),
    );
    expect(result?.start_date).toBeInstanceOf(Date);
    expect(result?.tags).toEqual([{ name: "science" }]);
  });

  it("builds dataset autocomplete from in-memory data", () => {
    const results = buildDatasetAutocomplete(
      [{ logical_identifier: "urn:one", display_name: "One" }, { logical_identifier: "urn:two", display_name: "Two" }],
      "display_name",
      "Current",
    );
    expect(results).toEqual(["Current", "One", "Two"]);
  });

  it("maps harvested datasets into editor fields", () => {
    const result = prepDatasetsFromHarvest({
      bundle: {
        name: "Psyche Bundle",
        lidvid: "urn:nasa:pds:psyche.bundle::1.0",
        lid: "urn:nasa:pds:psyche.bundle",
        browseUrl: "https://example.test/browse",
        abstract: "Imported description",
        mission_lid: "urn:nasa:pds:mission",
      },
      collections: [
        {
          name: "Documents",
          lidvid: "urn:nasa:pds:psyche.bundle:document::1.0",
          lid: "urn:nasa:pds:psyche.bundle:document",
          browseUrl: "https://example.test/document",
        },
      ],
    });

    expect(result.bundle).toMatchObject({
      logical_identifier: "urn:nasa:pds:psyche.bundle::1.0",
      display_name: "Psyche Bundle",
      display_description: "Imported description",
      browse_url: "https://example.test/browse",
      mission_lid: "urn:nasa:pds:mission",
    });
    expect(result.collections[0]).toMatchObject({
      logical_identifier: "urn:nasa:pds:psyche.bundle:document::1.0",
      display_name: "Documents",
      browse_url: "https://example.test/document",
    });
  });

  it("merges relationship lookups by lid", () => {
    const merged = mergeRelationshipsByLid([{ lid: "urn:a", relationshipId: "x" }], [{ lid: "urn:a", relationshipId: "y" }, { lid: "urn:b" }]);
    expect(merged).toEqual([{ lid: "urn:a", relationshipId: "y", label: undefined, name: undefined }, { lid: "urn:b" }]);
  });

  it("hydrates and derives related tools", () => {
    const hydrated = hydrateToolSelection([{ toolId: "x", image_url: "" }], ["x"]);
    expect(hydrated[0].selected).toBe(true);
    expect(deriveSelectedTools(hydrated)).toEqual([{ toolId: "x", directUrl: undefined }]);
  });

  it("classifies dataset manage rows", () => {
    const rows = classifyDatasetStatusRows([
      { name: "Bundle", lid: "urn:nasa:pds:bundle::1.0", context: "mission_more_data" },
      { name: "Collection", lid: "urn:nasa:pds:bundle:document::1.0", context: "target_more_data" },
    ]);
    expect(rows[0].is_bundle).toBe(true);
    expect(rows[0].context).toBe("Mission More Data");
    expect(rows[1].is_bundle).toBe(false);
    expect(rows[1].context).toBe("");
  });

  it("builds hierarchical groups anchored by roots in sort order", () => {
    const items = [
      { lid: "b1", bundle_lid: "b1", is_bundle: true, name: "Bundle One" },
      { lid: "b1:c1", bundle_lid: "b1", is_bundle: false, name: "C1a" },
      { lid: "b1:c2", bundle_lid: "b1", is_bundle: false, name: "C1b" },
      { lid: "b2", bundle_lid: "b2", is_bundle: true, name: "Bundle Two" },
      { lid: "orphan:c", bundle_lid: "missing", is_bundle: false, name: "Orphan" },
    ];
    const { groups, orphans } = buildHierarchicalGroups(
      items,
      "bundle_lid",
      (item) => Boolean((item as { is_bundle?: boolean }).is_bundle),
    );
    expect(groups.map((g) => g.key)).toEqual(["b1", "b2"]);
    expect(groups[0].children.map((c) => c.lid)).toEqual(["b1:c1", "b1:c2"]);
    expect(groups[0].roots.map((r) => r.lid)).toEqual(["b1"]);
    expect(groups[1].children).toEqual([]);
    expect(orphans.map((o) => o.lid)).toEqual(["orphan:c"]);
  });

  it("keeps multiple bundle versions as co-roots in the same group", () => {
    const items = [
      { lid: "urn:nasa:pds:foo::1.0", bundle_lid: "urn:nasa:pds:foo", is_bundle: true, name: "Foo" },
      { lid: "urn:nasa:pds:foo::2.0", bundle_lid: "urn:nasa:pds:foo", is_bundle: true, name: "Foo" },
      { lid: "urn:nasa:pds:foo:doc::1.0", bundle_lid: "urn:nasa:pds:foo", is_bundle: false, name: "Doc" },
    ];
    const { groups } = buildHierarchicalGroups(
      items,
      "bundle_lid",
      (item) => Boolean((item as { is_bundle?: boolean }).is_bundle),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].roots.map((r) => r.lid)).toEqual([
      "urn:nasa:pds:foo::1.0",
      "urn:nasa:pds:foo::2.0",
    ]);
    expect(groups[0].children.map((c) => c.lid)).toEqual(["urn:nasa:pds:foo:doc::1.0"]);
  });

  it("places child rows whose root never appears into orphans", () => {
    const items = [
      { lid: "c1", bundle_lid: "b1", is_bundle: false, name: "Only child" },
    ];
    const { groups, orphans } = buildHierarchicalGroups(
      items,
      "bundle_lid",
      (item) => Boolean((item as { is_bundle?: boolean }).is_bundle),
    );
    expect(groups).toEqual([]);
    expect(orphans.map((o) => o.lid)).toEqual(["c1"]);
  });

  it("identifies bundles from dataset lids", () => {
    expect(isBundle("urn:nasa:pds:bundle::1.0")).toBe(true);
    expect(isBundle("urn:nasa:pds:bundle:document::1.0")).toBe(false);
  });

  it("groups and flattens relationship types by order ranges", () => {
    const grouped = groupRelationshipTypes([
      { name: "Always", order: 0 },
      { name: "Sometimes", order: 100 },
      { name: "Never", order: 1000 },
    ]);
    expect(grouped.always).toHaveLength(1);
    expect(flattenRelationshipTypeGroups(grouped).map((type) => type.order)).toEqual([0, 100, 1000]);
  });
});
