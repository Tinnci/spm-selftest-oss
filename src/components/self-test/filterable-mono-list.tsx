import { Input } from "@/components/ui/input";

export function FilterableMonoList({
  items,
  filter,
  onFilterChange,
  placeholder,
  emptyText,
  panelId,
  tabId,
}: {
  items: string[];
  filter: string;
  onFilterChange: (value: string) => void;
  placeholder: string;
  emptyText: string;
  panelId: string;
  tabId: string;
}) {
  return (
    <div
      className="selftest-list-pane"
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
    >
      <Input
        value={filter}
        placeholder={placeholder}
        onChange={(e) => onFilterChange(e.target.value)}
      />
      <ul className="selftest-mono-list">
        {items.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
      {items.length === 0 ? <p className="quiet">{emptyText}</p> : null}
    </div>
  );
}
