import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { flattenRelationshipTypeGroups, groupRelationshipTypes } from "@/lib/domain";
import type { RelationshipType } from "@/types";

function RelationshipTypeColumn({
  title,
  type,
  onError,
}: {
  title: string;
  type: "target" | "instrument";
  onError: (message: string | null) => void;
}) {
  const query = useQuery({
    queryKey: ["relationship-types", type],
    queryFn: () => api.getRelationshipTypes(type),
  });
  const [draftName, setDraftName] = useState("");
  const [draftGroup, setDraftGroup] = useState<"always" | "sometimes" | "never">("never");
  const [draftGroups, setDraftGroups] = useState<Record<"always" | "sometimes" | "never", RelationshipType[]> | null>(null);

  if (query.isLoading || !query.data) {
    return <div className="page-card">Loading {title.toLowerCase()}...</div>;
  }

  const grouped = draftGroups ?? groupRelationshipTypes(query.data);
  const save = async (groups: typeof grouped) => {
    try {
      await api.saveRelationshipTypes(type, flattenRelationshipTypeGroups(groups));
      setDraftGroups(null);
      await query.refetch();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Relationship type save failed");
    }
  };

  return (
    <div className="page-card">
      <div className="form-page-header compact">
        <h2>{title}</h2>
        <div className="form-page-actions">
          <button type="button" className="button-primary" onClick={() => void save(grouped)}>
            Save Changes
          </button>
        </div>
      </div>
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((groupName) => (
        <div key={groupName} className="page-card">
          <h3>{groupName}</h3>
          {grouped[groupName].map((item, index) => (
            <div key={item.relationshipId ?? item.name} className="repeat-row">
              <div className="field">
                <input
                  value={item.name}
                  onChange={(event) => {
                    const next = {
                      ...grouped,
                      [groupName]: grouped[groupName].map((entry, current) =>
                        current === index ? { ...item, name: event.target.value } : entry,
                      ),
                    };
                    setDraftGroups(next);
                  }}
                />
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={index === 0}
                  onClick={() => {
                    const items = grouped[groupName].slice();
                    [items[index - 1], items[index]] = [items[index], items[index - 1]];
                    setDraftGroups({ ...grouped, [groupName]: items });
                  }}
                >
                  Move Up
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={index === grouped[groupName].length - 1}
                  onClick={() => {
                    const items = grouped[groupName].slice();
                    [items[index], items[index + 1]] = [items[index + 1], items[index]];
                    setDraftGroups({ ...grouped, [groupName]: items });
                  }}
                >
                  Move Down
                </button>
                <button
                  type="button"
                  className="button-danger ghost-danger"
                  onClick={async () => {
                    try {
                      await api.removeRelationshipType(type, item);
                      await query.refetch();
                    } catch (error) {
                      onError(error instanceof Error ? error.message : "Relationship type remove failed");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className="field">
        <label>New Relationship</label>
        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
      </div>
      <div className="field">
        <label>Group</label>
        <select value={draftGroup} onChange={(event) => setDraftGroup(event.target.value as typeof draftGroup)}>
          <option value="always">Always</option>
          <option value="sometimes">Sometimes</option>
          <option value="never">Never</option>
        </select>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            const next = {
              ...grouped,
              [draftGroup]: [...grouped[draftGroup], { name: draftName, order: 1000 }],
            };
            setDraftName("");
            setDraftGroups(next);
          }}
        >
          Add Relationship Type
        </button>
      </div>
    </div>
  );
}

export function RelationshipTypesPage({ onError }: { onError: (message: string | null) => void }) {
  return (
    <div className="grid two">
      <RelationshipTypeColumn title="Mission-to-Target" type="target" onError={onError} />
      <RelationshipTypeColumn title="Spacecraft-to-Instrument" type="instrument" onError={onError} />
    </div>
  );
}
