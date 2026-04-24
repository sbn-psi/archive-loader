import { Link } from "react-router-dom";
import { PageIntro } from "@/components/PageIntro";
import { RecentContextActivity } from "@/components/RecentContextActivity";
import { pageMeta } from "@/lib/navigation";

const primaryCards = [
  {
    title: "Load Datasets",
    description: "Preview archive content, load bundle or collection records, and continue directly into dataset editing.",
    to: "/datasets/load",
  },
  {
    title: "Update Datasets",
    description: "Browse datasets already in Archive Loader and open any record for editing.",
    to: "/datasets/manage",
  },
  {
    title: "Edit Context Objects",
    description: "Open missions, spacecraft, instruments, and targets for editing.",
    to: "/connected-records",
  },
  {
    title: "Publish to Archive Navigator",
    description: "Stage the current Archive Loader content and publish it to Archive Navigator when ready.",
    to: "/publishing/archive-navigator",
  },
];

const futureCards = [
  {
    title: pageMeta.registryValidate.title,
    description: "Run validation jobs against archive content before it moves further through the lifecycle.",
    to: "/registry-jobs/validate",
  },
  {
    title: pageMeta.registryHarvest.title,
    description: "Load archive content into the external Registry once that workflow is available.",
    to: "/registry-jobs/harvest",
  },
  {
    title: pageMeta.registryIntegrity.title,
    description: "Compare Registry content against the archive to find gaps or drift.",
    to: "/registry-jobs/integrity",
  },
];

export function WorkbenchPage() {
  return (
    <div className="page-card">
      <PageIntro title={pageMeta.workbench.title} subtitle={pageMeta.workbench.subtitle} />
      <div className="grid two">
        <div>
          <h2>Current Tasks</h2>
          <div className="workbench-grid">
            {primaryCards.map((card) => (
              <Link key={card.title} className="surface-tile" to={card.to}>
                <strong>{card.title}</strong>
                <span>{card.description}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2>Next Capabilities</h2>
          <div className="workbench-grid">
            {futureCards.map((card) => (
              <Link key={card.title} className="surface-tile is-muted" to={card.to}>
                <span className="badge">Coming Soon</span>
                <strong>{card.title}</strong>
                <span>{card.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <RecentContextActivity />
    </div>
  );
}
