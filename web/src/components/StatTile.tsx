// Stat tile — the right "form" for a single magnitude (dataviz: not everything is
// a chart). Optional good/bad tone reserved for status semantics only.

export function StatTile({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: string | number;
    sub?: string;
    tone?: 'good' | 'bad';
}) {
    return (
        <div className="tile">
            <div className="tile-label">{label}</div>
            <div className={`tile-value tnum${tone ? ` ${tone}` : ''}`}>{value}</div>
            {sub && <div className="tile-sub">{sub}</div>}
        </div>
    );
}
