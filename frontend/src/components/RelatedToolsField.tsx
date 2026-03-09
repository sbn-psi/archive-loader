import type { ToolRecord } from "@/types";

type RelatedToolsFieldProps = {
  tools: ToolRecord[];
  onChange: (tools: ToolRecord[]) => void;
};

export function RelatedToolsField({ tools, onChange }: RelatedToolsFieldProps) {
  const updateTool = (toolId: string, changes: Partial<ToolRecord>) => {
    onChange(tools.map((tool) => (tool.toolId === toolId ? { ...tool, ...changes } : tool)));
  };

  return (
    <div className="page-card">
      <h3>Related Tools</h3>
      <div className="tool-grid">
        {tools.map((tool) => (
          <div key={tool.toolId} className={`tool-card ${tool.selected ? "selected" : ""}`}>
            <div className="toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(tool.selected)}
                  onChange={(event) => updateTool(tool.toolId, { selected: event.target.checked })}
                />
                {" "}
                {tool.name ?? tool.display_name ?? tool.toolId}
              </label>
            </div>
            {tool.image_url ? <img src={tool.image_url} alt="" style={{ maxWidth: "80px", margin: "0.75rem 0" }} /> : null}
            <div className="field">
              <label>Direct Link</label>
              <input
                type="url"
                value={tool.directUrl ?? ""}
                onChange={(event) =>
                  updateTool(tool.toolId, { directUrl: event.target.value, selected: event.target.value ? true : tool.selected })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
