import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { extractDistinctGroups } from "@/lib/domain";
import { LoadingState } from "@/components/LoadingState";
import { PageIntro } from "@/components/PageIntro";
import { pageMeta } from "@/lib/navigation";

export function TargetTagsPage({ onError }: { onError: (message: string | null) => void }) {
  const tags = useQuery({
    queryKey: ["tags", "targets"],
    queryFn: () => api.getTags("targets"),
  });
  const [editing, setEditing] = useState<{ name: string; group?: string; newGroup?: string } | null>(null);

  if (tags.isLoading || !tags.data) {
    return <LoadingState title="Loading target tags" detail="Fetching existing tags and tag groups." />;
  }

  const groups = extractDistinctGroups(tags.data);

  return (
    <div className="page-card">
      <PageIntro title={pageMeta.tagGroups.title} subtitle={pageMeta.tagGroups.subtitle} legacyLabel={pageMeta.tagGroups.legacyLabel} />
      {editing ? (
        <div className="page-card">
          <div className="form-page-header compact">
            <h3>Edit Group for {editing.name}</h3>
            <div className="form-page-actions">
              <button
                type="button"
                className="button-primary"
                onClick={async () => {
                  try {
                    const original = tags.data.find((tag) => tag.name === editing.name);
                    if (!original) {
                      return;
                    }
                    await api.saveTag({ ...original, group: editing.newGroup || editing.group });
                    setEditing(null);
                    await tags.refetch();
                  } catch (error) {
                    onError(error instanceof Error ? error.message : "Tag save failed");
                  }
                }}
              >
                Save Group
              </button>
            </div>
          </div>
          <div className="field">
            <label>Existing Group</label>
            <select value={editing.group ?? ""} onChange={(event) => setEditing({ ...editing, group: event.target.value })}>
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>New Group</label>
            <input value={editing.newGroup ?? ""} onChange={(event) => setEditing({ ...editing, newGroup: event.target.value })} />
          </div>
          <div className="button-row">
            <button type="button" className="ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Group</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tags.data.map((tag) => (
            <tr key={tag.name}>
              <td>{tag.name}</td>
              <td>{tag.group ?? "Ungrouped"}</td>
              <td className="inline-actions">
                <button type="button" className="button-primary" onClick={() => setEditing({ name: tag.name, group: tag.group })}>
                  Edit
                </button>
                <button
                  type="button"
                  className="button-danger ghost-danger"
                  onClick={async () => {
                    if (!window.confirm(`Delete ${tag.name}?`)) {
                      return;
                    }
                    await api.deleteTag(tag.type, tag.name);
                    await tags.refetch();
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
