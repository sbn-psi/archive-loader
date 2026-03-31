import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ManagePage } from "@/pages/ManagePage";
import { LoginPage } from "@/pages/LoginPage";
import { DatasetLoadPage } from "@/pages/DatasetLoadPage";
import { DatasetImportPage } from "@/pages/DatasetImportPage";
import { ContextImportPage } from "@/pages/ContextImportPage";
import { TargetRelationshipsPage } from "@/pages/TargetRelationshipsPage";
import { TargetTagsPage } from "@/pages/TargetTagsPage";
import { RelationshipTypesPage } from "@/pages/RelationshipTypesPage";
import { SyncPage } from "@/pages/SyncPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { WorkbenchPage } from "@/pages/WorkbenchPage";
import { ConnectedRecordsPage } from "@/pages/ConnectedRecordsPage";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { RegistryIntegrityPage } from "@/pages/RegistryIntegrityPage";
import { navSections, pageMeta } from "@/lib/navigation";
import { LoadingState } from "@/components/LoadingState";

function useAuthBootstrap() {
  return useQuery({
    queryKey: ["auth", "user"],
    queryFn: api.getUser,
    retry: false,
  });
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  return null;
}

function RequireAuth() {
  const auth = useAuthBootstrap();
  const location = useLocation();

  if (auth.isLoading) {
    return <LoadingState title="Loading session" detail="Checking your saved login and restoring the app." />;
  }
  if (auth.isError) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

function AppShell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const user = queryClient.getQueryData<{ user: string }>(["auth", "user"]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: async () => {
      queryClient.removeQueries({ queryKey: ["auth"] });
      navigate("/login");
    },
  });

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  const closeMenu = () => setOpenMenu(null);
  const toggleMenu = (name: string) => setOpenMenu((current) => (current === name ? null : name));

  return (
    <div className="shell">
      <nav className="navbar">
        <Link className="brand brand-link" to="/workbench">
          Archive Loader
        </Link>
        <div className="nav-groups">
          {navSections.map((section) => (
            <div
              key={section.id}
              className={`nav-group${openMenu === section.id ? " is-open" : ""}`}
              onMouseEnter={() => setOpenMenu(section.id)}
              onMouseLeave={closeMenu}
            >
              <div className="nav-group-header">
                <Link className="nav-trigger" to={section.items[0].to} onClick={closeMenu}>
                  {section.label}
                </Link>
                <button
                  type="button"
                  className="nav-expand"
                  aria-label={`Open ${section.label} menu`}
                  aria-expanded={openMenu === section.id}
                  onClick={() => toggleMenu(section.id)}
                >
                  ▾
                </button>
              </div>
              <div className="nav-menu">
                {section.items.map((item) => (
                  <Link key={item.id} to={item.to} onClick={closeMenu} className={item.visibility === "comingSoon" ? "nav-link-muted" : undefined}>
                    <span>{item.label}</span>
                    {item.visibility === "comingSoon" ? <span className="badge nav-badge">Soon</span> : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="nav-meta">
          <span>{user?.user}</span>
          <button type="button" className="button-secondary" onClick={() => logout.mutate()}>
            Logout
          </button>
        </div>
      </nav>
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  );
}

const contextConfig = {
  targets: {
    title: pageMeta.targetDetails.title,
    subtitle: pageMeta.targetDetails.subtitle,
    legacyLabel: pageMeta.targetDetails.legacyLabel,
    entityType: "targets",
    editType: "target",
    tagType: "targets",
    relationshipType: "target",
    relationshipTo: "spacecraft",
    modelName: "target",
    relationshipModelNames: ["mission"],
  },
  missions: {
    title: pageMeta.missionDetails.title,
    subtitle: pageMeta.missionDetails.subtitle,
    legacyLabel: pageMeta.missionDetails.legacyLabel,
    entityType: "missions",
    editType: "mission",
    tagType: "missions",
    relationshipType: "target",
    relationshipTo: "target",
    modelName: "mission",
    relationshipModelNames: ["target"],
  },
  spacecraft: {
    title: pageMeta.spacecraftDetails.title,
    subtitle: pageMeta.spacecraftDetails.subtitle,
    legacyLabel: pageMeta.spacecraftDetails.legacyLabel,
    entityType: "spacecraft",
    editType: "spacecraft",
    tagType: "spacecraft",
    relationshipType: "instrument",
    relationshipTo: "instrument",
    modelName: "spacecraft",
    relationshipModelNames: ["instrument"],
  },
  instruments: {
    title: pageMeta.instrumentDetails.title,
    subtitle: pageMeta.instrumentDetails.subtitle,
    legacyLabel: pageMeta.instrumentDetails.legacyLabel,
    entityType: "instruments",
    editType: "instrument",
    tagType: "instruments",
    relationshipType: "instrument",
    relationshipTo: "spacecraft",
    modelName: "instrument",
    relationshipModelNames: ["spacecraft", "bundle"],
  },
} as const;

export default function App() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const onForbidden = () => {
      queryClient.removeQueries({ queryKey: ["auth"] });
      navigate("/login");
    };
    window.addEventListener("archive-loader:forbidden", onForbidden);
    return () => window.removeEventListener("archive-loader:forbidden", onForbidden);
  }, [navigate, queryClient]);

  const errorBanner = useMemo(
    () =>
      globalError ? (
        <div className="global-error" role="alert">
          {globalError}
          <button type="button" className="ghost" onClick={() => setGlobalError(null)}>
            Dismiss
          </button>
        </div>
      ) : null,
    [globalError],
  );

  return (
    <>
      <ScrollToTop />
      {errorBanner}
      <Routes>
        <Route path="/login" element={<LoginPage onError={setGlobalError} />} />
        <Route path="/" element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/workbench" replace />} />
            <Route path="workbench" element={<WorkbenchPage />} />
            <Route
              path="datasets/manage"
              element={
                <ManagePage
                  title={pageMeta.datasetsBrowse.title}
                  subtitle={pageMeta.datasetsBrowse.subtitle}
                  legacyLabel={pageMeta.datasetsBrowse.legacyLabel}
                  statusType="datasets"
                  entityType="dataset"
                  mode="datasets"
                  primaryActionLabel="Load Datasets"
                />
              }
            />
            <Route path="datasets/load" element={<DatasetLoadPage onError={setGlobalError} />} />
            <Route path="datasets/import" element={<DatasetImportPage onError={setGlobalError} />} />
            <Route path="connected-records" element={<ConnectedRecordsPage />} />
            <Route
              path="connected-records/missions"
              element={
                <ManagePage
                  title={pageMeta.missionsBrowse.title}
                  subtitle={pageMeta.missionsBrowse.subtitle}
                  legacyLabel={pageMeta.missionsBrowse.legacyLabel}
                  statusType="missions"
                  entityType="mission"
                  mode="missions"
                  primaryActionLabel="Open Mission Editor"
                />
              }
            />
            <Route
              path="connected-records/spacecraft"
              element={
                <ManagePage
                  title={pageMeta.spacecraftBrowse.title}
                  subtitle={pageMeta.spacecraftBrowse.subtitle}
                  legacyLabel={pageMeta.spacecraftBrowse.legacyLabel}
                  statusType="spacecraft"
                  entityType="spacecraft"
                  mode="spacecraft"
                  primaryActionLabel="Open Spacecraft Editor"
                />
              }
            />
            <Route
              path="connected-records/instruments"
              element={
                <ManagePage
                  title={pageMeta.instrumentsBrowse.title}
                  subtitle={pageMeta.instrumentsBrowse.subtitle}
                  legacyLabel={pageMeta.instrumentsBrowse.legacyLabel}
                  statusType="instruments"
                  entityType="instrument"
                  mode="instruments"
                  primaryActionLabel="Open Instrument Editor"
                />
              }
            />
            <Route
              path="connected-records/targets"
              element={
                <ManagePage
                  title={pageMeta.targetsBrowse.title}
                  subtitle={pageMeta.targetsBrowse.subtitle}
                  legacyLabel={pageMeta.targetsBrowse.legacyLabel}
                  statusType="targets"
                  entityType="target"
                  mode="targets"
                  primaryActionLabel="Open Target Editor"
                />
              }
            />
            <Route
              path="missions/manage"
              element={
                <ManagePage
                  title={pageMeta.missionsBrowse.title}
                  subtitle={pageMeta.missionsBrowse.subtitle}
                  legacyLabel={pageMeta.missionsBrowse.legacyLabel}
                  statusType="missions"
                  entityType="mission"
                  mode="missions"
                  primaryActionLabel="Open Mission Editor"
                />
              }
            />
            <Route
              path="spacecraft/manage"
              element={
                <ManagePage
                  title={pageMeta.spacecraftBrowse.title}
                  subtitle={pageMeta.spacecraftBrowse.subtitle}
                  legacyLabel={pageMeta.spacecraftBrowse.legacyLabel}
                  statusType="spacecraft"
                  entityType="spacecraft"
                  mode="spacecraft"
                  primaryActionLabel="Open Spacecraft Editor"
                />
              }
            />
            <Route
              path="instruments/manage"
              element={
                <ManagePage
                  title={pageMeta.instrumentsBrowse.title}
                  subtitle={pageMeta.instrumentsBrowse.subtitle}
                  legacyLabel={pageMeta.instrumentsBrowse.legacyLabel}
                  statusType="instruments"
                  entityType="instrument"
                  mode="instruments"
                  primaryActionLabel="Open Instrument Editor"
                />
              }
            />
            <Route
              path="targets/manage"
              element={
                <ManagePage
                  title={pageMeta.targetsBrowse.title}
                  subtitle={pageMeta.targetsBrowse.subtitle}
                  legacyLabel={pageMeta.targetsBrowse.legacyLabel}
                  statusType="targets"
                  entityType="target"
                  mode="targets"
                  primaryActionLabel="Open Target Editor"
                />
              }
            />
            <Route path="targets/import" element={<ContextImportPage config={contextConfig.targets} onError={setGlobalError} />} />
            <Route path="missions/import" element={<ContextImportPage config={contextConfig.missions} onError={setGlobalError} />} />
            <Route path="spacecraft/import" element={<ContextImportPage config={contextConfig.spacecraft} onError={setGlobalError} />} />
            <Route path="instruments/import" element={<ContextImportPage config={contextConfig.instruments} onError={setGlobalError} />} />
            <Route path="connected-records/targets/relationships" element={<TargetRelationshipsPage onError={setGlobalError} />} />
            <Route path="targets/relate" element={<TargetRelationshipsPage onError={setGlobalError} />} />
            <Route path="settings/tags" element={<TargetTagsPage onError={setGlobalError} />} />
            <Route path="targets/tags" element={<TargetTagsPage onError={setGlobalError} />} />
            <Route path="settings/relationship-types" element={<RelationshipTypesPage onError={setGlobalError} />} />
            <Route path="tools/relationships" element={<RelationshipTypesPage onError={setGlobalError} />} />
            <Route path="publishing/archive-navigator" element={<SyncPage onError={setGlobalError} />} />
            <Route path="tools/sync" element={<SyncPage onError={setGlobalError} />} />
            <Route path="publishing/issues" element={<ReportsPage onError={setGlobalError} />} />
            <Route path="tools/reports" element={<ReportsPage onError={setGlobalError} />} />
            <Route path="registry-jobs/validate" element={<ComingSoonPage title={pageMeta.registryValidate.title} subtitle={pageMeta.registryValidate.subtitle} />} />
            <Route path="registry-jobs/harvest" element={<ComingSoonPage title={pageMeta.registryHarvest.title} subtitle={pageMeta.registryHarvest.subtitle} />} />
            <Route path="registry-jobs/integrity" element={<RegistryIntegrityPage onError={setGlobalError} />} />
            <Route path="registry-jobs/integrity/:jobId" element={<RegistryIntegrityPage onError={setGlobalError} />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
