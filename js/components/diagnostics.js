/**
 * Diagnostics Component
 * API diagnostic tool for debugging
 */

import { AppState, Constants } from '../state.js';
import { testWebSocket } from './websocket.js';
import { fetchWithProxyFallback } from '../api/poolApi.js';
import { Config } from '../config.js';

// Store last diagnostic results for download
let lastDiagnosticResults = null;

/**
 * Open API diagnostic modal
 */
export async function openApiDiagnostic() {
    const modal = document.getElementById('apiDiagnosticModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    const resultsContainer = document.getElementById('apiDiagnosticResults');
    
    // Allow diagnostics even if not connected by using the input fields
    let baseUrl = AppState.connection.apiBaseUrl;
    if (!baseUrl) {
        const ipInput = document.getElementById('serverIp')?.value?.trim();
        const portInput = document.getElementById('serverPort')?.value?.trim();
        if (!ipInput || !portInput) {
            resultsContainer.innerHTML = '<div class="diagnostic-error">⚠️ Enter server IP and port first.</div>';
            return;
        }
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        baseUrl = `${protocol}://${ipInput}:${portInput}`;
    }
    
    resultsContainer.innerHTML = '<div class="diagnostic-loading">🔍 Scanning API endpoints...</div>';
    
    // Get a sample address
    const sampleAddress = AppState.cache.workers.length > 0 ? AppState.cache.workers[0].address : null;
    
    // Endpoints to test
    const endpointsToTest = [
        { path: '/health', description: 'Health check', category: 'System' },
        { path: '/api/pool/stats', description: 'Pool overview with hashrate, workers, shares', category: 'Pool' },
        { path: '/api/pool/blocks', description: 'Blocks found by this node', category: 'Pool' },
        { path: '/api/pool/workers', description: 'All connected workers', category: 'Pool' },
        { path: '/api/pool/shares', description: 'Share history with luck stats', category: 'Pool' },
        { path: '/api/stats', description: 'Standard pool stats format', category: 'Standard' },
        { path: '/api/miners', description: 'All miners list', category: 'Standard' },
        { path: '/api/blocks', description: 'Block history', category: 'Standard' },
        ...(sampleAddress ? [
            { path: `/api/miner/${sampleAddress}/stats`, description: 'Stats for a specific address', category: 'Miner' },
            { path: `/api/miner/${sampleAddress}/workers`, description: 'Workers for an address', category: 'Miner' },
        ] : []),
    ];
    
    const results = [];
    const allData = {};
    
    for (const endpoint of endpointsToTest) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetchWithProxyFallback(endpoint.path, {
                signal: controller.signal,
                method: 'GET'
            }, baseUrl);
            clearTimeout(timeoutId);
            
            let responseData = null;
            let dataPreview = '';
            
            if (response.ok) {
                try {
                    responseData = await response.json();
                    dataPreview = getDataPreview(responseData);
                    allData[endpoint.path] = responseData;
                } catch (e) {
                    const text = await response.text();
                    dataPreview = '(non-JSON response)';
                    allData[endpoint.path] = { _raw: text };
                }
            }
            
            results.push({
                path: endpoint.path,
                description: endpoint.description,
                category: endpoint.category,
                status: response.status,
                ok: response.ok,
                dataPreview: dataPreview,
                data: responseData
            });
        } catch (e) {
            results.push({
                path: endpoint.path,
                description: endpoint.description,
                category: endpoint.category,
                status: e.name === 'AbortError' ? 'Timeout' : 'Error',
                ok: false,
                error: e.message
            });
        }
    }
    
    // Test WebSocket
    const wsResult = await testWebSocket();
    results.push(wsResult);
    
    // Store for download
    lastDiagnosticResults = {
        timestamp: new Date().toISOString(),
        serverUrl: baseUrl,
        sampleAddress: sampleAddress,
        endpoints: results,
        fullData: allData
    };
    
    // Render results
    renderDiagnosticResults(resultsContainer, results, sampleAddress);
}

/**
 * Get data preview string
 * @param {any} data - Data to preview
 * @returns {string} Preview string
 */
function getDataPreview(data) {
    if (data === null || data === undefined) return 'null';
    if (Array.isArray(data)) {
        return `Array[${data.length}] ${data.length > 0 ? '{ ' + Object.keys(data[0] || {}).slice(0, 5).join(', ') + (Object.keys(data[0] || {}).length > 5 ? '...' : '') + ' }' : ''}`;
    }
    if (typeof data === 'object') {
        const keys = Object.keys(data);
        return `{ ${keys.slice(0, 6).join(', ')}${keys.length > 6 ? '...' : ''} }`;
    }
    return String(data).substring(0, 50);
}

/**
 * Render diagnostic results
 * @param {HTMLElement} container - Container element
 * @param {Array} results - Results array
 * @param {string|null} sampleAddress - Sample address used
 */
function renderDiagnosticResults(container, results, sampleAddress) {
    const available = results.filter(r => r.ok);
    const unavailable = results.filter(r => !r.ok);
    
    const categories = ['System', 'Pool', 'Standard', 'Miner', 'Real-time'];
    
    let html = `
        <div class="diagnostic-actions">
            <button class="diagnostic-btn download-btn" onclick="window.downloadDiagnosticReport()">
                📥 Download Full Report
            </button>
            <button class="diagnostic-btn refresh-btn" onclick="window.viewAllDiagnosticData()">
                📄 View All Data
            </button>
            <button class="diagnostic-btn refresh-btn" onclick="window.captureWebSocketSample()">
                ⚡ Capture WS Sample
            </button>
            <button class="diagnostic-btn refresh-btn" onclick="window.openApiDiagnostic()">
                🔄 Refresh
            </button>
        </div>
        <div class="diagnostic-summary">
            <div class="summary-stat available">
                <span class="stat-number">${available.length}</span>
                <span class="stat-label">Available</span>
            </div>
            <div class="summary-stat unavailable">
                <span class="stat-number">${unavailable.length}</span>
                <span class="stat-label">Not Found</span>
            </div>
        </div>
        ${sampleAddress ? `<div class="diagnostic-note">📝 Testing miner endpoints with: <code>${sampleAddress.substring(0, 10)}...${sampleAddress.slice(-6)}</code></div>` : '<div class="diagnostic-note warning">⚠️ No connected miners - miner-specific endpoints not tested</div>'}
    `;
    
    categories.forEach(category => {
        const categoryResults = results.filter(r => r.category === category);
        if (categoryResults.length === 0) return;
        
        const categoryAvailable = categoryResults.filter(r => r.ok);
        const categoryIcon = category === 'System' ? '🔧' : 
                            category === 'Pool' ? '🏊' : 
                            category === 'Standard' ? '📊' : 
                            category === 'Miner' ? '⛏️' : '⚡';
        
        html += `
            <div class="diagnostic-section">
                <h4>${categoryIcon} ${category} Endpoints <span class="category-count">(${categoryAvailable.length}/${categoryResults.length})</span></h4>
                <div class="endpoint-list">
        `;
        
        categoryResults.forEach(r => {
            const statusClass = r.ok ? 'available' : 'unavailable';
            const statusIcon = r.ok ? '✓' : '✗';
            
            html += `
                <div class="endpoint-item ${statusClass}" onclick="window.toggleEndpointDetails(this)">
                    <div class="endpoint-header">
                        <span class="endpoint-status">${statusIcon}</span>
                        <span class="endpoint-path">${r.path}</span>
                        <span class="endpoint-desc">${r.description}</span>
                        ${!r.ok ? `<span class="endpoint-error">${r.status}</span>` : ''}
                    </div>
                    ${r.ok ? `
                    <div class="endpoint-details" style="display: none;">
                        <div class="endpoint-preview">${r.dataPreview || ''}</div>
                        <div class="endpoint-buttons">
                            <button class="copy-endpoint-btn" onclick="event.stopPropagation(); window.copyToClipboard('${lastDiagnosticResults.serverUrl}${r.path}')">📋 Copy URL</button>
                            ${r.path !== '/api/ws' ? `<button class="view-data-btn" onclick="event.stopPropagation(); window.viewEndpointData('${r.path}')">👁️ View Data</button>` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += `
        <div class="diagnostic-info">
            <strong>📋 API Summary</strong><br>
            <ul>
                <li><strong>/api/pool/stats</strong> - Main dashboard data (hashrate by algorithm, workers, shares)</li>
                <li><strong>/api/pool/shares</strong> - Luck statistics (averageLuck field)</li>
                <li><strong>/api/pool/workers</strong> - List of connected workers with individual hashrates</li>
                <li><strong>/api/pool/blocks</strong> - Blocks found by the pool</li>
                <li><strong>/api/miner/{address}/stats</strong> - Individual miner statistics</li>
                <li><strong>/api/ws</strong> - Real-time updates via WebSocket</li>
            </ul>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Download diagnostic report
 */
export function downloadDiagnosticReport() {
    if (!lastDiagnosticResults) {
        alert('No diagnostic data available. Please run the diagnostic first.');
        return;
    }
    
    let report = `========================================
QUAI MINING NODE - API DIAGNOSTIC REPORT
========================================
Generated: ${lastDiagnosticResults.timestamp}
Server URL: ${lastDiagnosticResults.serverUrl}
Sample Miner Address: ${lastDiagnosticResults.sampleAddress || 'None available'}

`;

    const available = lastDiagnosticResults.endpoints.filter(e => e.ok);
    const unavailable = lastDiagnosticResults.endpoints.filter(e => !e.ok);
    
    report += `SUMMARY
--------
Available Endpoints: ${available.length}
Unavailable Endpoints: ${unavailable.length}

`;

    report += `AVAILABLE ENDPOINTS
-------------------
`;
    available.forEach(e => {
        report += `✓ ${e.path}
  Category: ${e.category}
  Description: ${e.description}
  Preview: ${e.dataPreview || 'N/A'}

`;
    });

    report += `
UNAVAILABLE ENDPOINTS
---------------------
`;
    unavailable.forEach(e => {
        report += `✗ ${e.path}
  Category: ${e.category}
  Description: ${e.description}
  Status: ${e.status}

`;
    });

    report += `
========================================
FULL API RESPONSES
========================================

`;

    Object.keys(lastDiagnosticResults.fullData).forEach(path => {
        report += `
----------------------------------------
${path}
----------------------------------------
${JSON.stringify(lastDiagnosticResults.fullData[path], null, 2)}

`;
    });

    report += `
========================================
END OF REPORT
========================================
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-diagnostic-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Toggle endpoint details
 * @param {HTMLElement} element - Element clicked
 */
export function toggleEndpointDetails(element) {
    const details = element.querySelector('.endpoint-details');
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show feedback
    });
}

/**
 * View endpoint data in modal
 * @param {string} path - Endpoint path
 */
export async function viewEndpointData(path) {
    try {
        const baseUrl = AppState.connection.apiBaseUrl || lastDiagnosticResults?.serverUrl;
        if (!baseUrl) throw new Error('No server URL available');
        const response = await fetch(`${baseUrl}${path}`);
        const data = await response.json();
        
        const dataModal = document.createElement('div');
        dataModal.className = 'data-view-modal';
        dataModal.innerHTML = `
            <div class="data-view-content">
                <div class="data-view-header">
                    <h3>📄 ${path}</h3>
                    <button onclick="this.closest('.data-view-modal').remove()">✕</button>
                </div>
                <pre class="data-view-json">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
        dataModal.onclick = (e) => {
            if (e.target === dataModal) dataModal.remove();
        };
        document.body.appendChild(dataModal);
    } catch (e) {
        alert('Error fetching data: ' + e.message);
    }
}

/**
 * View all diagnostic data in a single modal
 */
export function viewAllDiagnosticData() {
    if (!lastDiagnosticResults) {
        alert('No diagnostic data available. Please run the diagnostic first.');
        return;
    }
    const limitedData = JSON.parse(JSON.stringify(lastDiagnosticResults.fullData));
    if (limitedData['/api/pool/shares']?.shares && Array.isArray(limitedData['/api/pool/shares'].shares)) {
        limitedData['/api/pool/shares'].shares = limitedData['/api/pool/shares'].shares.slice(0, 1);
    }
    const dataModal = document.createElement('div');
    dataModal.className = 'data-view-modal';
    dataModal.innerHTML = `
        <div class="data-view-content">
            <div class="data-view-header">
                <h3>📄 All API Responses</h3>
                <button onclick="this.closest('.data-view-modal').remove()">✕</button>
            </div>
            <pre class="data-view-json">${JSON.stringify(limitedData, null, 2)}</pre>
        </div>
    `;
    dataModal.onclick = (e) => {
        if (e.target === dataModal) dataModal.remove();
    };
    document.body.appendChild(dataModal);
}

/**
 * Capture a sample WebSocket message and store it in diagnostics
 */
export async function captureWebSocketSample() {
    const baseUrl = AppState.connection.apiBaseUrl || lastDiagnosticResults?.serverUrl;
    if (!baseUrl) {
        alert('No server URL available. Please run the diagnostic first.');
        return;
    }

    // Build backend WS URLs:
    // - direct: mirror http->ws (https -> wss)
    // - proxyBackend: force non-TLS ws: scheme so proxy connects to upstream without TLS
    const backendWsUrlDirect = baseUrl.replace(/^http/, 'ws') + '/api/ws';
    const backendWsUrlProxy = baseUrl.replace(/^https?:/, 'ws:') + '/api/ws';
    let wsUrl = backendWsUrlDirect;
    if (AppState.connection.useProxy && Config.proxy && Config.proxy.base && Config.proxy.wsEndpoint) {
        const proxyWsBase = Config.proxy.base.replace(/^https?:/, baseUrl.startsWith('https') ? 'wss:' : 'ws:');
        wsUrl = `${proxyWsBase}${Config.proxy.wsEndpoint}${encodeURIComponent(backendWsUrlProxy)}`;
    }

    const result = await new Promise((resolve) => {
        try {
            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => {
                ws.close();
                resolve({
                    ok: false,
                    error: 'Timeout waiting for message',
                    _meta: { url: wsUrl, timestamp: new Date().toISOString() }
                });
            }, 5000);

            ws.onmessage = (event) => {
                clearTimeout(timeout);
                ws.close();
                let payload = null;
                try {
                    payload = JSON.parse(event.data);
                } catch {
                    payload = { _raw: event.data };
                }
                resolve({
                    ok: true,
                    message: payload,
                    _meta: { url: wsUrl, timestamp: new Date().toISOString() }
                });
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                resolve({
                    ok: false,
                    error: 'WebSocket error',
                    _meta: { url: wsUrl, timestamp: new Date().toISOString() }
                });
            };
        } catch (e) {
            resolve({
                ok: false,
                error: e.message,
                _meta: { url: wsUrl, timestamp: new Date().toISOString() }
            });
        }
    });

    if (!lastDiagnosticResults) {
        lastDiagnosticResults = {
            timestamp: new Date().toISOString(),
            serverUrl: baseUrl,
            sampleAddress: null,
            endpoints: [],
            fullData: {}
        };
    }

    lastDiagnosticResults.fullData['/api/ws'] = result;

    const dataModal = document.createElement('div');
    dataModal.className = 'data-view-modal';
    dataModal.innerHTML = `
        <div class="data-view-content">
            <div class="data-view-header">
                <h3>📄 /api/ws (sample)</h3>
                <button onclick="this.closest('.data-view-modal').remove()">✕</button>
            </div>
            <pre class="data-view-json">${JSON.stringify(result, null, 2)}</pre>
        </div>
    `;
    dataModal.onclick = (e) => {
        if (e.target === dataModal) dataModal.remove();
    };
    document.body.appendChild(dataModal);
}

/**
 * Close API diagnostic modal
 */
export function closeApiDiagnostic() {
    const modal = document.getElementById('apiDiagnosticModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Initialize diagnostic global functions
 */
export function initDiagnosticGlobals() {
    window.openApiDiagnostic = openApiDiagnostic;
    window.closeApiDiagnostic = closeApiDiagnostic;
    window.downloadDiagnosticReport = downloadDiagnosticReport;
    window.toggleEndpointDetails = toggleEndpointDetails;
    window.copyToClipboard = copyToClipboard;
    window.viewEndpointData = viewEndpointData;
    window.viewAllDiagnosticData = viewAllDiagnosticData;
    window.captureWebSocketSample = captureWebSocketSample;
}
