/**
 * Centralized State Management
 * Single source of truth for the application
 */

// Application State
export const AppState = {
    // Connection
    connection: {
        isConnected: false,
        isConnecting: false,
        // Default to false and detect when proxy is required at connect time
        useProxy: false,
        apiBaseUrl: '',
        wsConnection: null,
        wsReconnectTimeout: null,
        failureCount: 0
    },
    
    // Cached Data
    cache: {
        workers: [],
        poolStats: null,
        shareStats: null,
        miners: null,
        blocks: [],
        poolBlocks: null,
        lastPoolBlocksFetch: 0,
        lastWorkersFetch: 0,
        lastStatsFetch: 0,
        lastSharesFetch: 0,
        lastMinersFetch: 0
    },
    
    // History Data
    history: {
        chart: { sha: [], scrypt: [], kawpow: [] },
        address: {},
        serverCache: {},
        serverAvailable: null,
        lastRecord: 0
    },
    
    // UI State
    ui: {
        currentChartPeriod: '1h',
        currentStatsPeriod: '1h',
        currentPerformanceFilter: null,
        // currentSharesFilter controls which shares category is focused (null = none)
        currentSharesFilter: null,
        currentBlockAddressFilter: null,
        currentMinerAddress: null,
        charts: {}
    },
    
    // Hashes for change detection (prevent flickering)
    hashes: {
        stats: '',
        workers: '',
        blocks: '',
        miners: '',
        shareSummary: ''
    }
};

// Constants
export const Constants = {
    API_TIMEOUT: 5000,
    MAX_RETRIES: 3,
    UPDATE_INTERVAL: 5000,
    HISTORY_SAMPLE_MS: 60000,
    HISTORY_MAX_DAYS: 7,
    MAX_SHARES_HISTORY: 50,
    STORAGE_KEYS: {
        SERVER_IP: 'serverIp',
        SERVER_PORT: 'serverPort',
        CHART_HISTORY: 'chartHistory',
        ADDRESS_HISTORY: 'addressChartHistory'
    }
};

// Coinbase TX Cache
export const coinbaseTxCache = new Map();

// Update interval reference
export let updateInterval = null;

export function setUpdateInterval(interval) {
    updateInterval = interval;
}

export function clearUpdateInterval() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}
