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
    return <div className="page-state">Loading session...</div>;
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
        <div className="brand">Archive Loader</div>
        <div className="nav-groups">
          <div className={`nav-group${openMenu === "datasets" ? " is-open" : ""}`} onMouseEnter={() => setOpenMenu("datasets")} onMouseLeave={closeMenu}>
            <button type="button" className="nav-trigger" aria-expanded={openMenu === "datasets"} onClick={() => toggleMenu("datasets")}>Datasets</button>
            <div className="nav-menu">
              <Link to="/datasets/manage" onClick={closeMenu}>Manage Datasets</Link>
              <Link to="/datasets/load" onClick={closeMenu}>Load Archived Dataset</Link>
              <Link to="/datasets/import?type=Bundle" onClick={closeMenu}>Add new Bundle</Link>
              <Link to="/datasets/import?type=Collection" onClick={closeMenu}>Add new Collection</Link>
            </div>
          </div>
          <div className={`nav-group${openMenu === "targets" ? " is-open" : ""}`} onMouseEnter={() => setOpenMenu("targets")} onMouseLeave={closeMenu}>
            <button type="button" className="nav-trigger" aria-expanded={openMenu === "targets"} onClick={() => toggleMenu("targets")}>Targets</button>
            <div className="nav-menu">
              <Link to="/targets/manage" onClick={closeMenu}>Manage Targets</Link>
              <Link to="/targets/relate" onClick={closeMenu}>Relate Targets</Link>
              <Link to="/targets/import" onClick={closeMenu}>Add Target</Link>
              <Link to="/targets/tags" onClick={closeMenu}>Manage Tags</Link>
            </div>
          </div>
          <div className={`nav-group${openMenu === "missions" ? " is-open" : ""}`} onMouseEnter={() => setOpenMenu("missions")} onMouseLeave={closeMenu}>
            <button type="button" className="nav-trigger" aria-expanded={openMenu === "missions"} onClick={() => toggleMenu("missions")}>Missions</button>
            <div className="nav-menu">
              <Link to="/missions/manage" onClick={closeMenu}>Manage Missions</Link>
              <Link to="/missions/import" onClick={closeMenu}>Add Mission</Link>
            </div>
          </div>
          <div className={`nav-group${openMenu === "spacecraft" ? " is-open" : ""}`} onMouseEnter={() => setOpenMenu("spacecraft")} onMouseLeave={closeMenu}>
            <button type="button" className="nav-trigger" aria-expanded={openMenu === "spacecraft"} onClick={() => toggleMenu("spacecraft")}>Spacecraft</button>
            <div className="nav-menu">
              <Link to="/spacecraft/manage" onClick={closeMenu}>Manage Spacecraft</Link>
              <Link to="/spacecraft/import" onClick={closeMenu}>Add Spacecraft</Link>
            </div>
          </div>
          <div className={`nav-group${openMenu === "instruments" ? " is-open" : ""}`} onMouseEnter={() => setOpenMenu("instruments")} onMouseLeave={closeMenu}>
            <button type="button" className="nav-trigger" aria-expanded={openMenu === "instruments"} onClick={() => toggleMenu("instruments")}>Instruments</button>
            <div className="nav-menu">
              <Link to="/instruments/manage" onClick={closeMenu}>Manage Instruments</Link>
              <Link to="/instruments/import" onClick={closeMenu}>Add Instrument</Link>
            </div>
          </div>
          <div className={`nav-group${openMenu === "tools" ? " is-open" : ""}`} onMouseEnter={() => setOpenMenu("tools")} onMouseLeave={closeMenu}>
            <button type="button" className="nav-trigger" aria-expanded={openMenu === "tools"} onClick={() => toggleMenu("tools")}>Tools</button>
            <div className="nav-menu">
              <Link to="/tools/relationships" onClick={closeMenu}>Manage Relationships</Link>
              <Link to="/tools/sync" onClick={closeMenu}>Sync Data</Link>
              <Link to="/tools/reports" onClick={closeMenu}>Reported Issues</Link>
            </div>
          </div>
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
    title: "Add Target",
    entityType: "targets",
    editType: "target",
    tagType: "targets",
    relationshipType: "target",
    relationshipTo: "spacecraft",
    modelName: "target",
    relationshipModelNames: ["mission"],
  },
  missions: {
    title: "Add Mission",
    entityType: "missions",
    editType: "mission",
    tagType: "missions",
    relationshipType: "target",
    relationshipTo: "target",
    modelName: "mission",
    relationshipModelNames: ["target"],
  },
  spacecraft: {
    title: "Add Spacecraft",
    entityType: "spacecraft",
    editType: "spacecraft",
    tagType: "spacecraft",
    relationshipType: "instrument",
    relationshipTo: "instrument",
    modelName: "spacecraft",
    relationshipModelNames: ["instrument"],
  },
  instruments: {
    title: "Add Instrument",
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
            <Route index element={<Navigate to="/datasets/manage" replace />} />
            <Route path="datasets/manage" element={<ManagePage title="Datasets" statusType="datasets" entityType="dataset" mode="datasets" />} />
            <Route path="datasets/load" element={<DatasetLoadPage onError={setGlobalError} />} />
            <Route path="datasets/import" element={<DatasetImportPage onError={setGlobalError} />} />
            <Route path="targets/manage" element={<ManagePage title="Targets" statusType="targets" entityType="target" mode="targets" />} />
            <Route path="missions/manage" element={<ManagePage title="Missions" statusType="missions" entityType="mission" mode="missions" />} />
            <Route path="spacecraft/manage" element={<ManagePage title="Spacecraft" statusType="spacecraft" entityType="spacecraft" mode="spacecraft" />} />
            <Route path="instruments/manage" element={<ManagePage title="Instruments" statusType="instruments" entityType="instrument" mode="instruments" />} />
            <Route path="targets/import" element={<ContextImportPage config={contextConfig.targets} onError={setGlobalError} />} />
            <Route path="missions/import" element={<ContextImportPage config={contextConfig.missions} onError={setGlobalError} />} />
            <Route path="spacecraft/import" element={<ContextImportPage config={contextConfig.spacecraft} onError={setGlobalError} />} />
            <Route path="instruments/import" element={<ContextImportPage config={contextConfig.instruments} onError={setGlobalError} />} />
            <Route path="targets/relate" element={<TargetRelationshipsPage onError={setGlobalError} />} />
            <Route path="targets/tags" element={<TargetTagsPage onError={setGlobalError} />} />
            <Route path="tools/relationships" element={<RelationshipTypesPage onError={setGlobalError} />} />
            <Route path="tools/sync" element={<SyncPage onError={setGlobalError} />} />
            <Route path="tools/reports" element={<ReportsPage onError={setGlobalError} />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
