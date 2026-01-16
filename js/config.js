/**
 * Centralized Configuration
 * All configurable values in one place
 */

export const Config = {
    // API Endpoints
    api: {
        pool: {
            endpoints: {
                health: '/health',
                stats: '/api/pool/stats',
                workers: '/api/pool/workers',
                blocks: '/api/pool/blocks',
                shares: '/api/pool/shares',
                minerStats: '/api/miner/{address}/stats'
            }
        }
    },
    
    // Timeouts (in milliseconds)
    timeouts: {
        api: 5000,
        websocket: 5000,
        reconnect: 5000
    },
    
    // Cache durations (in milliseconds)
    cache: {
        poolStats: 3000,
        workers: 3000,
        shares: 5000,
        minerStats: 10000,
        poolBlocks: 30000,
        miners: 5000
    },
    
    // Update intervals (in milliseconds)
    intervals: {
        dashboard: 5000,
        charts: 60000,
        historySample: 60000
    },
    
    // Limits
    limits: {
        maxRetries: 3,
        maxSharesHistory: 50,
        historyMaxDays: 7,
        chartMaxPoints: 30
    },
    
    // LocalStorage keys
    storage: {
        serverIp: 'quai_dashboard_serverIp',
        serverPort: 'quai_dashboard_serverPort',
        serverHost: 'quai_dashboard_serverHost',
        chartHistory: 'quai_dashboard_chartHistory',
        addressHistory: 'quai_dashboard_addressHistory',
        theme: 'quai_dashboard_theme'
    },
    
    // UI Settings
    ui: {
        animationDuration: 300,
        notificationDuration: 5000,
        loadingMinDisplay: 500,
        skeletonRows: 3
    },
    
    // Default values
    defaults: {
        serverIp: 'dpool.bitquai.live',
        serverPort: '3336',
        chartPeriod: '1h'
    }
};

/**
 * Build API URL with parameters
 * @param {string} template - URL template with {param} placeholders
 * @param {Object} params - Parameters to replace
 * @returns {string} Built URL
 */
export function buildUrl(template, params = {}) {
    let url = template;
    for (const [key, value] of Object.entries(params)) {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
    }
    return url;
}

/**
 * Get full Pool API URL
 * @param {string} baseUrl - Pool base URL
 * @param {string} endpoint - Endpoint name
 * @param {Object} params - URL parameters
 * @returns {string} Full URL
 */
export function getPoolUrl(baseUrl, endpoint, params = {}) {
    const template = Config.api.pool.endpoints[endpoint];
    if (!template) throw new Error(`Unknown Pool endpoint: ${endpoint}`);
    return baseUrl + buildUrl(template, params);
}
