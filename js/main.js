/**
 * Main Application Entry Point
 * Quai Mining Dashboard - Modular Version
 */

import { AppState, setUpdateInterval, clearUpdateInterval } from './state.js';
import { Config } from './config.js';
import { formatHashrate, formatNumber, formatUptime, hashStats } from './utils/formatters.js';
import { initHistory, recordHistory, saveServerConfig, saveServerHost, loadServerConfig, clearServerConfig } from './utils/storage.js';
import { 
    initNotifications, showSuccess, showError, showWarning, showInfo,
    showLoading, hideLoading, showTableSkeleton 
} from './utils/notifications.js';
import { isValidIP, testConnection, fetchPoolStats, fetchWorkers, fetchShareHistory, fetchPoolBlocksEndpoint, fetchMinerWorkers, fetchAllMiners } from './api/poolApi.js';
import { updateCharts, updateChartPeriod } from './components/charts.js';
import { updateWorkers, generateMinersFromAPI } from './components/workers.js';
import { updateBlocks, updateQuickStats, setStatsPeriod } from './components/blocks.js';
import { updateShareSectionFromPoolStats, updateShareStats } from './components/shares.js';
import { 
    openMinerModal, closeMinerModal, 
    openSearchModal, closeSearchModal, searchAddressInModal,
    openBlockSearchModal, closeBlockSearchModal, searchBlocksByAddress, selectBlockAddressFilter,
    initModalEventListeners 
} from './components/modals.js';
import { initWebSocket, closeWebSocket } from './components/websocket.js';
import { openApiDiagnostic, closeApiDiagnostic, initDiagnosticGlobals } from './components/diagnostics.js';

// =====================
// Global Exports (Immediate-Binding)
// =====================
// Bind these immediately to ensure HTML onclick handlers work
// even if downstream initialization encounters errors
try {
    window.connectToServer = connectToServer;
    window.clearConfig = clearConfig;
    window.updateChartPeriod = updateChartPeriod;
    window.setStatsPeriod = setStatsPeriod;
    window.openMinerModal = openMinerModal;
    window.closeMinerModal = closeMinerModal;
    window.openSearchModal = openSearchModal;
    window.closeSearchModal = closeSearchModal;
    window.searchAddressInModal = searchAddressInModal;
    window.openBlockSearchModal = openBlockSearchModal;
    window.closeBlockSearchModal = closeBlockSearchModal;
    window.searchBlocksByAddress = searchBlocksByAddress;
    window.selectBlockAddressFilter = selectBlockAddressFilter;
    window.openApiDiagnostic = openApiDiagnostic;
    window.closeApiDiagnostic = closeApiDiagnostic;
} catch (e) {
    console.error('Failed to bind global functions:', e);
}

// =====================
// Connection Management
// =====================

/**
 * Connect to server
 */
async function connectToServer() {
    const hostInputEl = document.getElementById('serverHost');
    const connectBtn = document.querySelector('.btn-connect');
    if (connectBtn) connectBtn.disabled = true;

    // Prevent concurrent connection attempts
    if (AppState.connection.isConnected || AppState.connection.isConnecting) {
        hideLoading();
        showInfo(AppState.connection.isConnected ? 'Already connected' : 'Connection in progress');
        if (connectBtn) connectBtn.disabled = false;
        return;
    }

    AppState.connection.isConnecting = true;

    let ip = '';
    let port = '';
    let inputProtocol = null;

    if (hostInputEl) {
        const val = hostInputEl.value.trim();
        if (!val) {
            showWarning('Enter server host or URL');
            updateStatus('Enter server host', 'disconnected');
            return;
        }
        if (val.startsWith('http://') || val.startsWith('https://')) {
            try {
                const parsed = new URL(val);
                inputProtocol = parsed.protocol.replace(':', '');
                ip = parsed.hostname;
                port = parsed.port || '';
            } catch (e) {
                ip = val;
            }
        } else if (val.includes(':')) {
            // host:port
            const idx = val.lastIndexOf(':');
            ip = val.slice(0, idx);
            port = val.slice(idx + 1);
        } else {
            ip = val;
        }
    } else {
        const ipEl = document.getElementById('serverIp');
        const portEl = document.getElementById('serverPort');
        const rawIp = ipEl ? ipEl.value.trim() : '';
        const rawPort = portEl ? portEl.value.trim() : '';
        if (!rawIp || !rawPort) {
            showWarning('Enter IP and port');
            updateStatus('Enter IP and port', 'disconnected');
            return;
        }
        ip = rawIp;
        port = rawPort;
    }

    let host = ip;
    let protocol = inputProtocol || (window.location.protocol === 'https:' ? 'https' : 'http');
    let portNum;
    if (inputProtocol) {
        // If user provided a full URL with scheme but no port, use standard ports
        if (port) {
            portNum = parseInt(port);
        } else {
            portNum = protocol === 'https' ? 443 : 80;
        }
    } else {
        // If no explicit port provided, default to standard port for the chosen protocol
        portNum = parseInt(port) || (protocol === 'https' ? 443 : 80);
    }
    
    if (!isValidIP(host)) {
        showError('Invalid IP/Domain format');
        updateStatus('Invalid IP/Domain (e.g: 192.168.1.1 or mining.local)', 'disconnected');
        return;
    }
    
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        showError('Port must be between 1-65535');
        updateStatus('Port must be between 1-65535', 'disconnected');
        return;
    }
    
    // Construct API URL — omit port when it's the default for the protocol
    const defaultPort = protocol === 'https' ? 443 : 80;
    const includePort = portNum && portNum !== defaultPort;
    const newApiBase = includePort ? `${protocol}://${host}:${portNum}` : `${protocol}://${host}`;

    // Helper: compare host and port of two URLs (ignore protocol differences)
    function sameHostPort(a, b) {
        try {
            const ua = new URL(a);
            const ub = new URL(b);
            const pa = ua.port || (ua.protocol === 'https:' ? '443' : '80');
            const pb = ub.port || (ub.protocol === 'https:' ? '443' : '80');
            return ua.hostname === ub.hostname && pa === pb;
        } catch (e) {
            return a === b;
        }
    }

    // If already connected to the same host:port, skip re-connecting
    if (AppState.connection.isConnected && sameHostPort(AppState.connection.apiBaseUrl, newApiBase)) {
        hideLoading();
        showInfo('Already connected to this server');
        updateStatus('Connected', 'connected');
        if (connectBtn) connectBtn.disabled = false;
        return;
    }

    // If currently connected to a different server, perform a clean disconnect first
    if (AppState.connection.isConnected && AppState.connection.apiBaseUrl !== newApiBase) {
        // stop updates and websocket before attempting new connection
        clearUpdateInterval();
        try { closeWebSocket(); } catch (e) { /* ignore */ }
        AppState.connection.isConnected = false;
        AppState.connection.apiBaseUrl = '';
        AppState.connection.failureCount = 0;
        updateStatus('Reconnecting...', 'loading');
    }

    AppState.connection.apiBaseUrl = newApiBase;

    updateStatus('Connecting...', 'loading');
    showLoading('Connecting to server...');
    
    try {
        console.info('Attempting connection to', host, 'protocol=', protocol, 'port=', portNum);
        try {
            await testConnection(AppState.connection.apiBaseUrl);
        } catch (firstError) {
            // Retry with the other protocol if initial attempt fails
            const fallbackProtocol = protocol === 'https' ? 'http' : 'https';
            // If the user explicitly provided a port, keep using it for the fallback.
            // Otherwise, switch to the default port for the fallback protocol and omit the explicit port.
            let fallbackUrl;
            if (port) {
                fallbackUrl = `${fallbackProtocol}://${host}:${port}`;
            } else {
                fallbackUrl = `${fallbackProtocol}://${host}`;
            }
            await testConnection(fallbackUrl);
            AppState.connection.apiBaseUrl = fallbackUrl;
        }
        
        hideLoading();
        AppState.connection.isConnected = true;
        AppState.connection.isConnecting = false;
        AppState.connection.failureCount = 0;
        updateStatus('Connected', 'connected');
        showSuccess('Connected to mining pool');
        if (connectBtn) connectBtn.disabled = false;
        document.getElementById('mainContent').classList.add('active');
        document.getElementById('loadingState').style.display = 'none';
        
        // Save to localStorage (prefer combined host string)
        try {
            const hostInputEl = document.getElementById('serverHost');
            if (hostInputEl && hostInputEl.value.trim()) {
                saveServerHost(hostInputEl.value.trim());
            } else {
                saveServerConfig(ip, port);
            }
        } catch (e) {
            try { saveServerConfig(ip, port); } catch (e) {}
        }
        
        // Show loading states for tables
        showTableSkeleton('workersBody', Config.ui.skeletonRows, 4);
        showTableSkeleton('blocksTableBody', Config.ui.skeletonRows, 6);
        
        // Start auto-update
        updateDashboard();
        startUpdateInterval();
        
        // Initialize WebSocket
        initWebSocket();
        
        // Fetch share history
        fetchShareHistory().then(data => {
            if (data) updateShareStats(data);
        });
        
    } catch (error) {
        hideLoading();
        AppState.connection.isConnected = false;
        AppState.connection.isConnecting = false;
        const errorMsg = error.name === 'AbortError' 
            ? 'Timeout - server not responding (5s)' 
            : error.message;
        
        showError(`Connection failed: ${errorMsg}`);
        updateStatus(errorMsg, 'disconnected');
        document.getElementById('mainContent').classList.remove('active');
        document.getElementById('loadingState').style.display = 'block';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Connection error: ${errorMsg}`;
        const loadingState = document.getElementById('loadingState');
        loadingState.innerHTML = '';
        loadingState.appendChild(errorDiv);
        
        console.error('Connection error:', error);
        if (connectBtn) connectBtn.disabled = false;
    }

    // ensure flag cleaned if function exits unexpectedly
    finally {
        AppState.connection.isConnecting = false;
    }
}

/**
 * Start update interval
 */
function startUpdateInterval() {
    clearUpdateInterval();
    setUpdateInterval(setInterval(updateDashboard, Config.intervals.dashboard));
}

/**
 * Update status indicator
 * @param {string} text - Status text
 * @param {string} status - Status class
 */
function updateStatus(text, status) {
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    
    statusEl.className = `status ${status}`;
    statusText.textContent = text;
}

/**
 * Clear configuration and disconnect
 */
function clearConfig() {
    clearUpdateInterval();
    try { closeWebSocket(); } catch (e) { /* ignore if not open */ }
    AppState.connection.isConnected = false;
    AppState.connection.failureCount = 0;
    // Clean websocket references
    try { AppState.connection.wsConnection = null; } catch (e) {}
    try { AppState.connection.wsReconnectTimeout && clearTimeout(AppState.connection.wsReconnectTimeout); AppState.connection.wsReconnectTimeout = null; } catch (e) {}
    // Reset input fields if present. Some builds use a single `serverHost` input.
    const hostEl = document.getElementById('serverHost');
    if (hostEl) hostEl.value = '';
    const ipEl = document.getElementById('serverIp');
    const portEl = document.getElementById('serverPort');
    if (ipEl) ipEl.value = '';
    if (portEl) portEl.value = '';
    document.getElementById('mainContent').classList.remove('active');
    document.getElementById('loadingState').style.display = 'block';
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.textContent = 'Waiting for connection...';
    updateStatus('Disconnected', 'disconnected');
    
    clearServerConfig();
    
    AppState.connection.apiBaseUrl = '';
    // Clear cached data and hashes so a subsequent connect performs fresh fetches
    AppState.cache.poolStats = null;
    AppState.cache.workers = [];
    AppState.cache.blocks = [];
    AppState.cache.shareStats = null;
    AppState.cache.miners = null;
    AppState.cache.lastPoolBlocksFetch = 0;
    AppState.cache.lastWorkersFetch = 0;
    AppState.cache.lastStatsFetch = 0;
    AppState.cache.lastSharesFetch = 0;
    AppState.cache.lastMinersFetch = 0;

    AppState.hashes.stats = '';
    AppState.hashes.workers = '';
    AppState.hashes.blocks = '';
    AppState.hashes.miners = '';
    AppState.hashes.shareSummary = '';

    // Reset table placeholders so UI shows loading state until next successful connect
    const wb = document.getElementById('workersBody');
    if (wb) wb.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Waiting for connection...</td></tr>';
    const mb = document.getElementById('minersBody');
    if (mb) mb.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Waiting for connection...</td></tr>';
    const bb = document.getElementById('blocksTableBody');
    if (bb) bb.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Waiting for connection...</td></tr>';

    // Ensure connect button is enabled after clearing
    const connectBtn = document.querySelector('.btn-connect');
    if (connectBtn) connectBtn.disabled = false;
}

// =====================
// Dashboard Update
// =====================

// Track last miner address
let lastMinerAddress = null;

/**
 * Update dashboard data
 * Optimized to avoid redundant API calls
 */
async function updateDashboard() {
    if (!AppState.connection.isConnected || !AppState.connection.apiBaseUrl) return;
    
    try {
        // Fetch pool stats (has internal caching)
        const stats = await fetchPoolStats(true); // Force refresh for dashboard update
        
        // Check if stats changed before updating UI
        const newHash = hashStats(stats);
        if (newHash !== AppState.hashes.stats) {
            AppState.hashes.stats = newHash;
            updatePoolStats(stats);
        }
        
        // Fetch workers (has internal caching)
        const workers = await fetchWorkers(true); // Force refresh for dashboard update
        
        // Only update UI if workers changed
        const workersHash = JSON.stringify(workers?.map(w => ({ a: w.address, h: w.hashrate })) || []);
        if (workersHash !== AppState.hashes.workers) {
            updateWorkers(workers, openMinerModal);
            // Try to fetch miners from API, fallback to generating from workers
            generateMinersFromAPI(openMinerModal);
        }
        
        // Fetch blocks from pool API (/api/pool/blocks)
        const now = Date.now();
        const cacheExpired = (now - (AppState.cache.lastPoolBlocksFetch || 0)) > Config.cache.poolBlocks;
        
        if (cacheExpired) {
            try {
                const blocksData = await fetchPoolBlocksEndpoint();
                if (blocksData) {
                    const poolBlocks = Array.isArray(blocksData)
                        ? blocksData
                        : (blocksData.blocks || blocksData.matured || []);
                    AppState.cache.blocks = poolBlocks;
                    updateBlocks(poolBlocks);
                    updateQuickStats(poolBlocks);
                    AppState.cache.lastPoolBlocksFetch = now;
                }
            } catch (e) {
                if (AppState.cache.blocks && AppState.cache.blocks.length > 0) {
                    updateBlocks(AppState.cache.blocks);
                    updateQuickStats(AppState.cache.blocks);
                }
            }
        } else {
            // Use cached blocks if available
            if (AppState.cache.blocks && AppState.cache.blocks.length > 0) {
                updateBlocks(AppState.cache.blocks);
                updateQuickStats(AppState.cache.blocks);
            }
        }

        // Refresh share history (cached)
        fetchShareHistory().then(data => {
            if (data) updateShareStats(data);
        });
        
        // Reset failure count on success
        AppState.connection.failureCount = 0;
        
    } catch (error) {
        console.error('Dashboard update error:', error);
        AppState.connection.failureCount++;
        
        if (AppState.connection.failureCount >= Config.limits.maxRetries) {
            showWarning('Connection unstable - retrying...');
            updateStatus('Connection lost - retrying...', 'loading');
        }
    }
}

/* ------------------
   View Drawer / Multi-view helpers
   ------------------ */
function toggleViewDrawer() {
    const drawer = document.getElementById('sideDrawer');
    if (!drawer) createSideDrawer();
    const d = document.getElementById('sideDrawer');
    if (d.classList.contains('open')) d.classList.remove('open');
    else d.classList.add('open');
}

function createSideDrawer() {
    if (document.getElementById('sideDrawer')) return;
    const drawer = document.createElement('div');
    drawer.id = 'sideDrawer';
    drawer.className = 'side-drawer';
    drawer.innerHTML = `
        <h4>Views</h4>
        <div class="view-list">
            <button onclick="showMainView()">Solo Mining Dashboard</button>
            <button onclick="switchToView('controller')">Controller View</button>
        </div>
    `;
    document.body.appendChild(drawer);
}

function switchToView(name) {
    const drawer = document.getElementById('sideDrawer');
    if (drawer) drawer.classList.remove('open');
    if (name === 'controller') {
        // show iframe with controller view (path relative to repo)
        const alt = document.getElementById('altContent');
        const main = document.getElementById('mainContent');
        const iframe = document.getElementById('secondaryView');
        iframe.src = './controller_view.html';
        document.getElementById('altTitle').textContent = 'Controller View';
        main.style.display = 'none';
        alt.style.display = 'block';
    }
}

function showMainView() {
    const alt = document.getElementById('altContent');
    const main = document.getElementById('mainContent');
    const drawer = document.getElementById('sideDrawer');
    if (drawer) drawer.classList.remove('open');
    const iframe = document.getElementById('secondaryView');
    if (iframe) iframe.src = '';
    alt.style.display = 'none';
    main.style.display = 'block';
}

// expose to global for inline handlers
try {
    window.toggleViewDrawer = toggleViewDrawer;
    window.switchToView = switchToView;
    window.showMainView = showMainView;
} catch (e) {}

/**
 * Update pool statistics display
 * @param {Object} stats - Pool stats
 */
function updatePoolStats(stats) {
    // Cache stats
    AppState.cache.poolStats = stats;
    
    // Basic stats
    document.getElementById('nodeName').textContent = stats.nodeName || '-';
    document.getElementById('workersConnected').textContent = stats.workersConnected || 0;
    
    const totalHashEl = document.getElementById('totalHashrate');
    if (totalHashEl) {
        totalHashEl.textContent = formatHashrate(stats.hashrate);
    }
    
    document.getElementById('blocksFound').textContent = stats.blocksFound || 0;
    
    // Share stats
    document.getElementById('sharesValid').textContent = formatNumber(stats.sharesValid);
    document.getElementById('sharesStale').textContent = formatNumber(stats.sharesStale);
    document.getElementById('sharesInvalid').textContent = formatNumber(stats.sharesInvalid);
    document.getElementById('uptime').textContent = formatUptime(stats.uptime);
    
    // Update Share History section
    updateShareSectionFromPoolStats(stats);
    
    // Algorithm stats
    if (stats.sha256) {
        document.getElementById('shaHashrate').textContent = formatHashrate(stats.sha256.hashrate);
        document.getElementById('shaWorkers').textContent = stats.sha256.workers || 0;
    }
    
    if (stats.scrypt) {
        document.getElementById('scryptHashrate').textContent = formatHashrate(stats.scrypt.hashrate);
        document.getElementById('scryptWorkers').textContent = stats.scrypt.workers || 0;
    }
    
    if (stats.kawpow) {
        document.getElementById('kawpowHashrate').textContent = formatHashrate(stats.kawpow.hashrate);
        document.getElementById('kawpowWorkers').textContent = stats.kawpow.workers || 0;
    }
    
    // Record history and update charts
    recordHistory(stats);
    updateCharts(stats);
}

/**
 * Get miner address from connected workers
 * @returns {string|null} Miner address
 */
function getMinerAddress() {
    if (AppState.cache.workers && AppState.cache.workers.length > 0) {
        const worker = AppState.cache.workers[0];
        if (worker.address) {
            return worker.address;
        }
        const name = worker.name || worker.worker || '';
        if (name.includes('.')) {
            return name.split('.')[0];
        }
        if (name.startsWith('0x')) {
            return name;
        }
    }
    return null;
}

// =====================
// Initialization
// =====================

/**
 * Initialize application
 */
function init() {
    // Initialize notification system
    initNotifications();
    
    // Initialize history storage
    initHistory();
    
    // Load saved configuration
    const config = loadServerConfig();
    const hostEl = document.getElementById('serverHost');
    if (hostEl) {
        if (config.host) {
            // If stored host equals default host plus default port, show without port
            try {
                let hv = config.host;
                if (hv.startsWith('http://') || hv.startsWith('https://')) {
                    const p = new URL(hv);
                    hv = p.hostname + (p.port ? (':' + p.port) : '');
                }
                const defaultHost = Config.defaults.serverIp || '';
                const defaultPort = String(Config.defaults.serverPort || '');
                if (defaultHost && hv.startsWith(defaultHost + ':') && hv.endsWith(':' + defaultPort)) {
                    hostEl.value = defaultHost;
                } else {
                    hostEl.value = config.host;
                }
            } catch (e) {
                hostEl.value = config.host;
            }
        } else if (config.ip && config.port) {
            hostEl.value = config.ip + (config.port ? ':' + config.port : '');
        } else if (config.ip) {
            hostEl.value = config.ip;
        }
    } else {
        if (config.host) {
            // attempt to split host into ip/port for legacy fields
            try {
                const parsed = new URL(config.host.startsWith('http') ? config.host : ('http://' + config.host));
                const ipEl = document.getElementById('serverIp');
                const portEl = document.getElementById('serverPort');
                if (ipEl) ipEl.value = parsed.hostname;
                if (portEl) portEl.value = parsed.port || '';
            } catch (e) {}
        } else {
            if (config.ip) {
                const ipEl = document.getElementById('serverIp');
                if (ipEl) ipEl.value = config.ip;
            }
            if (config.port) {
                const portEl = document.getElementById('serverPort');
                if (portEl) portEl.value = config.port;
            }
        }
    }
    
    // Initialize modal event listeners
    initModalEventListeners();
    
    // Initialize diagnostic globals
    initDiagnosticGlobals();

    // Live updates from WebSocket
    document.addEventListener('ws:update', (event) => {
        const detail = event.detail || {};
        if (detail.pool) {
            updatePoolStats(detail.pool);
        }
        if (detail.workers) {
            updateWorkers(detail.workers, openMinerModal);
            generateMinersFromAPI(openMinerModal);
        }
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearUpdateInterval();
        } else {
            if (AppState.connection.isConnected && AppState.connection.apiBaseUrl) {
                updateDashboard();
                startUpdateInterval();
            }
        }
    });
    
    // Auto-connect if saved config exists
    if (config.ip && config.port) {
        showInfo('Auto-connecting to saved server...');
        setTimeout(connectToServer, 500);
    }
}

// =====================
// Global Exports (Moved to top)
// =====================

// Initialize on load
window.addEventListener('load', init);

// Export for module usage
export {
    connectToServer,
    clearConfig,
    updateDashboard,
    updateStatus
};

