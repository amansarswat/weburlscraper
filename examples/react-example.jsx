/**
 * React Component Example for URL Scraper API
 * Complete React implementation with hooks
 */

import React, { useState, useEffect } from 'react';

// Custom hook for URL scraping
const useUrlScraper = (apiUrl = 'http://localhost:3000/api') => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [history, setHistory] = useState([]);

    const scrapeUrl = async (url, mode = 'headings-paragraphs', options = {}) => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${apiUrl}/scrape`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, mode, options })
            });
            
            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
                setHistory(prev => [
                    { url, mode, result: result.data, timestamp: new Date() },
                    ...prev.slice(0, 9) // Keep last 10 results
                ]);
            } else {
                setError(result.error || 'Scraping failed');
            }
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    const batchScrape = async (urls, mode = 'headings-paragraphs', options = {}) => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${apiUrl}/scrape/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ urls, mode, options })
            });
            
            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
                setHistory(prev => [
                    { urls, mode, result: result.data, timestamp: new Date(), batch: true },
                    ...prev.slice(0, 9)
                ]);
            } else {
                setError(result.error || 'Batch scraping failed');
            }
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    const clearHistory = () => setHistory([]);
    const clearData = () => {
        setData(null);
        setError(null);
    };

    return {
        scrapeUrl,
        batchScrape,
        loading,
        error,
        data,
        history,
        clearHistory,
        clearData
    };
};

// Main URL Scraper Component
const UrlScraperApp = () => {
    const [url, setUrl] = useState('');
    const [urls, setUrls] = useState(['']);
    const [mode, setMode] = useState('headings-paragraphs');
    const [customSelector, setCustomSelector] = useState('');
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [availableModes, setAvailableModes] = useState([]);

    const {
        scrapeUrl,
        batchScrape,
        loading,
        error,
        data,
        history,
        clearHistory,
        clearData
    } = useUrlScraper();

    // Fetch available modes on component mount
    useEffect(() => {
        fetch('http://localhost:3000/api/modes')
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    setAvailableModes(result.data.modes);
                }
            })
            .catch(console.error);
    }, []);

    const handleSingleSubmit = (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        
        const options = mode === 'custom' ? { selector: customSelector } : {};
        scrapeUrl(url, mode, options);
    };

    const handleBatchSubmit = (e) => {
        e.preventDefault();
        const validUrls = urls.filter(u => u.trim());
        if (validUrls.length === 0) return;
        
        const options = mode === 'custom' ? { selector: customSelector } : {};
        batchScrape(validUrls, mode, options);
    };

    const addBatchUrl = () => {
        setUrls([...urls, '']);
    };

    const removeBatchUrl = (index) => {
        setUrls(urls.filter((_, i) => i !== index));
    };

    const updateBatchUrl = (index, value) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            <h1>🔍 URL Scraper</h1>
            <p>Extract content from web pages using various scraping modes</p>

            {/* Mode Toggle */}
            <div style={{ marginBottom: '20px' }}>
                <label>
                    <input
                        type="radio"
                        checked={!isBatchMode}
                        onChange={() => setIsBatchMode(false)}
                    />
                    Single URL
                </label>
                <label style={{ marginLeft: '20px' }}>
                    <input
                        type="radio"
                        checked={isBatchMode}
                        onChange={() => setIsBatchMode(true)}
                    />
                    Batch URLs
                </label>
            </div>

            {/* Scraping Form */}
            <form onSubmit={isBatchMode ? handleBatchSubmit : handleSingleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label>
                        <strong>Scraping Mode:</strong>
                        <select 
                            value={mode} 
                            onChange={(e) => setMode(e.target.value)}
                            style={{ marginLeft: '10px', padding: '5px' }}
                        >
                            {availableModes.map(m => (
                                <option key={m.name} value={m.name}>
                                    {m.name} {m.default && '(default)'}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {/* Custom Selector Input */}
                {mode === 'custom' && (
                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <strong>CSS Selector:</strong>
                            <input
                                type="text"
                                value={customSelector}
                                onChange={(e) => setCustomSelector(e.target.value)}
                                placeholder="e.g., .article-content p"
                                style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
                                required
                            />
                        </label>
                    </div>
                )}

                {/* Single URL Input */}
                {!isBatchMode && (
                    <div style={{ marginBottom: '15px' }}>
                        <label>
                            <strong>URL:</strong>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                style={{ marginLeft: '10px', padding: '8px', width: '400px' }}
                                required
                            />
                        </label>
                    </div>
                )}

                {/* Batch URL Inputs */}
                {isBatchMode && (
                    <div style={{ marginBottom: '15px' }}>
                        <strong>URLs (max 5):</strong>
                        {urls.map((url, index) => (
                            <div key={index} style={{ marginTop: '8px' }}>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => updateBatchUrl(index, e.target.value)}
                                    placeholder={`URL ${index + 1}`}
                                    style={{ padding: '8px', width: '400px' }}
                                />
                                {urls.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeBatchUrl(index)}
                                        style={{ marginLeft: '10px', padding: '5px 10px' }}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        {urls.length < 5 && (
                            <button
                                type="button"
                                onClick={addBatchUrl}
                                style={{ marginTop: '10px', padding: '5px 10px' }}
                            >
                                Add URL
                            </button>
                        )}
                    </div>
                )}

                <div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{ 
                            padding: '10px 20px', 
                            backgroundColor: loading ? '#ccc' : '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? '🔄 Scraping...' : '🚀 Scrape Content'}
                    </button>
                    
                    {data && (
                        <button 
                            type="button"
                            onClick={clearData}
                            style={{ 
                                marginLeft: '10px',
                                padding: '10px 20px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear Results
                        </button>
                    )}
                </div>
            </form>

            {/* Error Display */}
            {error && (
                <div style={{ 
                    marginTop: '20px', 
                    padding: '15px', 
                    backgroundColor: '#f8d7da', 
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    color: '#721c24'
                }}>
                    <strong>❌ Error:</strong> {error}
                </div>
            )}

            {/* Results Display */}
            {data && (
                <div style={{ marginTop: '30px' }}>
                    <h2>📄 Results</h2>
                    
                    {/* Single URL Results */}
                    {!Array.isArray(data) && (
                        <div>
                            <h3>{data.title}</h3>
                            <p><strong>URL:</strong> {data.url}</p>
                            <p><strong>Description:</strong> {data.description}</p>
                            <p><strong>Items Found:</strong> {data.content.length}</p>
                            
                            <div style={{ marginTop: '20px' }}>
                                <h4>Content:</h4>
                                {data.content.map((item, index) => (
                                    <div 
                                        key={index}
                                        style={{ 
                                            marginBottom: '15px', 
                                            padding: '15px', 
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            backgroundColor: '#f9f9f9'
                                        }}
                                    >
                                        {item.type === 'heading-paragraph' && (
                                            <>
                                                <h5 style={{ color: '#007bff' }}>{item.heading}</h5>
                                                <p>{item.paragraph}</p>
                                            </>
                                        )}
                                        {item.type === 'article' && (
                                            <>
                                                <h5 style={{ color: '#28a745' }}>{item.title}</h5>
                                                <p>{item.content}</p>
                                            </>
                                        )}
                                        {item.type === 'unordered-list' && (
                                            <>
                                                <h6 style={{ color: '#ffc107' }}>List ({item.count} items)</h6>
                                                <ul>
                                                    {item.items.map((listItem, i) => (
                                                        <li key={i}>{listItem}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                        {item.type === 'table' && (
                                            <>
                                                <h6 style={{ color: '#17a2b8' }}>Table ({item.rowCount} rows)</h6>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    {item.headers.length > 0 && (
                                                        <thead>
                                                            <tr>
                                                                {item.headers.map((header, i) => (
                                                                    <th key={i} style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                                        {header}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                    )}
                                                    <tbody>
                                                        {item.rows.map((row, i) => (
                                                            <tr key={i}>
                                                                {row.map((cell, j) => (
                                                                    <td key={j} style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                                        {cell}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </>
                                        )}
                                        {(item.text || item.content) && !['heading-paragraph', 'article', 'unordered-list', 'table'].includes(item.type) && (
                                            <p><strong>{item.type}:</strong> {item.text || item.content}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Batch Results */}
                    {Array.isArray(data) && (
                        <div>
                            <h3>Batch Results</h3>
                            {data.map((result, index) => (
                                <div 
                                    key={index}
                                    style={{ 
                                        marginBottom: '20px', 
                                        padding: '15px', 
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: result.success ? '#d4edda' : '#f8d7da'
                                    }}
                                >
                                    <h4>{result.success ? '✅' : '❌'} {result.url}</h4>
                                    {result.success ? (
                                        <p>Found {result.data.content.length} items</p>
                                    ) : (
                                        <p>Error: {result.error}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* History */}
            {history.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>📚 History</h3>
                        <button 
                            onClick={clearHistory}
                            style={{ 
                                padding: '5px 10px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear History
                        </button>
                    </div>
                    
                    {history.map((item, index) => (
                        <div 
                            key={index}
                            style={{ 
                                marginTop: '10px',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                backgroundColor: '#f8f9fa'
                            }}
                        >
                            <small>
                                <strong>{item.timestamp.toLocaleString()}</strong> - 
                                Mode: {item.mode} - 
                                {item.batch ? `Batch (${item.urls.length} URLs)` : item.url}
                            </small>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UrlScraperApp;
