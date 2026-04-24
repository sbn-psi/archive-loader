import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { LoadingState } from "@/components/LoadingState";
import { PageIntro } from "@/components/PageIntro";
import { pageMeta } from "@/lib/navigation";

const ACTIVE_JOB_STORAGE_KEY = "archive-loader:sync:activeJobId";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_FAILURES = 5;

function formatElapsed(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function readStoredJobId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredJobId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function SyncPage({ onError }: { onError: (message: string | null) => void }) {
  const [saving, setSaving] = useState(false);
  const [suffix, setSuffix] = useState("");
  const [suffixEdited, setSuffixEdited] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => readStoredJobId());
  const [pendingMode, setPendingMode] = useState<"incremental" | "full" | null>(null);
  const [showFailures, setShowFailures] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const handledTerminalStatus = useRef<string | null>(null);

  const lastIndex = useQuery({ queryKey: ["sync", "last-index"], queryFn: api.getLastIndex });
  const available = useQuery({ queryKey: ["sync", "status"], queryFn: api.getSyncStatus });
  const suggestion = useQuery({
    queryKey: ["sync", "suggestion"],
    queryFn: api.getSuffixSuggestion,
    enabled: available.data === true,
  });

  const syncJob = useQuery({
    queryKey: ["sync", "job", activeJobId],
    queryFn: () => api.getSyncJob(activeJobId ?? ""),
    enabled: !!activeJobId,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling once we know the job is terminal.
      if (status === "completed" || status === "failed") {
        return false;
      }
      // Stop polling after too many consecutive errors - usually a 404 from
      // a server restart, but could also be transient network failure.
      if (query.state.errorUpdateCount && query.state.errorUpdateCount >= MAX_POLL_FAILURES) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    writeStoredJobId(activeJobId);
  }, [activeJobId]);

  useEffect(() => {
    if (suffixEdited) return;
    if (suggestion.data) {
      setSuffix(suggestion.data);
    }
  }, [suggestion.data, suffixEdited]);

  // Detach local "saving" UI once we actually know the backend reached a terminal state.
  const jobStatus = syncJob.data?.status;
  const jobError = syncJob.data?.error;
  const jobMessage = syncJob.data?.message;
  const jobId = syncJob.data?.id;

  const lastIndexRefetch = lastIndex.refetch;
  const suggestionRefetch = suggestion.refetch;

  useEffect(() => {
    if (!jobId || !jobStatus) return;
    const marker = `${jobId}:${jobStatus}`;
    if ((jobStatus === "completed" || jobStatus === "failed") && handledTerminalStatus.current !== marker) {
      handledTerminalStatus.current = marker;
      setSaving(false);
      setPendingMode(null);
      writeStoredJobId(null);
      void lastIndexRefetch();
      void suggestionRefetch();
      if (jobStatus === "failed") {
        onError(jobError || jobMessage || "Publish failed");
      }
    }
  }, [jobId, jobStatus, jobError, jobMessage, onError, lastIndexRefetch, suggestionRefetch]);

  // Handle polling errors: the common case is a 404 after a server restart;
  // in that case the in-memory job is gone and we should clear the UI.
  useEffect(() => {
    const err = syncJob.error;
    if (!err || !activeJobId) return;
    const status = err instanceof ApiError ? err.status : null;
    const failureCount = syncJob.failureCount ?? 0;
    if (status === 404) {
      setActiveJobId(null);
      setSaving(false);
      setPendingMode(null);
      onError("The publish job is no longer tracked by the server (it may have been restarted). Refresh to start a new publish.");
    } else if (failureCount >= MAX_POLL_FAILURES) {
      setSaving(false);
      setPendingMode(null);
      onError(`Lost contact with the publish job after ${failureCount} retries: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [syncJob.error, syncJob.failureCount, activeJobId, onError]);

  // Elapsed-time ticker while running. Gives the full-refresh path a heartbeat
  // since its server-side progress is often just "still running".
  useEffect(() => {
    const job = syncJob.data;
    if (!job || !job.startedAt) {
      setElapsedMs(0);
      return;
    }
    const startMs = Date.parse(job.startedAt);
    if (Number.isNaN(startMs)) {
      setElapsedMs(0);
      return;
    }
    const endMs = job.finishedAt ? Date.parse(job.finishedAt) : null;
    if (endMs && !Number.isNaN(endMs)) {
      setElapsedMs(endMs - startMs);
      return;
    }
    setElapsedMs(Date.now() - startMs);
    if (job.status !== "running" && job.status !== "queued") {
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startMs);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [syncJob.data]);

  const currentJob = syncJob.data;
  const collectionProgress = currentJob?.publishProgress;
  const refreshProgress = currentJob?.arcnav.revalidate;
  const liveFlush = currentJob?.arcnav.liveFlush;
  const isFullRefresh = refreshProgress?.mode === "full";
  const refreshHasIssues = liveFlush?.status === "failed" || (refreshProgress?.failed ?? 0) > 0;
  const isTerminal = jobStatus === "completed" || jobStatus === "failed";
  const isActivePublish = !!currentJob && !isTerminal;

  const badge = useMemo(() => {
    if (!currentJob) return null;
    if (currentJob.status === "completed" && refreshHasIssues) {
      return { label: "completed with issues", className: "badge badge-warning" };
    }
    return { label: currentJob.status, className: "badge" };
  }, [currentJob, refreshHasIssues]);

  const failures = refreshProgress?.failures ?? [];
  const visibleFailures = showFailures ? failures : failures.slice(0, 10);
  const plannedPathCount = refreshProgress?.plannedPaths?.length || refreshProgress?.paths?.length || refreshProgress?.total || 0;
  const attemptedPathCount = refreshProgress?.attempted ?? refreshProgress?.completed ?? 0;
  const revalidatedPathCount = refreshProgress?.revalidatedPaths?.length || refreshProgress?.completed || 0;

  const startPublish = async (fullReload: boolean) => {
    if (fullReload && typeof window !== "undefined") {
      const confirmed = window.confirm("A full Archive Navigator refresh can take several minutes. Continue with a full refresh publish?");
      if (!confirmed) return;
    }

    try {
      setSaving(true);
      setPendingMode(fullReload ? "full" : "incremental");
      onError(null);
      handledTerminalStatus.current = null;
      setShowFailures(false);
      const job = await api.startSyncSolr(suffix || suggestion.data || "", { fullReload });
      setActiveJobId(job.id);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      if (status === 409) {
        onError("A publish is already in progress on the server. Refresh the page to watch it.");
      } else {
        onError(error instanceof Error ? error.message : "Publish failed");
      }
      setSaving(false);
      setPendingMode(null);
    }
  };

  if (lastIndex.isLoading || available.isLoading) {
    return <LoadingState title="Loading publishing status" detail="Checking service availability and the most recent publish." />;
  }

  if (!available.data) {
    return (
      <div className="page-card">
        <PageIntro title={pageMeta.publishing.title} subtitle={pageMeta.publishing.subtitle} />
        <p>Publishing is unavailable right now.</p>
      </div>
    );
  }

  const showIncrementalButton = !isActivePublish || pendingMode === "incremental";
  const showFullButton = !isActivePublish || pendingMode === "full";

  return (
    <div className="page-card">
      <PageIntro
        title={pageMeta.publishing.title}
        subtitle={pageMeta.publishing.subtitle}
        actions={
          <>
            {showIncrementalButton ? (
              <button
                type="button"
                className="button-primary"
                disabled={saving}
                onClick={() => void startPublish(false)}
              >
                {saving && pendingMode === "incremental" ? "Publishing..." : "Publish (Incremental Refresh)"}
              </button>
            ) : null}
            {showFullButton ? (
              <button
                type="button"
                className="button-secondary"
                disabled={saving}
                onClick={() => void startPublish(true)}
              >
                {saving && pendingMode === "full" ? "Publishing..." : "Publish (Full Refresh)"}
              </button>
            ) : null}
          </>
        }
      />
      <div className="field">
        <label>Publish Version Label</label>
        <input
          value={suffix}
          onChange={(event) => {
            setSuffix(event.target.value);
            setSuffixEdited(true);
          }}
          placeholder={suggestion.data ?? ""}
        />
      </div>
      <p className="muted">
        <strong>Incremental Refresh</strong> tells Archive Navigator to reload only the records that changed since the last publish. This is the normal option.
      </p>
      <p className="muted">
        <strong>Full Refresh</strong> republishes every Archive Navigator page and can take several minutes. Use this after large changes or if incremental refreshes have been missing updates.
      </p>
      {saving && !currentJob ? (
        <LoadingState compact title="Starting publish" detail="Contacting the server to queue the publish job." />
      ) : null}
      {currentJob ? (
        <div className="page-card">
          <div className="page-panel-header">
            <div>
              <h3>{currentJob.step}</h3>
              <p className="page-subtitle">{currentJob.message}</p>
            </div>
            {badge ? <span className={badge.className}>{badge.label}</span> : null}
          </div>
          <p className="muted">
            Elapsed: {formatElapsed(elapsedMs)}
            {currentJob.startedAt ? ` · Started ${new Date(currentJob.startedAt).toLocaleTimeString()}` : null}
          </p>
          <div className="report-list">
            <div className="page-panel">
              <strong>Publish Progress</strong>
              <p className="muted">
                {collectionProgress?.totalCollections
                  ? `${collectionProgress.completedCollections} of ${collectionProgress.totalCollections} Solr collections uploaded`
                  : "Preparing Solr collections."}
              </p>
              {collectionProgress?.currentCollection ? (
                <p className="muted">Current collection: {collectionProgress.currentCollection}</p>
              ) : null}
            </div>
            <div className="page-panel">
              <strong>Archive Navigator Refresh</strong>
              {liveFlush ? (
                <p className="muted">
                  Cache flush: <em>{liveFlush.status}</em>
                  {liveFlush.message ? ` — ${liveFlush.message}` : null}
                </p>
              ) : null}

              {refreshProgress?.status === "pending" ? (
                <p className="muted">Waiting to start Archive Navigator refresh.</p>
              ) : (
                <>
                  {isFullRefresh ? (
                    <p className="muted">Full refresh requested for all Archive Navigator content.</p>
                  ) : null}
                  {refreshProgress?.remoteJobId ? (
                    <p className="muted">Refresh job: <code>{refreshProgress.remoteJobId}</code></p>
                  ) : null}
                  {refreshProgress?.statusUrl ? (
                    <p className="muted">Status URL: <code>{refreshProgress.statusUrl}</code></p>
                  ) : null}
                  {plannedPathCount > 0 ? (
                    <p className="muted">
                      {attemptedPathCount} of {plannedPathCount} paths attempted
                      {(refreshProgress?.failed ?? 0) > 0 ? ` (${refreshProgress?.failed} failed)` : null}
                      {revalidatedPathCount > 0 ? ` - ${revalidatedPathCount} revalidated` : null}
                    </p>
                  ) : refreshProgress?.status === "completed" ? (
                    <p className="muted">No records required refresh.</p>
                  ) : null}
                  {refreshProgress?.message ? <p className="muted">{refreshProgress.message}</p> : null}
                  {!isFullRefresh && currentJob.arcnav.changedIdentifiers > 0 ? (
                    <p className="muted">Changed records detected: {currentJob.arcnav.changedIdentifiers}</p>
                  ) : null}
                  {refreshProgress?.currentIdentifier ? (
                    <p className="muted">Current record: <code>{refreshProgress.currentIdentifier}</code></p>
                  ) : null}
                </>
              )}

              {refreshHasIssues ? (
                <div>
                  <p className="status-error">
                    Archive Navigator refresh finished with issues.
                    {refreshProgress && refreshProgress.failed > 0
                      ? ` ${refreshProgress.failed} record request${refreshProgress.failed === 1 ? "" : "s"} failed.`
                      : null}
                  </p>
                  {failures.length > 0 ? (
                    <>
                      <ul className="muted" style={{ maxHeight: 200, overflow: "auto" }}>
                        {visibleFailures.map((failure, i) => (
                          <li key={`${failure.identifier}-${i}`}>
                            <code>{failure.identifier}</code>: {failure.error}
                          </li>
                        ))}
                      </ul>
                      {failures.length > 10 ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setShowFailures((v) => !v)}
                        >
                          {showFailures
                            ? `Show first 10 only`
                            : `Show all ${failures.length} failures`}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="page-card">
        <h3>Last Successful Publish</h3>
        <pre>{JSON.stringify(lastIndex.data ?? {}, null, 2)}</pre>
      </div>
    </div>
  );
}
