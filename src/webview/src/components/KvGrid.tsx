export type KvItem = {
  label: string;
  value: string;
  muted?: boolean;
};

type KvGridProps = {
  items: KvItem[];
};

export function KvGrid({ items }: KvGridProps) {
  return (
    <div className="kv-grid">
      {items.map((item) => (
        <div key={item.label} className="kv">
          <div className="kv-label">{item.label}</div>
          <div className={`kv-value ${item.muted ? "kv-muted" : ""}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
