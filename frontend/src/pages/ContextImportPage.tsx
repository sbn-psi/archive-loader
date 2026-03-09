import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { deriveSelectedTools, hydrateToolSelection, isValidUrn, mergeRelationshipsByLid, prepForForm, sanitizeFormObject } from "@/lib/domain";
import type { ContextObjectRecord, LookupRelationship } from "@/types";
import { ImageUploadField } from "@/components/ImageUploadField";
import { RelatedToolsField } from "@/components/RelatedToolsField";
import { RelationshipSelectorField } from "@/components/RelationshipSelectorField";
import { RepeatStringList } from "@/components/RepeatStringList";
import { RichTextEditor } from "@/components/RichTextEditor";

type ContextConfig = {
  title: string;
  entityType: string;
  editType: string;
  tagType: string;
  relationshipType: string;
  relationshipTo: string;
  modelName: string;
  relationshipModelNames: readonly string[];
};

const templateModel = (): ContextObjectRecord => ({
  tags: [],
  tools: [],
});

export function ContextImportPage({
  config,
  onError,
}: {
  config: ContextConfig;
  onError: (message: string | null) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const edit = params.get("edit");
  const [record, setRecord] = useState<ContextObjectRecord>(templateModel());
  const [relationships, setRelationships] = useState<Record<string, LookupRelationship[]>>({});

  const editQuery = useQuery({
    queryKey: ["edit", config.editType, edit],
    queryFn: () => api.getContextEdit(config.editType, edit!),
    enabled: Boolean(edit),
  });
  const tags = useQuery({ queryKey: ["tags", config.tagType], queryFn: () => api.getTags(config.tagType) });
  const toolsQuery = useQuery({ queryKey: ["tools"], queryFn: api.getTools });
  const relationshipTypes = useQuery({
    queryKey: ["relationship-types", config.relationshipType],
    queryFn: () => api.getRelationshipTypes(config.relationshipType),
    enabled: config.relationshipTo !== "bundle",
  });

  useEffect(() => {
    if (!editQuery.data) {
      return;
    }
    setRecord(prepForForm(editQuery.data.object, templateModel) ?? templateModel());
    const unpacked: Record<string, LookupRelationship[]> = {};
    for (const modelName of config.relationshipModelNames) {
      unpacked[modelName] = editQuery.data.relationships.reduce<LookupRelationship[]>((pool, relationship) => {
        const key = modelName === "spacecraft" ? "instrument_host" : modelName === "target" ? "target" : modelName === "mission" ? "investigation" : modelName;
        const value = relationship[key];
        if (!value || typeof value !== "string") {
          return pool;
        }
        return pool.concat({
          lid: value,
          relationshipId: typeof relationship.relationshipId === "string" ? relationship.relationshipId : null,
          label: typeof relationship.label === "string" ? relationship.label : null,
        });
      }, []);
    }
    setRelationships(unpacked);
  }, [config.relationshipModelNames, editQuery.data]);

  useEffect(() => {
    const lid = record.logical_identifier;
    if (!isValidUrn(lid) || edit) {
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const existing = await api.getContextEdit(config.editType, lid!);
        if (!cancelled && existing.object) {
          onError(`${lid} already exists. It should be edited instead of added.`);
          return;
        }
      } catch {
        // absence is acceptable
      }

      try {
        const replacements =
          config.editType === "target"
            ? { display_name: "target_name", display_description: "target_description" }
            : config.editType === "mission"
              ? { display_name: "investigation_name", display_description: "investigation_description" }
              : config.editType === "spacecraft"
                ? { display_name: "instrument_host_name" }
                : { display_name: "instrument_name", display_description: "instrument_description" };
        const lookup = await api.getLookup(lid!, Object.values(replacements));
        if (!cancelled) {
          const nextRecord = { ...record };
          for (const [field, key] of Object.entries(replacements)) {
            if (!nextRecord[field as keyof ContextObjectRecord] && Array.isArray(lookup[key]) && lookup[key][0]) {
              nextRecord[field as keyof ContextObjectRecord] = lookup[key][0] as never;
            }
          }
          setRecord(nextRecord);
        }
      } catch {
        // preserve current behavior: lookup failures do not block editing
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [config.editType, edit, onError, record]);

  useEffect(() => {
    const lid = record.logical_identifier;
    if (!isValidUrn(lid)) {
      return;
    }

    for (const modelName of config.relationshipModelNames) {
      const to = modelName === "mission" ? "spacecraft" : modelName;
      api
        .getRelated(to, config.modelName, lid)
        .then((items) => {
          setRelationships((current) => ({
            ...current,
            [modelName]: mergeRelationshipsByLid(current[modelName] ?? [], items),
          }));
        })
        .catch(() => undefined);
    }
  }, [config.modelName, config.relationshipModelNames, record.logical_identifier]);

  const currentTags = Array.isArray(record.tags) ? record.tags.map((tag) => (typeof tag === "string" ? tag : tag.name)) : [];
  const toolModels = useMemo(
    () => hydrateToolSelection(toolsQuery.data ?? [], (record.tools as Array<string | { toolId: string; directUrl?: string }>) ?? []),
    [record.tools, toolsQuery.data],
  );

  const handleSave = async () => {
    try {
      onError(null);
      const payload = sanitizeFormObject(record, templateModel);
      await api.saveContextObject(config.entityType, payload!);
      const relationshipPayload = saveRelationshipsPayload().filter(
        (relationship) => relationship.relationshipId || relationship.label,
      );
      if (relationshipPayload.length > 0) {
        await api.saveRelationships(relationshipPayload);
      }
      await queryClient.invalidateQueries({ queryKey: ["status", config.entityType] });
      if (edit) {
        await queryClient.invalidateQueries({ queryKey: ["edit", config.editType, edit] });
      }
      navigate(`/${config.entityType}/manage`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Save failed");
    }
  };

  if ((edit && editQuery.isLoading) || tags.isLoading || toolsQuery.isLoading || relationshipTypes.isLoading) {
    return <div className="page-state">Loading editor...</div>;
  }

  const saveRelationshipsPayload = () =>
    config.relationshipModelNames.flatMap((modelName) =>
      (relationships[modelName] ?? []).map((relationship) => ({
        [config.modelName === "mission" ? "investigation" : config.modelName === "spacecraft" ? "instrument_host" : config.modelName]: record.logical_identifier,
        [modelName === "mission"
          ? "investigation"
          : modelName === "spacecraft"
            ? "instrument_host"
            : modelName === "target"
              ? "target"
              : modelName]: relationship.lid,
        relationshipId: relationship.relationshipId,
        label: relationship.label,
      })),
    );

  return (
    <div className="grid two">
      <div className="page-card">
        <div className="form-page-header">
          <h1 className="page-title">{config.title}</h1>
          <div className="form-page-actions">
            <button type="button" className="button-primary" onClick={() => void handleSave()}>
              Save
            </button>
          </div>
        </div>
        <div className="field">
          <label>LID</label>
          <input value={record.logical_identifier ?? ""} onChange={(event) => setRecord({ ...record, logical_identifier: event.target.value })} />
        </div>
        <div className="field">
          <label>Display Name</label>
          <input value={record.display_name ?? ""} onChange={(event) => setRecord({ ...record, display_name: event.target.value })} />
        </div>
        <div className="field">
          <label>Display Description</label>
          <textarea value={record.display_description ?? ""} onChange={(event) => setRecord({ ...record, display_description: event.target.value })} />
        </div>
        {config.editType === "mission" ? (
          <>
            <div className="field">
              <label>Active Start Date</label>
              <input
                type="date"
                value={record.start_date instanceof Date ? record.start_date.toISOString().slice(0, 10) : String(record.start_date ?? "")}
                onChange={(event) => setRecord({ ...record, start_date: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Active End Date</label>
              <input
                type="date"
                value={record.end_date instanceof Date ? record.end_date.toISOString().slice(0, 10) : String(record.end_date ?? "")}
                onChange={(event) => setRecord({ ...record, end_date: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Mission Bundle LID</label>
              <input value={record.mission_bundle ?? ""} onChange={(event) => setRecord({ ...record, mission_bundle: event.target.value })} />
            </div>
            <label className="toolbar">
              <input type="checkbox" checked={Boolean(record.is_ready)} onChange={(event) => setRecord({ ...record, is_ready: event.target.checked })} />
              This mission is ready
            </label>
          </>
        ) : null}
        {config.editType === "spacecraft" ? (
          <>
            <div className="field">
              <label>Mission LID Override</label>
              <input value={record.mission_override ?? ""} onChange={(event) => setRecord({ ...record, mission_override: event.target.value })} />
            </div>
            <div className="field">
              <label>Spacecraft ID</label>
              <input value={record.pds3_instrument_host_id ?? ""} onChange={(event) => setRecord({ ...record, pds3_instrument_host_id: event.target.value })} />
            </div>
          </>
        ) : null}
        {config.editType === "instrument" ? (
          <>
            <div className="field">
              <label>Instrument Bundle LID</label>
              <input value={record.instrument_bundle ?? ""} onChange={(event) => setRecord({ ...record, instrument_bundle: event.target.value })} />
            </div>
            <div className="field">
              <label>Instrument ID</label>
              <input value={record.pds3_instrument_id ?? ""} onChange={(event) => setRecord({ ...record, pds3_instrument_id: event.target.value })} />
            </div>
            <div className="field">
              <label>Spacecraft ID</label>
              <input value={record.pds3_instrument_host_id ?? ""} onChange={(event) => setRecord({ ...record, pds3_instrument_host_id: event.target.value })} />
            </div>
          </>
        ) : null}
        <RepeatStringList
          label="Tags"
          values={currentTags}
          suggestions={(tags.data ?? []).map((tag) => tag.name)}
          onChange={(values) => setRecord({ ...record, tags: values.map((value) => ({ name: value })) })}
        />
        <ImageUploadField label="Image" value={record.image_url} onChange={(value) => setRecord({ ...record, image_url: value })} onError={(message) => onError(message)} />
        <div>
          <h3>Additional Content</h3>
          <RichTextEditor
            label="Supplemental HTML - Top"
            value={record.html1 ?? ""}
            onChange={(next) => setRecord({ ...record, html1: next })}
            onError={onError}
          />
          <RichTextEditor
            label="Supplemental HTML - Bottom"
            value={record.html2 ?? ""}
            onChange={(next) => setRecord({ ...record, html2: next })}
            onError={onError}
          />
          {config.editType === "target" ? (
            <RichTextEditor
              label="Supplemental HTML - Middle"
              value={record.derived_html ?? ""}
              onChange={(next) => setRecord({ ...record, derived_html: next })}
              onError={onError}
            />
          ) : null}
          {config.editType === "mission" ? (
            <RichTextEditor
              label="Full Page HTML"
              value={record.other_html ?? ""}
              onChange={(next) => setRecord({ ...record, other_html: next })}
              onError={onError}
            />
          ) : null}
        </div>
        <RelatedToolsField tools={toolModels} onChange={(nextTools) => setRecord({ ...record, tools: deriveSelectedTools(nextTools) })} />
      </div>
      <div>
        {config.relationshipModelNames.map((modelName) => (
          <RelationshipSelectorField
            key={modelName}
            title={modelName === "mission" ? "Spacecraft" : modelName.charAt(0).toUpperCase() + modelName.slice(1)}
            relationships={relationships[modelName] ?? []}
            relationshipTypes={modelName === "bundle" ? null : relationshipTypes.data ?? null}
            onChange={(items) => setRelationships({ ...relationships, [modelName]: items })}
          />
        ))}
      </div>
    </div>
  );
}
