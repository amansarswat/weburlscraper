import { useEffect, useState } from 'react';
import { api, type ClientConfig } from './api/client';
import { Playground } from './views/Playground';
import { Capture } from './views/Capture';
import { Dashboard } from './views/Dashboard';

type Tab = 'playground' | 'capture' | 'dashboard';

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'playground', label: 'Playground', icon: '🧭' },
    { id: 'capture', label: 'Screenshot / PDF', icon: '📸' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
];

function usePersisted(key: string, initial: string): [string, (v: string) => void] {
    const [value, setValue] = useState(() => localStorage.getItem(key) ?? initial);
    useEffect(() => {
        localStorage.setItem(key, value);
    }, [key, value]);
    return [value, setValue];
}

export default function App() {
    const [tab, setTab] = useState<Tab>('playground');
    // '' base = same origin (dev proxy). Users can point at a remote instance.
    const [baseUrl, setBaseUrl] = usePersisted('scraper.baseUrl', '');
    const [apiKey, setApiKey] = usePersisted('scraper.apiKey', '');
    const [online, setOnline] = useState<boolean | null>(null);
    const [version, setVersion] = useState<string>('');

    const cfg: ClientConfig = { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };

    useEffect(() => {
        let cancelled = false;
        api.health(cfg)
            .then((h) => {
                if (cancelled) return;
                setOnline(true);
                setVersion(h.version);
            })
            .catch(() => !cancelled && setOnline(false));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseUrl, apiKey]);

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="brand">
                    <span className="brand-logo">🕸️</span>
                    <div>
                        <div className="brand-name">URL Scraper</div>
                        <div className="brand-sub">Console</div>
                    </div>
                </div>
                {TABS.map((t) => (
                    <button key={t.id} className={`nav-item${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                        <span>{t.icon}</span>
                        <span className="label">{t.label}</span>
                    </button>
                ))}
                <div className="nav-spacer" />
                <a className="nav-item" href={`${cfg.baseUrl}/api/docs`} target="_blank" rel="noreferrer">
                    <span>📚</span>
                    <span className="label">API docs</span>
                </a>
            </aside>

            <div className="main">
                <div className="topbar">
                    <span className={`status-dot ${online === null ? '' : online ? 'ok' : 'bad'}`} />
                    <span className="pill">{online === null ? 'connecting…' : online ? `online · v${version}` : 'offline'}</span>
                    <div className="grow" />
                    <label>API base</label>
                    <input className="input sm" style={{ width: 200 }} value={baseUrl} placeholder="(same origin)" onChange={(e) => setBaseUrl(e.target.value)} />
                    <label>API key</label>
                    <input className="input sm" style={{ width: 150 }} type="password" value={apiKey} placeholder="(none)" onChange={(e) => setApiKey(e.target.value)} />
                </div>

                {tab === 'playground' && <Playground cfg={cfg} />}
                {tab === 'capture' && <Capture cfg={cfg} />}
                {tab === 'dashboard' && <Dashboard cfg={cfg} />}
            </div>
        </div>
    );
}
