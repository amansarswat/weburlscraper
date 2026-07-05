import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type ClientConfig } from '../api/client';
import type { UsageResponse } from '../types';
import { StatTile } from '../components/StatTile';
import { BarChart } from '../components/BarChart';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function Dashboard({ cfg }: { cfg: ClientConfig }) {
    const [usage, setUsage] = useState<UsageResponse['data'] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [auto, setAuto] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await api.getUsage(cfg);
            setUsage(res.data);
            setError(null);
        } catch (e) {
            const err = e as ApiError;
            setError(`${err.code ? `[${err.code}] ` : ''}${err.message}`);
        }
    }, [cfg]);

    useEffect(() => {
        load();
        if (!auto) return;
        const id = setInterval(load, 4000);
        return () => clearInterval(id);
    }, [load, auto]);

    const modeData = usage
        ? Object.entries(usage.byMode).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
        : [];

    return (
        <div className="content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Usage dashboard</h1>
                    <p className="page-sub">
                        {usage ? `Since ${new Date(usage.since).toLocaleString()}` : 'Live scrape activity'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <label className="checkbox"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh</label>
                    <button className="btn ghost" onClick={load}>Refresh</button>
                </div>
            </div>

            {error && <div className="banner error">{error}</div>}

            {usage && (
                <>
                    <div className="tiles">
                        <StatTile label="Requests" value={usage.totals.requests.toLocaleString()} />
                        <StatTile label="Success rate" value={pct(1 - usage.rates.errorRate)} tone={usage.rates.errorRate > 0.2 ? 'bad' : 'good'} sub={`${usage.totals.error} errors`} />
                        <StatTile label="Cache hit rate" value={pct(usage.rates.cacheHitRate)} sub={`${usage.totals.cached} hits`} />
                        <StatTile label="Avg duration" value={`${usage.rates.avgDurationMs} ms`} />
                        <StatTile label="Rendered" value={usage.totals.rendered.toLocaleString()} sub="JS-rendered" />
                        <StatTile label="Data extracted" value={fmtBytes(usage.totals.bytes)} />
                    </div>

                    <div className="card">
                        <div className="card-title">Requests by mode</div>
                        <BarChart data={modeData} empty="No scrapes recorded yet." />
                    </div>

                    <div className="card">
                        <div className="card-title">Top target domains</div>
                        <BarChart data={usage.topDomains} empty="No domains scraped yet." />
                    </div>

                    <div className="card">
                        <div className="card-title">Live queue</div>
                        <div className="tiles" style={{ marginBottom: 0 }}>
                            <StatTile label="Active" value={usage.queue.globalActive} sub={`limit ${usage.queue.limits.global}`} />
                            <StatTile label="Queued" value={usage.queue.queued} sub={`max ${usage.queue.limits.maxQueue}`} tone={usage.queue.queued > 0 ? 'bad' : undefined} />
                            <StatTile label="Busy domains" value={usage.queue.busyDomains} sub={`${usage.queue.limits.perDomain}/domain`} />
                            <StatTile label="Unique API keys" value={usage.uniqueApiKeys} />
                        </div>
                    </div>

                    {Object.keys(usage.byErrorCode).length > 0 && (
                        <div className="card">
                            <div className="card-title">Errors by code</div>
                            <BarChart data={Object.entries(usage.byErrorCode).map(([name, count]) => ({ name, count }))} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
