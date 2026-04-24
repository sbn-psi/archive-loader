import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { buildDatasetAutocomplete, deriveSelectedTools, hydrateToolSelection, isBundle, prepDatasetsFromHarvest, prepForForm, sanitizeFormObject } from "@/lib/domain";
import type { DatasetRecord, HarvestResponse } from "@/types";
import { LoadingState } from "@/components/LoadingState";
import { PageIntro } from "@/components/PageIntro";
import { RelatedToolsField } from "@/components/RelatedToolsField";
import { RepeatStringList } from "@/components/RepeatStringList";
import { ImageUploadField } from "@/components/ImageUploadField";
import { RichTextEditor } from "@/components/RichTextEditor";
import { pageMeta } from "@/lib/navigation";

const templateModel = (): DatasetRecord => ({
  tags: [],
  tools: [],
  publication: {},
  example: {},
  related_data: [],
  superseded_data: [],
  download_packages: [],
});

export function DatasetImportPage({ onError }: { onError: (message: string | null) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const edit = params.get("edit");
  const initialType = params.get("type") ?? "Bundle";

  const tags = useQuery({ queryKey: ["tags", "datasets"], queryFn: () => api.getTags("datasets") });
  const toolsQuery = useQuery({ queryKey: ["tools"], queryFn: api.getTools });
  const editQuery = useQuery({
    queryKey: ["edit", "datasets", edit],
    queryFn: () => api.getDatasetEdit(edit!),
    enabled: Boolean(edit),
  });

  const [bundle, setBundle] = useState<DatasetRecord | null>(initialType === "Bundle" ? templateModel() : null);
  const [collections, setCollections] = useState<DatasetRecord[]>(initialType === "Collection" ? [templateModel()] : []);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (editQuery.data?.object) {
      const dataset = prepForForm(editQuery.data.object, templateModel)!;
      if (isBundle(dataset.logical_identifier)) {
        setBundle(dataset);
        setCollections([]);
      } else {
        setBundle(null);
        setCollections([dataset]);
      }
      return;
    }

    const harvested = sessionStorage.getItem("dataset-harvest");
    if (harvested && !edit) {
      const parsed = JSON.parse(harvested) as Pick<HarvestResponse, "bundle" | "collections">;
      const mapped = prepDatasetsFromHarvest(parsed);
      setBundle(mapped.bundle ? { ...templateModel(), ...mapped.bundle } : null);
      setCollections(mapped.collections.map((collection) => ({ ...templateModel(), ...collection })));
    }
  }, [edit, editQuery.data]);

  const activeRecord = bundle && activeIndex === 0 ? bundle : collections[Math.max(0, activeIndex - (bundle ? 1 : 0))];
  const setActiveRecord = (record: DatasetRecord) => {
    if (bundle && activeIndex === 0) {
      setBundle(record);
      return;
    }
    const collectionIndex = Math.max(0, activeIndex - (bundle ? 1 : 0));
    setCollections(collections.map((item, index) => (index === collectionIndex ? record : item)));
  };

  const datasetPool = useMemo(() => (bundle ? [bundle, ...collections] : collections), [bundle, collections]);
  const tools = useMemo(
    () => hydrateToolSelection(toolsQuery.data ?? [], (activeRecord?.tools as Array<string | { toolId: string; directUrl?: string }>) ?? []),
    [activeRecord?.tools, toolsQuery.data],
  );
  const currentTags = Array.isArray(activeRecord?.tags)
    ? activeRecord?.tags.map((tag) => (typeof tag === "string" ? tag : tag.name))
    : [];

  const handleSave = async () => {
    try {
      onError(null);
      await api.saveDatasets({
        bundle: sanitizeFormObject(bundle, templateModel),
        collections: collections.map((collection) => sanitizeFormObject(collection, templateModel)!),
      });
      sessionStorage.removeItem("dataset-harvest");
      await queryClient.invalidateQueries({ queryKey: ["status", "datasets"] });
      if (edit) {
        await queryClient.invalidateQueries({ queryKey: ["edit", "datasets", edit] });
      }
      navigate("/datasets/manage");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Dataset save failed");
    }
  };

  if ((edit && editQuery.isLoading) || tags.isLoading || toolsQuery.isLoading) {
    return <LoadingState title="Loading dataset editor" detail="Preparing the selected dataset and supporting metadata." />;
  }

  const activeCollectionIndex = activeIndex - (bundle ? 1 : 0);
  const activeType = bundle && activeIndex === 0 ? "Bundle" : "Collection";
  const isBundleForm = activeType === "Bundle";
  const isCollectionForm = activeType === "Collection";

  return (
    <div className="grid two">
      {datasetPool.length > 1 ? (
        <div className="page-card editor-sidebar">
          <h3>Dataset Selection</h3>
          <nav aria-label="Dataset selection" className="editor-tab-nav">
          {bundle ? (
            <button
              type="button"
              className={activeIndex === 0 ? "editor-tab is-active" : "editor-tab"}
              onClick={() => setActiveIndex(0)}
            >
              <span className="editor-tab-kind">Bundle</span>
              <span className="editor-tab-label">{bundle.display_name || bundle.logical_identifier || "Bundle"}</span>
            </button>
          ) : null}
          {collections.map((collection, index) => (
            <button
              key={`${collection.logical_identifier ?? index}`}
              type="button"
              className={activeIndex === index + (bundle ? 1 : 0) ? "editor-tab is-active" : "editor-tab"}
              onClick={() => setActiveIndex(index + (bundle ? 1 : 0))}
            >
              <span className="editor-tab-kind">Collection {index + 1}</span>
              <span className="editor-tab-label">{collection.display_name || collection.logical_identifier || `Collection ${index + 1}`}</span>
            </button>
          ))}
          </nav>
        </div>
      ) : null}
      <div className="page-card editor-card">
        <PageIntro
          title={pageMeta.datasetDetails.title}
          subtitle={pageMeta.datasetDetails.subtitle}
          modeLabel={edit ? "Editing existing record" : "Setting up a new record"}
          actions={
            <button type="button" className="button-primary" onClick={() => void handleSave()}>
              Save
            </button>
          }
        />
        {datasetPool.length > 1 ? (
          <div className="editor-current-record">
            <span className="badge">{activeType}</span>
            <strong>{activeRecord?.display_name || activeRecord?.logical_identifier || (activeType === "Bundle" ? "Bundle" : `Collection ${activeCollectionIndex + 1}`)}</strong>
          </div>
        ) : null}
        {activeRecord ? (
          <>
            <section className="page-section">
              <div className="page-section-header">
                <h3>Core Details</h3>
              </div>
              <div className="editor-fields two-column">
                <div className="field">
                  <label>LIDVID</label>
                  <input value={activeRecord.logical_identifier ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, logical_identifier: event.target.value })} />
                </div>
                <div className="field">
                  <label>Dataset Display Name</label>
                  <input
                    list="dataset-display-name"
                    value={activeRecord.display_name ?? ""}
                    onChange={(event) => setActiveRecord({ ...activeRecord, display_name: event.target.value })}
                  />
                </div>
                {isBundleForm ? (
                  <div className="field">
                    <label>Primary Context</label>
                    <select
                      required
                      value={activeRecord.primary_context ?? ""}
                      onChange={(event) => setActiveRecord({ ...activeRecord, primary_context: event.target.value })}
                    >
                      <option value="">Select context</option>
                      <option value="mission_instrument_data">Mission Instrument Data</option>
                      <option value="mission_more_data">Mission More Data Page</option>
                      <option value="target_derived_data">Target Derived Data Page</option>
                      <option value="target_more_data">Target More Data Page</option>
                      <option value="more_data">Both More Data Pages</option>
                    </select>
                  </div>
                ) : null}
                <div className="field">
                  <label>DOI</label>
                  <input value={activeRecord.doi ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, doi: event.target.value })} />
                </div>
                <div className="field span-two">
                  <label>Display Description</label>
                  <textarea value={activeRecord.display_description ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, display_description: event.target.value })} />
                </div>
                <div className="field span-two">
                  <label>Citation</label>
                  <textarea value={activeRecord.citation ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, citation: event.target.value })} />
                </div>
              </div>
            </section>
            <section className="page-section">
              <div className="page-section-header">
                <h3>Access Links</h3>
              </div>
              <div className="editor-fields two-column">
                <div className="field">
                  <label>Browse URL</label>
                  <input type="url" value={activeRecord.browse_url ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, browse_url: event.target.value })} />
                </div>
                <div className="field">
                  <label>Download URL</label>
                  <input type="url" value={activeRecord.download_url ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, download_url: event.target.value })} />
                </div>
                <div className="field">
                  <label>Download Size</label>
                  <input value={activeRecord.download_size ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, download_size: event.target.value })} />
                </div>
                <div className="field">
                  <label>Dataset Info URL</label>
                  <input type="url" value={activeRecord.dataset_info_url ?? ""} onChange={(event) => setActiveRecord({ ...activeRecord, dataset_info_url: event.target.value })} />
                </div>
              </div>
            </section>
            {isCollectionForm ? (
              <section className="page-section page-panel">
                <div className="page-section-header">
                <h3>Collection Example</h3>
                </div>
                <div className="editor-fields two-column">
                <div className="field">
                  <label>Example Display Name</label>
                  <input
                    value={String((activeRecord.example as Record<string, string> | undefined)?.title ?? "")}
                    onChange={(event) => setActiveRecord({ ...activeRecord, example: { ...(activeRecord.example ?? {}), title: event.target.value } })}
                  />
                </div>
                <div className="field">
                  <label>Example Filename</label>
                  <input
                    value={String((activeRecord.example as Record<string, string> | undefined)?.filename ?? "")}
                    onChange={(event) => setActiveRecord({ ...activeRecord, example: { ...(activeRecord.example ?? {}), filename: event.target.value } })}
                  />
                </div>
                <div className="field">
                  <label>Example URL</label>
                  <input
                    type="url"
                    value={String((activeRecord.example as Record<string, string> | undefined)?.url ?? "")}
                    onChange={(event) => setActiveRecord({ ...activeRecord, example: { ...(activeRecord.example ?? {}), url: event.target.value } })}
                  />
                </div>
                <ImageUploadField
                  label="Example Thumbnail"
                  value={String((activeRecord.example as Record<string, string> | undefined)?.thumbnail_url ?? "")}
                  onChange={(value) => setActiveRecord({ ...activeRecord, example: { ...(activeRecord.example ?? {}), thumbnail_url: value } })}
                  onError={(message) => onError(message)}
                />
                </div>
              </section>
            ) : null}
            <section className="page-section">
              <div className="page-section-header">
                <h3>Classification</h3>
              </div>
              <RepeatStringList
                label="Tags"
                values={currentTags}
                suggestions={(tags.data ?? []).map((tag) => tag.name)}
                onChange={(values) => setActiveRecord({ ...activeRecord, tags: values.map((value) => ({ name: value })) })}
              />
            </section>
            <section className="page-section">
              <div className="page-section-header">
                <h3>Additional Content</h3>
              </div>
              <RichTextEditor
                label="Supplemental HTML - Top"
                value={activeRecord.html1 ?? ""}
                onChange={(next) => setActiveRecord({ ...activeRecord, html1: next })}
                onError={onError}
              />
              <RichTextEditor
                label="Supplemental HTML - Bottom"
                value={activeRecord.html2 ?? ""}
                onChange={(next) => setActiveRecord({ ...activeRecord, html2: next })}
                onError={onError}
              />
            </section>
            <section className="page-section">
              <div className="page-section-header">
                <h3>Related Tools</h3>
              </div>
              <RelatedToolsField
                tools={tools}
                onChange={(nextTools) => setActiveRecord({ ...activeRecord, tools: deriveSelectedTools(nextTools) })}
              />
            </section>
            <datalist id="dataset-display-name">
              {buildDatasetAutocomplete(datasetPool, "display_name", activeRecord.display_name ?? "", undefined, activeRecord.logical_identifier ?? "").map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </>
        ) : null}
      </div>
    </div>
  );
}
