import { Link } from "react-router-dom";
import { groupItems } from "@/lib/domain";
import type { StatusListItem } from "@/types";

type ManageTableProps = {
  items: StatusListItem[];
  editHref: (lid: string) => string;
  onDelete: (item: StatusListItem) => void;
  groupBy?: string;
  showTags?: boolean;
  showContext?: boolean;
  showReady?: boolean;
  groupLabels?: Record<string, string>;
};

function Row({
  item,
  editHref,
  onDelete,
  showTags,
  showContext,
  showReady,
}: {
  item: StatusListItem;
  editHref: (lid: string) => string;
  onDelete: (item: StatusListItem) => void;
  showTags?: boolean;
  showContext?: boolean;
  showReady?: boolean;
}) {
  const firstTag = Array.isArray(item.tags) && item.tags.length > 0 ? item.tags[0] : null;
  return (
    <tr>
      <td>{item.name}</td>
      <td>{item.lid}</td>
      {showContext ? <td className={item.context === "Missing Context!" ? "status-error" : ""}>{item.context}</td> : null}
      {showTags ? (
        <td className={!firstTag ? "status-error" : ""}>{firstTag ?? "Needs tags!"}</td>
      ) : null}
      {showReady ? <td className={!item.is_ready ? "status-error" : ""}>{item.is_ready ? "Ready" : "Not Ready"}</td> : null}
      <td className="inline-actions action-cell">
        <Link className="button-primary" to={editHref(item.lid)}>Edit</Link>
        <button type="button" className="button-danger ghost-danger" onClick={() => onDelete(item)}>
          Delete
        </button>
      </td>
    </tr>
  );
}

export function ManageTable(props: ManageTableProps) {
  const { groups, ungrouped } = groupItems(props.items, props.groupBy);

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>LID</th>
          {props.showContext ? <th>Page Context</th> : null}
          {props.showTags ? <th>Group Tag</th> : null}
          {props.showReady ? <th>Ready Status</th> : null}
          <th className="action-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        {ungrouped.map((item) => (
          <Row key={item.lid} item={item} editHref={props.editHref} onDelete={props.onDelete} showTags={props.showTags} showContext={props.showContext} showReady={props.showReady} />
        ))}
        {groups.map((group) => (
          group.name ? (
            <>
              <tr key={`${group.name}-heading`}>
                <td colSpan={props.showContext || props.showTags || props.showReady ? 6 : 3}>
                  <strong>{props.groupLabels?.[group.name] ?? group.name}</strong>
                </td>
              </tr>
              {group.items.map((item) => (
                <Row key={item.lid} item={item} editHref={props.editHref} onDelete={props.onDelete} showTags={props.showTags} showContext={props.showContext} showReady={props.showReady} />
              ))}
            </>
          ) : group.items.map((item) => (
            <Row key={item.lid} item={item} editHref={props.editHref} onDelete={props.onDelete} showTags={props.showTags} showContext={props.showContext} showReady={props.showReady} />
          ))
        ))}
      </tbody>
    </table>
  );
}
