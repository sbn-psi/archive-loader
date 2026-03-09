import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function ReportsPage({ onError }: { onError: (message: string | null) => void }) {
  const targetTypes = useQuery({ queryKey: ["relationship-types", "target"], queryFn: () => api.getRelationshipTypes("target") });
  const instrumentTypes = useQuery({ queryKey: ["relationship-types", "instrument"], queryFn: () => api.getRelationshipTypes("instrument") });
  const relationships = useQuery({ queryKey: ["status", "relationships"], queryFn: api.getRelationshipStatus });

  if (targetTypes.isLoading || instrumentTypes.isLoading || relationships.isLoading) {
    return <div className="page-state">Loading reports...</div>;
  }

  const hiddenTypes = [...(targetTypes.data ?? []), ...(instrumentTypes.data ?? [])].filter((type) => type.order >= 1000);
  const grouped = hiddenTypes.map((type) => ({
    name: type.name,
    relationships: (relationships.data ?? []).filter((relationship) => relationship.relationshipId === type.relationshipId),
  }));

  return (
    <div className="page-card">
      <h1 className="page-title">Reported Issues</h1>
      {grouped.map((group) => (
        <div key={group.name} className="page-card">
          <h3>{group.name}</h3>
          <table className="table">
            <tbody>
              {group.relationships.map((relationship, index) => (
                <tr key={`${group.name}-${index}`}>
                  <td>{relationship.target ? `Target: ${relationship.target}` : relationship.instrument ? `Instrument: ${relationship.instrument}` : `Spacecraft: ${relationship.instrument_host}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
