import { useState } from 'react';
import { api, ApiError, type ClientConfig } from '../api/client';
import type { CaptureResponse } from '../types';

export function Capture({ cfg }: { cfg: ClientConfig }) {
    const [url, setUrl] = useState('https://example.com');
    const [kind, setKind] = useState<'screenshot' | 'pdf'>('screenshot');
    const [fullPage, setFullPage] = useState(true);
    const [type, setType] = useState<'png' | 'jpeg'>('png');
    const [landscape, setLandscape] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CaptureResponse | null>(null);

    async function run() {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const body: Record<string, unknown> =
                kind === 'screenshot' ? { url, fullPage, type } : { url, landscape };
            const res = kind === 'screenshot' ? await api.screenshot(cfg, body) : await api.pdf(cfg, body);
            setResult(res);
        } catch (e) {
            const err = e as ApiError;
            setError(`${err.code ? `[${err.code}] ` : ''}${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    const dataUrl = result
        ? `data:${result.data.contentType};base64,${result.data.image || result.data.pdf}`
        : null;

    return (
        <div className="content">
            <h1 className="page-title">Screenshot &amp; PDF</h1>
            <p className="page-sub">Render a page with a headless browser and capture it.</p>

            <div className="card">
                <div className="row">
                    <div className="field" style={{ flex: 1 }}>
                        <span className="field-label">URL</span>
                        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
                    </div>
                    <div className="field" style={{ flex: '0 0 auto' }}>
                        <span className="field-label">Output</span>
                        <div className="toggle-view">
                            <button className={kind === 'screenshot' ? 'active' : ''} onClick={() => setKind('screenshot')}>Screenshot</button>
                            <button className={kind === 'pdf' ? 'active' : ''} onClick={() => setKind('pdf')}>PDF</button>
                        </div>
                    </div>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                    {kind === 'screenshot' ? (
                        <>
                            <label className="checkbox"><input type="checkbox" checked={fullPage} onChange={(e) => setFullPage(e.target.checked)} /> Full page</label>
                            <label className="checkbox">Format&nbsp;
                                <select className="input sm" value={type} onChange={(e) => setType(e.target.value as 'png' | 'jpeg')}>
                                    <option value="png">png</option>
                                    <option value="jpeg">jpeg</option>
                                </select>
                            </label>
                        </>
                    ) : (
                        <label className="checkbox"><input type="checkbox" checked={landscape} onChange={(e) => setLandscape(e.target.checked)} /> Landscape</label>
                    )}
                    <div className="grow" />
                    <button className="btn" onClick={run} disabled={loading || !url}>
                        {loading ? <span className="spinner" /> : `Capture ${kind}`}
                    </button>
                </div>
            </div>

            {error && <div className="banner error" style={{ marginTop: 16 }}>{error}</div>}

            {result && dataUrl && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div className="result-meta">
                        <span className="pill">{(result.data.bytes / 1024).toFixed(1)} KB</span>
                        <span className="pill">{result.performance.duration} ms</span>
                        <a className="btn ghost" href={dataUrl} download={kind === 'pdf' ? 'page.pdf' : `screenshot.${type}`}>Download</a>
                    </div>
                    {kind === 'screenshot' ? (
                        <img className="preview-img" src={dataUrl} alt="screenshot" />
                    ) : (
                        <iframe title="pdf" src={dataUrl} style={{ width: '100%', height: 600, border: '1px solid var(--border)', borderRadius: 9 }} />
                    )}
                </div>
            )}
        </div>
    );
}
