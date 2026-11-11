/**
 * Diagnostics Component
 * API diagnostic tool for debugging
 *
 * Text interface: everything read from the node (paths, previews, JSON) is written
 * with textContent, never as HTML.
 */

import { AppState, Constants } from '../state.js?v=9aae65bfe0';
import { testWebSocket } from './websocket.js?v=9aae65bfe0';
import { fetchWithProxyFallback } from '../api/poolApi.js?v=9aae65bfe0';
import { Config } from '../config.js?v=9aae65bfe0';
import { el, button, note, shortAddress, copyWithFeedback, showDialog, hideDialog, layerRoot } from '../utils/dom.js?v=9aae65bfe0';
import { showError, showWarning } from '../utils/notifications.js?v=9aae65bfe0';

// Store last diagnostic results for download
let lastDiagnosticResults = null;

// A scan started later wins: an older one must not paint over it.
let scanSerial = 0;

/**
 * Server address typed in the form, for running the scan before connecting.
 * @returns {string|null}
 */
function baseUrlFromForm() {
    const raw = document.getElementById('serverHost')?.value?.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
        try { return new URL(raw).origin; } catch (e) { return null; }
    }
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${raw.replace(/\/+$/, '')}`;
}

/**
 * Open API diagnostic modal
 */
export async function openApiDiagnostic() {
    const modal = document.getElementById('apiDiagnosticModal');
    if (!modal) return;

    showDialog(modal);
    const resultsContainer = document.getElementById('apiDiagnosticResults');
    if (!resultsContainer) return;

    // Allow diagnostics even if not connected by using the server field
    let baseUrl = AppState.connection.apiBaseUrl;
    if (!baseUrl) {
        baseUrl = baseUrlFromForm();
        if (!baseUrl) {
            resultsContainer.replaceChildren(
                el('div', { className: 'diagnostic-error', text: 'Enter server host first.' })
            );
            return;
        }
    }

    const serial = ++scanSerial;
    resultsContainer.replaceChildren(
        el('div', { className: 'diagnostic-loading' }, [
            el('span', { className: 'loading-cursor', text: '█ ', attrs: { 'aria-hidden': 'true' } }),
            'Scanning API endpoints...'
        ])
    );

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
                // Read the body once: it may not be JSON.
                const text = await response.text();
                try {
                    responseData = JSON.parse(text);
                    dataPreview = getDataPreview(responseData);
                    allData[endpoint.path] = responseData;
                } catch (e) {
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

    if (serial !== scanSerial) return;

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
 * One endpoint of the list: a line that opens its details when it answered.
 */
function endpointItem(r) {
    const item = el('div', { className: 'endpoint-item ' + (r.ok ? 'available' : 'unavailable') });

    const headParts = [
        el('span', { className: 'endpoint-status', text: r.ok ? '✓' : '✗', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'sr', text: r.ok ? 'available: ' : 'not available: ' }),
        el('span', { className: 'endpoint-path', text: r.path }),
        el('span', { className: 'endpoint-desc', text: r.description }),
        !r.ok ? el('span', { className: 'endpoint-error', text: String(r.status) }) : null
    ];

    if (!r.ok) {
        item.appendChild(el('div', { className: 'endpoint-header' }, headParts));
        return item;
    }

    const details = el('div', { className: 'endpoint-details' });
    details.hidden = true;

    const header = el('button', {
        className: 'endpoint-header',
        attrs: { type: 'button', 'aria-expanded': 'false' },
        on: { click: () => toggleEndpointDetails(item) }
    }, headParts);

    const buttons = el('div', { className: 'endpoint-buttons' });
    const fullUrl = `${lastDiagnosticResults.serverUrl}${r.path}`;
    const copyBtn = button('copy url', () => copyWithFeedback(fullUrl, copyBtn), { className: 'copy-endpoint-btn' });
    buttons.appendChild(copyBtn);
    if (r.path !== '/api/ws') {
        buttons.appendChild(button('view data', () => viewEndpointData(r.path), { className: 'view-data-btn' }));
    }

    details.appendChild(el('div', { className: 'endpoint-preview', text: r.dataPreview || '' }));
    details.appendChild(buttons);

    item.appendChild(header);
    item.appendChild(details);
    return item;
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

    const parts = [];

    parts.push(el('div', { className: 'diagnostic-actions' }, [
        button('download full report', () => downloadDiagnosticReport(), { className: 'diagnostic-btn download-btn' }),
        button('view all data', () => viewAllDiagnosticData(), { className: 'diagnostic-btn' }),
        button('capture ws sample', () => captureWebSocketSample(), { className: 'diagnostic-btn' }),
        button('refresh', () => openApiDiagnostic(), { className: 'diagnostic-btn refresh-btn' })
    ]));

    parts.push(el('div', { className: 'diagnostic-summary' }, [
        el('span', { className: 'summary-stat available' }, [
            el('span', { className: 'stat-label', text: 'available ' }),
            el('span', { className: 'stat-number', text: String(available.length) })
        ]),
        el('span', { className: 'summary-sep', text: ' · ', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'summary-stat unavailable' }, [
            el('span', { className: 'stat-label', text: 'not found ' }),
            el('span', { className: 'stat-number', text: String(unavailable.length) })
        ])
    ]));

    if (sampleAddress) {
        parts.push(el('div', { className: 'diagnostic-note' }, [
            'Testing miner endpoints with: ',
            el('code', { text: shortAddress(sampleAddress, 10, 6), title: sampleAddress })
        ]));
    } else {
        parts.push(el('div', {
            className: 'diagnostic-note warning',
            text: 'No connected miners - miner-specific endpoints not tested'
        }));
    }

    categories.forEach(category => {
        const categoryResults = results.filter(r => r.category === category);
        if (categoryResults.length === 0) return;

        const categoryAvailable = categoryResults.filter(r => r.ok);

        parts.push(el('div', { className: 'diagnostic-section' }, [
            el('h4', {}, [
                `${category.toLowerCase()} endpoints `,
                el('span', { className: 'category-count', text: `(${categoryAvailable.length}/${categoryResults.length})` })
            ]),
            el('div', { className: 'endpoint-list' }, categoryResults.map(endpointItem))
        ]));
    });

    const summary = [
        ['/api/pool/stats', 'Main dashboard data (hashrate by algorithm, workers, shares)'],
        ['/api/pool/shares', 'Luck statistics (averageLuck field)'],
        ['/api/pool/workers', 'List of connected workers with individual hashrates'],
        ['/api/pool/blocks', 'Blocks found by the pool'],
        ['/api/miner/{address}/stats', 'Individual miner statistics'],
        ['/api/ws', 'Real-time updates via WebSocket']
    ];
    parts.push(el('div', { className: 'diagnostic-info' }, [
        el('h4', { text: 'api summary' }),
        el('ul', {}, summary.map(([path, what]) => el('li', {}, [
            el('strong', { text: path }),
            ' - ' + what
        ])))
    ]));

    container.replaceChildren(...parts);
}

/**
 * Download diagnostic report
 */
export function downloadDiagnosticReport() {
    if (!lastDiagnosticResults) {
        showWarning('No diagnostic data available. Please run the diagnostic first.');
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
 * @param {HTMLElement} element - Endpoint item (or anything inside it)
 */
export function toggleEndpointDetails(element) {
    const item = element?.closest ? (element.closest('.endpoint-item') || element) : element;
    const details = item?.querySelector('.endpoint-details');
    if (!details) return;
    details.hidden = !details.hidden;
    const header = item.querySelector('.endpoint-header');
    if (header && header.hasAttribute('aria-expanded')) {
        header.setAttribute('aria-expanded', details.hidden ? 'false' : 'true');
    }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export function copyToClipboard(text) {
    return copyWithFeedback(text, null);
}

// ---------------------
// Data window (raw answers of the node, as text)
// ---------------------

const dataViewOpeners = new WeakMap();

function closeDataView(dataModal) {
    if (!dataModal) return;
    const opener = dataViewOpeners.get(dataModal);
    dataModal.remove();
    if (opener && document.contains(opener) && typeof opener.focus === 'function') {
        try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
}

/**
 * Open a window with data shown as indented JSON text.
 * @param {string} title
 * @param {any} data
 */
function openDataView(title, data) {
    const dataModal = el('div', {
        className: 'data-view-modal',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title }
    });
    const closeBtn = button('close', () => closeDataView(dataModal), { className: 'dialog-close' });

    dataModal.appendChild(el('div', { className: 'data-view-content' }, [
        el('div', { className: 'data-view-header' }, [
            el('h3', { text: title }),
            closeBtn
        ]),
        // tabindex: the text can be scrolled with the keyboard
        el('pre', { className: 'data-view-json', text: JSON.stringify(data, null, 2), attrs: { tabindex: '0' } })
    ]));
    dataModal.addEventListener('click', (e) => {
        if (e.target === dataModal) closeDataView(dataModal);
    });

    const active = document.activeElement;
    if (active && active !== document.body) dataViewOpeners.set(dataModal, active);

    layerRoot().appendChild(dataModal);
    try { closeBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}

/**
 * View endpoint data in modal
 * @param {string} path - Endpoint path
 */
export async function viewEndpointData(path) {
    try {
        const baseUrl = AppState.connection.apiBaseUrl || lastDiagnosticResults?.serverUrl;
        if (!baseUrl) throw new Error('No server URL available');
        // Same road as the scan (through the proxy when the page needs it).
        const response = await fetchWithProxyFallback(path, { method: 'GET' }, baseUrl);
        const data = await response.json();
        openDataView(path, data);
    } catch (e) {
        showError('Error fetching data: ' + e.message);
    }
}

/**
 * View all diagnostic data in a single modal
 */
export function viewAllDiagnosticData() {
    if (!lastDiagnosticResults) {
        showWarning('No diagnostic data available. Please run the diagnostic first.');
        return;
    }
    const limitedData = JSON.parse(JSON.stringify(lastDiagnosticResults.fullData));
    if (limitedData['/api/pool/shares']?.shares && Array.isArray(limitedData['/api/pool/shares'].shares)) {
        limitedData['/api/pool/shares'].shares = limitedData['/api/pool/shares'].shares.slice(0, 1);
    }
    openDataView('all api responses', limitedData);
}

/**
 * Capture a sample WebSocket message and store it in diagnostics
 */
export async function captureWebSocketSample() {
    const baseUrl = AppState.connection.apiBaseUrl || lastDiagnosticResults?.serverUrl;
    if (!baseUrl) {
        showWarning('No server URL available. Please run the diagnostic first.');
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

            ws.onmessage = async (event) => {
                clearTimeout(timeout);
                ws.close();
                let payload = null;
                try {
                    let raw = event.data;
                    let text = null;
                    if (raw instanceof Blob) {
                        text = await raw.text();
                    } else if (raw instanceof ArrayBuffer) {
                        text = new TextDecoder().decode(raw);
                    } else {
                        text = raw;
                    }
                    payload = (typeof text === 'string' && text.length) ? JSON.parse(text) : text;
                } catch (err) {
                    payload = { _raw: event.data, _error: String(err) };
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

    openDataView('/api/ws (sample)', result);
}

/**
 * Close API diagnostic modal
 */
export function closeApiDiagnostic() {
    hideDialog(document.getElementById('apiDiagnosticModal'));
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

    // Escape closes the data window on top first, then the diagnostic itself.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const views = document.querySelectorAll('.data-view-modal');
        if (views.length > 0) {
            closeDataView(views[views.length - 1]);
            return;
        }
        const modal = document.getElementById('apiDiagnosticModal');
        if (modal && modal.style.display === 'flex') closeApiDiagnostic();
    });

    // A click outside the box closes the diagnostic.
    const modal = document.getElementById('apiDiagnosticModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeApiDiagnostic();
        });
    }
}
