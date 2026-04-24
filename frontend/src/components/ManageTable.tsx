import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildHierarchicalGroups, groupItems } from "@/lib/domain";
import type { StatusListItem } from "@/types";

type HierarchicalConfig = {
  groupField: string;
  isRoot: (item: StatusListItem) => boolean;
  childLabel?: (count: number) => string;
  orphanHeading?: string;
};

type ManageTableProps = {
  items: StatusListItem[];
  editHref: (lid: string) => string;
  onDelete: (item: StatusListItem) => void;
  groupBy?: string;
  groupSort?: "name" | "first-item";
  showTags?: boolean;
  showContext?: boolean;
  showReady?: boolean;
  showUpdatedAt?: boolean;
  groupLabels?: Record<string, string>;
  hierarchical?: HierarchicalConfig;
};

type SortKey = "name" | "lid" | "context" | "tag" | "is_ready" | "updated_at";

function defaultChildLabel(count: number) {
  return count === 1 ? "1 collection" : `${count} collections`;
}

function formatLastEdited(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function Row({
  item,
  editHref,
  onDelete,
  showTags,
  showContext,
  showReady,
  showUpdatedAt,
  variant,
  badge,
}: {
  item: StatusListItem;
  editHref: (lid: string) => string;
  onDelete: (item: StatusListItem) => void;
  showTags?: boolean;
  showContext?: boolean;
  showReady?: boolean;
  showUpdatedAt?: boolean;
  variant?: "root" | "child";
  badge?: string;
}) {
  const firstTag = Array.isArray(item.tags) && item.tags.length > 0 ? item.tags[0] : null;
  const rowClass = variant === "child" ? "is-child" : variant === "root" ? "is-root" : undefined;
  return (
    <tr className={rowClass}>
      <td className="col-name">
        {item.name}
        {badge ? <span className="collection-count-badge">{badge}</span> : null}
      </td>
      <td className="col-lid">{item.lid}</td>
      {showContext ? <td className={`col-context${item.context === "Missing Context!" ? " status-error" : ""}`}>{item.context}</td> : null}
      {showTags ? (
        <td className={`col-tag${!firstTag ? " status-error" : ""}`}>{firstTag ?? "Needs tags!"}</td>
      ) : null}
      {showReady ? <td className={`col-ready${!item.is_ready ? " status-error" : ""}`}>{item.is_ready ? "Ready" : "Not Ready"}</td> : null}
      {showUpdatedAt ? <td className="col-updated">{formatLastEdited(item.updated_at)}</td> : null}
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
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const sortedItems = useMemo(() => {
    const valueForSort = (item: StatusListItem, key: SortKey) => {
      switch (key) {
        case "name":
          return item.name ?? "";
        case "lid":
          return item.lid ?? "";
        case "context":
          return item.context ?? "";
        case "tag":
          return Array.isArray(item.tags) && item.tags.length > 0 ? item.tags[0] : "";
        case "is_ready":
          return item.is_ready ? "1" : "0";
        case "updated_at":
          return item.updated_at ?? "";
        default:
          return "";
      }
    };

    return [...props.items].sort((left, right) => {
      const leftValue = valueForSort(left, sortKey);
      const rightValue = valueForSort(right, sortKey);
      const comparison = String(leftValue).localeCompare(String(rightValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [props.items, sortDirection, sortKey]);
  const hierarchical = props.hierarchical
    ? buildHierarchicalGroups(sortedItems, props.hierarchical.groupField, props.hierarchical.isRoot)
    : null;
  const { groups, ungrouped } = hierarchical
    ? { groups: [], ungrouped: [] as StatusListItem[] }
    : groupItems(sortedItems, props.groupBy, props.groupSort);
  const colSpan = 3 + (props.showContext ? 1 : 0) + (props.showTags ? 1 : 0) + (props.showReady ? 1 : 0) + (props.showUpdatedAt ? 1 : 0);
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "updated_at" ? "desc" : "asc");
  };
  const headerButton = (label: string, key: SortKey) => (
    <button type="button" className={`table-sort${sortKey === key ? " is-active" : ""}`} onClick={() => toggleSort(key)} aria-label={`Sort by ${label}`}>
      <span>{label}</span>
      <span className="table-sort-icons" aria-hidden="true">
        <span className={`table-sort-icon${sortKey === key && sortDirection === "asc" ? " is-active" : ""}`}>↑</span>
        <span className={`table-sort-icon${sortKey === key && sortDirection === "desc" ? " is-active" : ""}`}>↓</span>
      </span>
    </button>
  );

  return (
    <div className="table-wrap">
      <table className="table manage-table">
        <thead>
          <tr>
            <th className="col-name">{headerButton("Name", "name")}</th>
            <th className="col-lid">{headerButton("LID", "lid")}</th>
            {props.showContext ? <th className="col-context">{headerButton("Page Context", "context")}</th> : null}
            {props.showTags ? <th className="col-tag">{headerButton("Group Tag", "tag")}</th> : null}
            {props.showReady ? <th className="col-ready">{headerButton("Ready Status", "is_ready")}</th> : null}
            {props.showUpdatedAt ? <th className="col-updated">{headerButton("Last Edited", "updated_at")}</th> : null}
            <th className="action-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hierarchical ? (
            <>
              {hierarchical.groups.map((group) => {
                const count = group.children.length;
                const badge = group.root && count > 0
                  ? (props.hierarchical?.childLabel ?? defaultChildLabel)(count)
                  : undefined;
                return (
                  <Fragment key={group.key}>
                    {group.root ? (
                      <Row
                        item={group.root}
                        editHref={props.editHref}
                        onDelete={props.onDelete}
                        showTags={props.showTags}
                        showContext={props.showContext}
                        showReady={props.showReady}
                        showUpdatedAt={props.showUpdatedAt}
                        variant="root"
                        badge={badge}
                      />
                    ) : null}
                    {group.children.map((child) => (
                      <Row
                        key={child.lid}
                        item={child}
                        editHref={props.editHref}
                        onDelete={props.onDelete}
                        showTags={props.showTags}
                        showContext={props.showContext}
                        showReady={props.showReady}
                        showUpdatedAt={props.showUpdatedAt}
                        variant="child"
                      />
                    ))}
                  </Fragment>
                );
              })}
              {hierarchical.orphans.length > 0 ? (
                <>
                  <tr className="orphan-heading">
                    <td colSpan={colSpan + 1}>
                      {props.hierarchical?.orphanHeading ?? "Items without a matching parent"}
                    </td>
                  </tr>
                  {hierarchical.orphans.map((item) => (
                    <Row
                      key={item.lid}
                      item={item}
                      editHref={props.editHref}
                      onDelete={props.onDelete}
                      showTags={props.showTags}
                      showContext={props.showContext}
                      showReady={props.showReady}
                      showUpdatedAt={props.showUpdatedAt}
                    />
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <>
              {ungrouped.map((item) => (
                <Row key={item.lid} item={item} editHref={props.editHref} onDelete={props.onDelete} showTags={props.showTags} showContext={props.showContext} showReady={props.showReady} showUpdatedAt={props.showUpdatedAt} />
              ))}
              {groups.map((group) => (
                group.name ? (
                  <Fragment key={`${group.name}-group`}>
                    <tr>
                      <td colSpan={colSpan}>
                        <strong>{props.groupLabels?.[group.name] ?? group.name}</strong>
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <Row key={item.lid} item={item} editHref={props.editHref} onDelete={props.onDelete} showTags={props.showTags} showContext={props.showContext} showReady={props.showReady} showUpdatedAt={props.showUpdatedAt} />
                    ))}
                  </Fragment>
                ) : group.items.map((item) => (
                  <Row key={item.lid} item={item} editHref={props.editHref} onDelete={props.onDelete} showTags={props.showTags} showContext={props.showContext} showReady={props.showReady} showUpdatedAt={props.showUpdatedAt} />
                ))
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
