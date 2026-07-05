import { useEffect, useState } from 'react';
import { api, ApiError, type ClientConfig } from '../api/client';
import type { ContentItem, ModeInfo, ScrapeResponse } from '../types';

function ResultItem({ item }: { item: ContentItem }) {
    const type = item.type || 'item';
    return (
        <div className="item">
            <div className="item-type">{type}</div>
            {item.heading && <h4>{item.heading}</h4>}
            {item.title && !item.heading && <h4>{item.title}</h4>}
            {item.paragraph && <p>{item.paragraph}</p>}
            {item.content && !item.paragraph && <p>{item.content}</p>}
            {item.text && <p>{item.text}</p>}
            {item.items && (
                <ul>
                    {item.items.map((li, i) => (
                        <li key={i}>{li}</li>
                    ))}
                </ul>
            )}
            {item.headers && item.rows && (
                <div className="scroll-x">
                    <table className="tbl">
                        {item.headers.length > 0 && (
                            <thead>
                                <tr>
                                    {item.headers.map((h, i) => (
                                        <th key={i}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody>
                            {item.rows.map((row, i) => (
                                <tr key={i}>
                                    {row.map((c, j) => (
                                        <td key={j}>{c}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export function Playground({ cfg }: { cfg: ClientConfig }) {
    const [url, setUrl] = useState('https://example.com');
    const [mode, setMode] = useState('headings-paragraphs');
    const [selector, setSelector] = useState('');
    const [render, setRender] = useState(false);
    const [modes, setModes] = useState<ModeInfo[]>([]);
    const [renderAvailable, setRenderAvailable] = useState(true);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScrapeResponse | null>(null);
    const [view, setView] = useState<'rendered' | 'json'>('rendered');

    useEffect(() => {
        api.getModes(cfg)
            .then((r) => {
                setModes(r.data.modes);
                setRenderAvailable(r.data.renderingAvailable);
            })
            .catch(() => {/* modes are optional */});
    }, [cfg]);

    async function run() {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const body: Record<string, unknown> = { url, mode, render };
            if (mode === 'custom') body.options = { selector };
            const res = await api.scrape(cfg, body);
            setResult(res);
        } catch (e) {
            const err = e as ApiError;
            setError(`${err.code ? `[${err.code}] ` : ''}${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="content">
            <h1 className="page-title">Scrape playground</h1>
            <p className="page-sub">Extract structured content from any page.</p>

            <div className="card">
                <div className="field">
                    <span className="field-label">URL</span>
                    <input
                        className="input"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        onKeyDown={(e) => e.key === 'Enter' && run()}
                    />
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                    <div className="field">
                        <span className="field-label">Mode</span>
                        <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
                            {modes.length
                                ? modes.map((m) => (
                                      <option key={m.name} value={m.name}>
                                          {m.name}
                                      </option>
                                  ))
                                : <option value="headings-paragraphs">headings-paragraphs</option>}
                        </select>
                    </div>
                    {mode === 'custom' && (
                        <div className="field">
                            <span className="field-label">CSS selector</span>
                            <input className="input" value={selector} onChange={(e) => setSelector(e.target.value)} placeholder=".article p" />
                        </div>
                    )}
                    <div className="field" style={{ flex: '0 0 auto' }}>
                        <span className="field-label">Options</span>
                        <label className="checkbox" title={renderAvailable ? '' : 'Rendering unavailable on this server'}>
                            <input type="checkbox" checked={render} disabled={!renderAvailable} onChange={(e) => setRender(e.target.checked)} />
                            Render JS
                        </label>
                    </div>
                    <button className="btn" onClick={run} disabled={loading || !url}>
                        {loading ? <span className="spinner" /> : 'Scrape'}
                    </button>
                </div>
            </div>

            {error && <div className="banner error" style={{ marginTop: 16 }}>{error}</div>}

            {result && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="card-title" style={{ margin: 0 }}>{result.data.title}</div>
                        <div className="toggle-view">
                            <button className={view === 'rendered' ? 'active' : ''} onClick={() => setView('rendered')}>Rendered</button>
                            <button className={view === 'json' ? 'active' : ''} onClick={() => setView('json')}>JSON</button>
                        </div>
                    </div>
                    <div className="result-meta">
                        <span className="pill">{result.data.metadata.totalItems} items</span>
                        <span className="pill">{result.performance.duration} ms</span>
                        <span className="pill">{result.cached ? 'cached' : 'fresh'}</span>
                        <span className="pill">{result.data.metadata.rendered ? 'rendered' : 'static'}</span>
                    </div>
                    {view === 'rendered' ? (
                        <div className="result-list">
                            {result.data.content.length === 0 && <div className="empty">No content matched this mode.</div>}
                            {result.data.content.map((item, i) => (
                                <ResultItem key={i} item={item} />
                            ))}
                        </div>
                    ) : (
                        <div className="json">{JSON.stringify(result.data, null, 2)}</div>
                    )}
                </div>
            )}
        </div>
    );
}
