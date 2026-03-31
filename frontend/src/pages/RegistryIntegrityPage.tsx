import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { LoadingState } from "@/components/LoadingState";
import { PageIntro } from "@/components/PageIntro";
import { SectionBlock } from "@/components/SectionBlock";
import { formatTimestamp, parseDelimitedLines, summarizeJobRequest } from "@/lib/domain";
import { registryIntegrityProvider } from "@/lib/jobChecks";
import type { JobCheckDetailResponse, JobCheckListResponse } from "@/types";

function summarizeCount(label: string, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const displayValue =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  return (
    <div key={label} className="summary-chip">
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
  );
}

function toErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.payload === "string") {
      return error.payload;
    }
    if (error.payload && typeof error.payload === "object" && "detail" in error.payload) {
      return String((error.payload as { detail: unknown }).detail);
    }
  }
  return error instanceof Error ? error.message : "Request failed";
}

export function RegistryIntegrityPage({ onError }: { onError: (message: string | null) => void }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lidsInput, setLidsInput] = useState("");
  const [depth, setDepth] = useState(registryIntegrityProvider.defaultRequest.depth);
  const [mode, setMode] = useState(registryIntegrityProvider.defaultRequest.mode);
  const [fileTypes, setFileTypes] = useState(registryIntegrityProvider.defaultRequest.file_types);
  const [webhookUrl, setWebhookUrl] = useState(registryIntegrityProvider.defaultRequest.webhook_url);
  const [webhookSecret, setWebhookSecret] = useState(registryIntegrityProvider.defaultRequest.webhook_secret);

  const jobsQuery = useQuery({
    queryKey: ["job-checks", registryIntegrityProvider.id],
    queryFn: () => api.getJobChecks(registryIntegrityProvider.id),
    refetchInterval: (query) =>
      query.state.data?.results?.some((record) => ["queued", "running", "pending", "processing"].includes(record.status.toLowerCase()))
        ? 10000
        : false,
  });

  const detailQuery = useQuery({
    queryKey: ["job-checks", registryIntegrityProvider.id, jobId, "detail"],
    queryFn: () =>
      api.getJobCheckDetail(registryIntegrityProvider.id, jobId!, {
        page: 1,
        page_size: 25,
        exclude_structural: true,
      }),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.record.status?.toLowerCase();
      return status && ["queued", "running", "pending", "processing"].includes(status) ? 10000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createJobCheck(registryIntegrityProvider.id, {
        lids: parseDelimitedLines(lidsInput),
        depth,
        mode,
        file_types: fileTypes,
        webhook_url: webhookUrl.trim() || undefined,
        webhook_secret: webhookSecret.trim() || undefined,
      }),
    onSuccess: async (payload) => {
      onError(null);
      setWebhookSecret("");
      queryClient.setQueryData<JobCheckListResponse | undefined>(["job-checks", registryIntegrityProvider.id], (current) => {
        if (!current) {
          return {
            provider: {
              id: registryIntegrityProvider.id,
              jobType: registryIntegrityProvider.jobType,
            },
            count: 1,
            results: [payload.record],
          };
        }

        const existing = current.results.filter((record) => record.jobId !== payload.record.jobId);
        return {
          ...current,
          count: existing.length + 1,
          results: [payload.record, ...existing],
        };
      });
      queryClient.setQueryData<JobCheckDetailResponse>(["job-checks", registryIntegrityProvider.id, payload.record.jobId, "detail"], {
        record: payload.record,
        remoteJob: null,
        summary: payload.record.summary,
        issues: null,
        results: null,
      });
      navigate(`/registry-jobs/integrity/${encodeURIComponent(payload.record.jobId)}`);
      void queryClient.invalidateQueries({ queryKey: ["job-checks", registryIntegrityProvider.id] });
      void queryClient.invalidateQueries({ queryKey: ["job-checks", registryIntegrityProvider.id, payload.record.jobId, "detail"] });
    },
    onError: (error) => onError(toErrorMessage(error)),
  });

  const activeJob = detailQuery.data?.record;
  const summaryEntries = useMemo(() => {
    const summary = detailQuery.data?.summary ?? activeJob?.summary ?? {};
    return Object.entries(summary as Record<string, unknown>)
      .map(([key, value]) => summarizeCount(key.replace(/[_-]+/g, " "), value))
      .filter(Boolean);
  }, [activeJob?.summary, detailQuery.data?.summary]);

  const warningCount = Array.isArray(detailQuery.data?.issues?.warnings) ? detailQuery.data?.issues?.warnings.length : 0;
  const errorCount = Array.isArray(detailQuery.data?.issues?.errors) ? detailQuery.data?.issues?.errors.length : 0;

  if (jobsQuery.isLoading && !jobsQuery.data) {
    return <LoadingState title="Loading registry jobs" detail="Fetching saved job records and their current status." />;
  }

  return (
    <div className="page-card">
      <PageIntro
        title={registryIntegrityProvider.title}
        subtitle={registryIntegrityProvider.subtitle}
        actions={
          <button type="button" className="button-secondary" onClick={() => void jobsQuery.refetch()}>
            Refresh Jobs
          </button>
        }
      />

      <div className="grid two registry-layout">
        <SectionBlock
          title="Create Job"
          subtitle="Start a new registry integrity check by entering one or more LIDs or LIDVIDs and choosing how the verification should run."
        >
          <div className="page-panel">
            <div className="form-grid">
              <label className="field-block field-span-full">
                <span className="field-label">LIDs or LIDVIDs</span>
                <textarea
                  className="text-input text-area"
                  rows={6}
                  value={lidsInput}
                  onChange={(event) => setLidsInput(event.target.value)}
                  placeholder="urn:nasa:pds:example:bundle::1.0"
                />
                <span className="field-help">Enter one value per line or separate values with commas.</span>
              </label>

              <label className="field-block">
                <span className="field-label">Depth</span>
                <select className="text-input" value={depth} onChange={(event) => setDepth(event.target.value)}>
                  {registryIntegrityProvider.depthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="field-help">{registryIntegrityProvider.depthOptions.find((option) => option.value === depth)?.description}</span>
              </label>

              <label className="field-block">
                <span className="field-label">Mode</span>
                <select className="text-input" value={mode} onChange={(event) => setMode(event.target.value)}>
                  {registryIntegrityProvider.modeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="field-help">{registryIntegrityProvider.modeOptions.find((option) => option.value === mode)?.description}</span>
              </label>

              <label className="field-block">
                <span className="field-label">File Types</span>
                <select className="text-input" value={fileTypes} onChange={(event) => setFileTypes(event.target.value)}>
                  {registryIntegrityProvider.fileTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="field-help">
                  {registryIntegrityProvider.fileTypeOptions.find((option) => option.value === fileTypes)?.description}
                </span>
              </label>

              <label className="field-block">
                <span className="field-label">Webhook URL</span>
                <input
                  className="text-input"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://example.test/webhook"
                />
                <span className="field-help">Optional completion callback provided by the external API.</span>
              </label>

              <label className="field-block">
                <span className="field-label">Webhook Secret</span>
                <input
                  className="text-input"
                  type="password"
                  value={webhookSecret}
                  onChange={(event) => setWebhookSecret(event.target.value)}
                  placeholder="Optional shared secret"
                />
                <span className="field-help">Passed through to the API but not stored in MongoDB.</span>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || parseDelimitedLines(lidsInput).length === 0}
              >
                {createMutation.isPending ? "Submitting..." : registryIntegrityProvider.createButtonLabel}
              </button>
              <span className="muted">Job type: {registryIntegrityProvider.jobType}</span>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock
          title="Saved Jobs"
          subtitle="Review recent integrity checks, see their current status, and open any job for details."
          summary={<span className="badge">{jobsQuery.data?.count ?? 0} jobs</span>}
        >
          {jobsQuery.data?.results.length ? (
            <div className="stack-list">
              {jobsQuery.data.results.map((record) => (
                <Link
                  key={record.jobId}
                  className={`page-panel job-card${jobId === record.jobId ? " is-active" : ""}`}
                  to={`/registry-jobs/integrity/${encodeURIComponent(record.jobId)}`}
                >
                  <div className="page-panel-header">
                    <div>
                      <h4>{record.title}</h4>
                      <p className="page-subtitle">{summarizeJobRequest(record)}</p>
                    </div>
                    <JobStatusBadge status={record.status} />
                  </div>
                  <div className="job-card-meta">
                    <span>{record.request.lids.length} identifiers</span>
                    <span>Created {formatTimestamp(record.createdAt)}</span>
                    {record.summary ? <span>{Object.keys(record.summary).length} summary fields</span> : null}
                  </div>
                  {record.syncError ? <div className="inline-alert">{record.syncError}</div> : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="page-panel page-panel-muted">
              <p className="page-subtitle">No registry integrity jobs have been saved yet.</p>
            </div>
          )}
        </SectionBlock>
      </div>

      <SectionBlock
        title="Job Details"
        subtitle={jobId ? "Inspect status, summary, issues, and the latest verification results for the selected job." : "Select a saved job to inspect its current state."}
      >
        {!jobId ? (
          <div className="page-panel page-panel-muted">
            <p className="page-subtitle">Choose a job from the saved list to view its detail panel.</p>
          </div>
        ) : detailQuery.isLoading && !detailQuery.data ? (
          <LoadingState compact title="Loading job detail" detail="Refreshing status, summary, issues, and recent results." />
        ) : activeJob ? (
          <div className="stack-list">
            <div className="page-panel">
              <div className="page-panel-header">
                <div>
                  <h4>{activeJob.title}</h4>
                  <p className="page-subtitle">{summarizeJobRequest(activeJob)}</p>
                </div>
                <JobStatusBadge status={activeJob.status} />
              </div>
              <div className="key-value-grid">
                <div>
                  <span className="field-label">External Job ID</span>
                  <code>{activeJob.jobId}</code>
                </div>
                <div>
                  <span className="field-label">Created</span>
                  <span>{formatTimestamp(activeJob.createdAt)}</span>
                </div>
                <div>
                  <span className="field-label">Started</span>
                  <span>{formatTimestamp(activeJob.remoteStartedAt)}</span>
                </div>
                <div>
                  <span className="field-label">Completed</span>
                  <span>{formatTimestamp(activeJob.remoteCompletedAt)}</span>
                </div>
              </div>
              <div className="job-request-list">
                {activeJob.request.lids.map((lid) => (
                  <code key={lid}>{lid}</code>
                ))}
              </div>
              {activeJob.syncError ? <div className="inline-alert">{activeJob.syncError}</div> : null}
            </div>

            <div className="grid two">
              <div className="page-panel">
                <div className="page-panel-header">
                  <h4>Summary</h4>
                  <button type="button" className="ghost" onClick={() => void detailQuery.refetch()}>
                    Refresh Detail
                  </button>
                </div>
                {summaryEntries.length ? <div className="summary-grid">{summaryEntries}</div> : <p className="page-subtitle">No summary has been returned yet.</p>}
              </div>

              <div className="page-panel">
                <div className="page-panel-header">
                  <h4>Issues</h4>
                  <span className="badge">
                    {warningCount} warnings / {errorCount} errors
                  </span>
                </div>
                <div className="summary-grid">
                  {summarizeCount("warnings", warningCount)}
                  {summarizeCount("errors", errorCount)}
                </div>
              </div>
            </div>

            <div className="page-panel">
              <div className="page-panel-header">
                <h4>Recent Results</h4>
                <span className="badge">{detailQuery.data?.results?.results?.length ?? 0} rows</span>
              </div>
              {detailQuery.data?.results?.results?.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Timestamp</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailQuery.data.results.results ?? []).map((result, index) => (
                        <tr key={result.id ?? `${result.result_type}-${index}`}>
                          <td>
                            <JobStatusBadge status={result.status ?? "unknown"} />
                          </td>
                          <td>{result.result_type ?? "unknown"}</td>
                          <td>{formatTimestamp(typeof result.timestamp === "string" ? result.timestamp : null)}</td>
                          <td>
                            <pre className="result-preview">{JSON.stringify(result.result_data ?? {}, null, 2)}</pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="page-subtitle">No result rows are available yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="page-panel page-panel-muted">
            <p className="page-subtitle">The selected job could not be loaded.</p>
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
