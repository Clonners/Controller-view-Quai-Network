/**
 * WebSocket Module
 * Handles real-time updates via WebSocket connection
 */

import { AppState } from '../state.js';
import { Config } from '../config.js';

let wsReconnectTimeout = null;

/**
 * Initialize WebSocket connection
 */
export function initWebSocket() {
    if (!AppState.connection.apiBaseUrl) return;
    
    // Close existing connection
    closeWebSocket();
    
    try {
        const wsProtocol = AppState.connection.apiBaseUrl.startsWith('https') ? 'wss' : 'ws';
        const wsHost = AppState.connection.apiBaseUrl.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsHost}/api/ws`;
        
        AppState.connection.wsConnection = new WebSocket(wsUrl);
        
        AppState.connection.wsConnection.onopen = () => {
            console.log('WebSocket connected');
            updateWSIndicator(true);
        };
        
        AppState.connection.wsConnection.onclose = () => {
            console.log('WebSocket closed');
            updateWSIndicator(false);
            
            // Attempt to reconnect after configured delay
            if (AppState.connection.isConnected) {
                wsReconnectTimeout = setTimeout(initWebSocket, Config.timeouts.reconnect);
            }
        };
        
        AppState.connection.wsConnection.onerror = (error) => {
            console.warn('WebSocket error:', error);
            updateWSIndicator(false);
        };
        
        AppState.connection.wsConnection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWSMessage(data);
            } catch (e) {
                console.warn('Failed to parse WebSocket message:', e);
            }
        };
    } catch (e) {
        console.warn('Failed to initialize WebSocket:', e);
    }
}

/**
 * Handle incoming WebSocket message
 * @param {Object} data - Message data
 */
function handleWSMessage(data) {
    // Handle different message types
    if (data.type === 'stats') {
        // Live stats update
        if (data.stats) {
            AppState.cache.poolStats = data.stats;
        }
    } else if (data.type === 'block') {
        // New block found
        showBlockNotification(data.block);
    } else if (data.type === 'share') {
        // New share submitted
        // Could update share counters
    } else if (data.type === 'update' || data.pool || Array.isArray(data.workers)) {
        // Full update payload with pool + workers
        if (data.pool) {
            AppState.cache.poolStats = data.pool;
        }
        if (Array.isArray(data.workers)) {
            AppState.cache.workers = data.workers;
        }
        document.dispatchEvent(new CustomEvent('ws:update', {
            detail: {
                pool: data.pool || null,
                workers: Array.isArray(data.workers) ? data.workers : null,
                raw: data
            }
        }));
    }
}

/**
 * Update WebSocket indicator
 * @param {boolean} connected - Connection status
 */
function updateWSIndicator(connected) {
    const indicator = document.getElementById('wsIndicator');
    if (!indicator) return;
    
    indicator.style.display = 'flex';
    
    if (connected) {
        indicator.classList.remove('disconnected');
        const text = indicator.querySelector('.ws-text');
        if (text) text.textContent = 'Live';
    } else {
        indicator.classList.add('disconnected');
        const text = indicator.querySelector('.ws-text');
        if (text) text.textContent = 'Reconnecting...';
    }
}

/**
 * Close WebSocket connection
 */
export function closeWebSocket() {
    if (wsReconnectTimeout) {
        clearTimeout(wsReconnectTimeout);
        wsReconnectTimeout = null;
    }
    
    if (AppState.connection.wsConnection) {
        AppState.connection.wsConnection.close();
        AppState.connection.wsConnection = null;
    }
    
    const indicator = document.getElementById('wsIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

/**
 * Show block found notification
 * @param {Object} block - Block data
 */
export function showBlockNotification(block) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1a0f10 0%, #0d0507 100%);
        border: 2px solid #4ade80;
        border-radius: 12px;
        padding: 16px 20px;
        z-index: 2000;
        animation: slideIn 0.3s ease-out, fadeOut 0.5s ease-out 4.5s forwards;
        box-shadow: 0 10px 30px rgba(74, 222, 128, 0.3);
    `;
    notification.innerHTML = `
        <div style="color: #4ade80; font-weight: 600; margin-bottom: 6px;">🎉 Block Found!</div>
        <div style="color: #e5e7eb; font-size: 0.85rem;">Hash: ${(block.hash || '').substring(0, 20)}...</div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
}

/**
 * Test WebSocket connection
 * @returns {Promise<Object>} Test result
 */
export async function testWebSocket() {
    return new Promise((resolve) => {
        try {
            const wsProtocol = AppState.connection.apiBaseUrl.startsWith('https') ? 'wss' : 'ws';
            const wsHost = AppState.connection.apiBaseUrl.replace(/^https?:\/\//, '');
            const wsUrl = `${wsProtocol}://${wsHost}/api/ws`;
            
            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => {
                ws.close();
                resolve({
                    path: '/api/ws',
                    description: 'WebSocket for live updates (1s interval)',
                    category: 'Real-time',
                    status: 'Timeout',
                    ok: false
                });
            }, 3000);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                ws.close();
                resolve({
                    path: '/api/ws',
                    description: 'WebSocket for live updates (1s interval)',
                    category: 'Real-time',
                    status: 'Connected',
                    ok: true,
                    dataPreview: 'WebSocket connection successful'
                });
            };
            
            ws.onerror = () => {
                clearTimeout(timeout);
                resolve({
                    path: '/api/ws',
                    description: 'WebSocket for live updates (1s interval)',
                    category: 'Real-time',
                    status: 'Error',
                    ok: false
                });
            };
        } catch (e) {
            resolve({
                path: '/api/ws',
                description: 'WebSocket for live updates (1s interval)',
                category: 'Real-time',
                status: 'Error',
                ok: false,
                error: e.message
            });
        }
    });
}
