import type { LookupRelationship, RelationshipType } from "@/types";

type RelationshipSelectorFieldProps = {
  title: string;
  relationships: LookupRelationship[];
  onChange: (items: LookupRelationship[]) => void;
  relationshipTypes?: RelationshipType[] | null;
};

export function RelationshipSelectorField({
  title,
  relationships,
  onChange,
  relationshipTypes,
}: RelationshipSelectorFieldProps) {
  const updateRelationship = (index: number, changes: Partial<LookupRelationship>) => {
    onChange(
      relationships.map((relationship, current) =>
        current === index ? { ...relationship, ...changes } : relationship,
      ),
    );
  };

  return (
    <div className="page-card">
      <h3>{title}</h3>
      {relationships.length === 0 ? <p>No related records discovered yet.</p> : null}
      {relationships.map((relationship, index) => (
        <div className="repeat-row" key={`${relationship.lid}-${index}`}>
          <div className="field">
            <input disabled value={relationship.name ? `${relationship.name} (${relationship.lid})` : relationship.lid} />
          </div>
          <div className="field">
            {relationshipTypes ? (
              <select
                value={relationship.relationshipId ?? ""}
                onChange={(event) => updateRelationship(index, { relationshipId: event.target.value })}
              >
                <option value="">Choose relationship</option>
                {relationshipTypes
                  .slice()
                  .sort((left, right) => left.order - right.order)
                  .map((type) => (
                    <option key={type.relationshipId ?? type.name} value={type.relationshipId}>
                      {type.name}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                value={relationship.label ?? ""}
                onChange={(event) => updateRelationship(index, { label: event.target.value })}
                placeholder="Relationship label"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
