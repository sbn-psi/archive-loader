import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

type RelationshipMode = "INITIAL" | "SPECIFYING" | "RELATING";

export function TargetRelationshipsPage({ onError }: { onError: (message: string | null) => void }) {
  const [mode, setMode] = useState<RelationshipMode>("INITIAL");
  const [selectedTarget, setSelectedTarget] = useState<{ lid: string; name: string } | null>(null);
  const [relationship, setRelationship] = useState<string>("");
  const data = useQuery({
    queryKey: ["target-relationships"],
    queryFn: api.getTargetRelationshipStatus,
  });

  if (data.isLoading || !data.data) {
    return <div className="page-state">Loading target relationships...</div>;
  }

  const childOf = (targetLid: string) =>
    data.data.relationships.filter((item) => item.child_ref === targetLid).map((item) => item.parent_ref as string);
  const parentOf = (targetLid: string) =>
    data.data.relationships.filter((item) => item.parent_ref === targetLid).map((item) => item.child_ref as string);
  const associatedTo = (targetLid: string) =>
    data.data.relationships
      .filter((item) => Array.isArray(item.associated_targets) && item.associated_targets.includes(targetLid))
      .map((item) => (item.associated_targets as string[]).find((candidate) => candidate !== targetLid) ?? "");

  return (
    <div className="page-card">
      <h1 className="page-title">Relate Targets</h1>
      {mode === "INITIAL" ? (
        <ul>
          {data.data.targets.map((target) => (
            <li key={target.lid}>
              <strong>{target.name}</strong>
              <div>Child of: {childOf(target.lid).join(", ") || "None"}</div>
              <div>Parent of: {parentOf(target.lid).join(", ") || "None"}</div>
              <div>Associated to: {associatedTo(target.lid).join(", ") || "None"}</div>
              <div className="button-row">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => {
                    setSelectedTarget(target);
                    setMode("SPECIFYING");
                  }}
                >
                  Add Relationship
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <h2>{selectedTarget?.name}</h2>
          <div className="field">
            <label>Relationship</label>
            <select
              value={relationship}
              onChange={(event) => {
                setRelationship(event.target.value);
                setMode("RELATING");
              }}
            >
              <option value="">Choose relationship</option>
              <option value="parentOf">a parent of</option>
              <option value="childOf">a child of</option>
              <option value="associated">associated to</option>
            </select>
          </div>
          {mode === "RELATING" ? (
            <ul>
              {data.data.targets.map((target) => (
                <li key={target.lid}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={async () => {
                      try {
                        const payload =
                          relationship === "parentOf"
                            ? { parent_ref: selectedTarget?.lid, child_ref: target.lid }
                            : relationship === "childOf"
                              ? { parent_ref: target.lid, child_ref: selectedTarget?.lid }
                              : { associated_targets: [target.lid, selectedTarget?.lid] };
                        await api.saveTargetRelationships(payload);
                        await data.refetch();
                        setMode("INITIAL");
                        setRelationship("");
                        setSelectedTarget(null);
                      } catch (error) {
                        onError(error instanceof Error ? error.message : "Relationship save failed");
                      }
                    }}
                  >
                    {target.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
