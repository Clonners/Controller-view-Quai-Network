/**
 * WebSocket Module
 * Handles real-time updates via WebSocket connection
 */

import { AppState } from '../state.js';
import { Config } from '../config.js';

let wsReconnectTimeout = null;

export function closeWebSocket() {
    try {
        if (AppState.connection.wsConnection) {
            try { AppState.connection.wsConnection.close(); } catch (e) {}
            AppState.connection.wsConnection = null;
        }
        if (wsReconnectTimeout) {
            clearTimeout(wsReconnectTimeout);
            wsReconnectTimeout = null;
        }
        const indicator = document.getElementById('wsIndicator');
        if (indicator) indicator.style.display = 'none';
    } catch (e) {
        console.warn('Error closing websocket:', e);
    }
}

export function initWebSocket() {
    if (!AppState.connection.apiBaseUrl) return;
    closeWebSocket();

    const backendWsUrl = AppState.connection.apiBaseUrl.replace(/^https?:/, 'ws:') + '/api/ws';
    let triedProxy = false;
    // build proxy URL if configured. If wsEndpoint is not set but proxy base exists,
    // assume default '/?target=' which is supported by `proxy-deploy/node-proxy.js`.
    let proxyUrl = null;
    if (Config.proxy && Config.proxy.base) {
        const proxyWsBase = Config.proxy.base.replace(/^https?:/, AppState.connection.apiBaseUrl.startsWith('https') ? 'wss:' : 'ws:');
        const endpoint = (Config.proxy.wsEndpoint || '/?target=');
        proxyUrl = `${proxyWsBase}${endpoint}${encodeURIComponent(backendWsUrl)}`;
    }

    function openWs(url, isProxy = false) {
        try {
            const ws = new WebSocket(url);
            AppState.connection.wsConnection = ws;

            ws.onopen = () => {
                console.info('WebSocket connected', isProxy ? '(via proxy)' : '(direct)');
                updateWSIndicator(true);
            };

            ws.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    handleWSMessage(data);
                } catch (e) {
                    console.warn('WS parse error', e);
                }
            };

            ws.onerror = (err) => {
                console.warn('WebSocket error', err);
                updateWSIndicator(false);
                // If direct attempt failed asynchronously, try proxy fallback
                if (!isProxy && !triedProxy && proxyUrl) {
                    triedProxy = true;
                    try { ws.close(); } catch (e) {}
                    openWs(proxyUrl, true);
                }
            };

            ws.onclose = () => {
                updateWSIndicator(false);
                // If closed and we haven't tried proxy yet, try proxy fallback
                if (!isProxy && !triedProxy && proxyUrl) {
                    triedProxy = true;
                    try { ws.close(); } catch (e) {}
                    openWs(proxyUrl, true);
                    return;
                }
                if (AppState.connection.isConnected) {
                    wsReconnectTimeout = setTimeout(initWebSocket, Config.timeouts.reconnect);
                }
            };
        } catch (e) {
            console.warn('Failed to open WebSocket:', e);
            // attempt proxy if available and not yet tried
            if (!triedProxy && proxyUrl) {
                triedProxy = true;
                openWs(proxyUrl, true);
            }
        }
    }

    // Primary attempt: if connection flagged to use proxy, try proxy first
    if (AppState.connection.useProxy && proxyUrl) {
        triedProxy = true;
        openWs(proxyUrl, true);
    } else {
        // otherwise try direct and let async handlers fallback to proxy if needed
        openWs(backendWsUrl, false);
    }
}

function handleWSMessage(data) {
    if (!data) return;
    if (data.type === 'stats' && data.stats) {
        AppState.cache.poolStats = data.stats;
    }
    if (data.type === 'block' && data.block) {
        showBlockNotification(data.block);
    }
    if (data.type === 'update' || data.pool || Array.isArray(data.workers)) {
        if (data.pool) AppState.cache.poolStats = data.pool;
        if (Array.isArray(data.workers)) AppState.cache.workers = data.workers;
        document.dispatchEvent(new CustomEvent('ws:update', { detail: { pool: data.pool || null, workers: data.workers || null, raw: data } }));
    }
}

function updateWSIndicator(connected) {
    const indicator = document.getElementById('wsIndicator');
    if (!indicator) return;
    indicator.style.display = 'flex';
    if (connected) {
        indicator.classList.remove('disconnected');
        const text = indicator.querySelector('.ws-text'); if (text) text.textContent = 'Live';
    } else {
        indicator.classList.add('disconnected');
        const text = indicator.querySelector('.ws-text'); if (text) text.textContent = 'Reconnecting...';
    }
}

export function showBlockNotification(block) {
    try {
        const notification = document.createElement('div');
        notification.className = 'block-notification';
        notification.innerHTML = `<div style="color:#4ade80;font-weight:600;margin-bottom:6px">🎉 Block Found!</div><div style="color:#e5e7eb;font-size:0.85rem;">Hash: ${(block.hash||'').substring(0,20)}...</div>`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    } catch (e) { console.warn('showBlockNotification error', e); }
}

export async function testWebSocket() {
    return new Promise((resolve) => {
        try {
            const backendWsUrl = AppState.connection.apiBaseUrl.replace(/^https?:/, 'ws:') + '/api/ws';
            let wsUrl = backendWsUrl;
            if (AppState.connection.useProxy && Config.proxy && Config.proxy.base && Config.proxy.wsEndpoint) {
                const proxyWsBase = Config.proxy.base.replace(/^https?:/, AppState.connection.apiBaseUrl.startsWith('https') ? 'wss:' : 'ws:');
                wsUrl = `${proxyWsBase}${Config.proxy.wsEndpoint}${encodeURIComponent(backendWsUrl)}`;
            }

            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => { try{ ws.close(); }catch(e){}; resolve({ path: '/api/ws', description: 'WebSocket', category: 'Real-time', status: 'Timeout', ok: false }); }, 3000);
            ws.onopen = () => { clearTimeout(timeout); try{ ws.close(); }catch(e){}; resolve({ path: '/api/ws', description: 'WebSocket', category: 'Real-time', status: 'Connected', ok: true, dataPreview: 'WebSocket connection successful' }); };
            ws.onerror = () => { clearTimeout(timeout); resolve({ path: '/api/ws', description: 'WebSocket', category: 'Real-time', status: 'Error', ok: false }); };
        } catch (e) {
            resolve({ path: '/api/ws', description: 'WebSocket', category: 'Real-time', status: 'Error', ok: false, error: e.message });
        }
    });
}

