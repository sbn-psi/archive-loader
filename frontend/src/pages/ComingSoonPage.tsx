import { Link } from "react-router-dom";
import { PageIntro } from "@/components/PageIntro";

export function ComingSoonPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-card">
      <PageIntro title={title} subtitle={subtitle} modeLabel="Coming Soon" />
      <p className="muted">
        This area is reserved now so the app can grow into archive validation, Registry jobs, and integrity checking without another
        navigation reset.
      </p>
      <div className="button-row">
        <Link className="button-secondary" to="/workbench">
          Back to Workbench
        </Link>
      </div>
    </div>
  );
}
