import {
  buildDatasetAutocomplete,
  classifyDatasetStatusRows,
  deriveSelectedTools,
  flattenRelationshipTypeGroups,
  groupRelationshipTypes,
  hydrateToolSelection,
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
