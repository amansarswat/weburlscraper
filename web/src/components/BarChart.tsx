// Single-series horizontal bar chart (dataviz mark spec: thin bars, 4px rounded
// ends anchored to baseline, direct value labels, one series hue, per-mark hover).

interface Datum {
    name: string;
    count: number;
}

export function BarChart({ data, empty = 'No data yet' }: { data: Datum[]; empty?: string }) {
    if (!data.length) return <div className="empty">{empty}</div>;
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
        <div className="bars">
            {data.map((d) => (
                <div className="bar-row" key={d.name}>
                    <span className="bar-name" title={d.name}>{d.name}</span>
                    <div className="bar-track">
                        <div
                            className="bar-fill"
                            style={{ width: `${Math.max((d.count / max) * 100, 2)}%` }}
                            title={`${d.name}: ${d.count}`}
                        />
                    </div>
                    <span className="bar-value">{d.count}</span>
                </div>
            ))}
        </div>
    );
}
