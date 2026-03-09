type RepeatStringListProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
};

export function RepeatStringList({ label, values, onChange, suggestions = [] }: RepeatStringListProps) {
  const addValue = () => onChange([...values, ""]);
  const updateValue = (index: number, next: string) =>
    onChange(values.map((value, current) => (current === index ? next : value)));
  const removeValue = (index: number) => onChange(values.filter((_, current) => current !== index));

  return (
    <div className="page-card">
      <h3>{label}</h3>
      {values.map((value, index) => (
        <div className="repeat-row" key={`${label}-${index}`}>
          <div className="field">
            <input list={`${label}-suggestions`} value={value} onChange={(event) => updateValue(index, event.target.value)} />
          </div>
          <button type="button" className="ghost" onClick={() => removeValue(index)}>
            Remove
          </button>
        </div>
      ))}
      <div className="button-row">
        <button type="button" className="ghost" onClick={addValue}>
          Add {label.slice(0, -1)}
        </button>
      </div>
      <datalist id={`${label}-suggestions`}>
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
}
