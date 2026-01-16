/**
 * Pool API Module
 * Handles all communication with the Stratum pool server
 */

import { AppState } from '../state.js';
import { Config } from '../config.js';

/**
 * Validate IP address or domain
 * @param {string} str - IP or domain string
 * @returns {boolean} True if valid
 */
export function isValidIP(str) {
    // IP format (0.0.0.0 to 255.255.255.255)
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = str.match(ipRegex);
    
    if (match) {
        for (let i = 1; i <= 4; i++) {
            const num = parseInt(match[i]);
            if (num > 255) return false;
        }
        return true;
    }
    
    // Accept localhost
    if (str === 'localhost' || str === '127.0.0.1') return true;
    
    // Accept domains
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return hostnameRegex.test(str);
}

/**
 * Test connection to server with health check
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection(baseUrl = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const url = baseUrl || AppState.connection.apiBaseUrl;
        const response = await fetch(`${url}/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Fetch pool statistics
 * Uses cache if data is less than 3 seconds old
 * @param {boolean} forceRefresh - Force refresh ignoring cache
 * @returns {Promise<Object>} Pool stats object
 */
export async function fetchPoolStats(forceRefresh = false) {
    const now = Date.now();
    
    // Return cached data if recent and not forcing refresh
    if (!forceRefresh && AppState.cache.poolStats && 
        (now - AppState.cache.lastStatsFetch) < Config.cache.poolStats) {
        return AppState.cache.poolStats;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/pool/stats`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const stats = await response.json();
        AppState.cache.poolStats = stats;
        AppState.cache.lastStatsFetch = now;
        return stats;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Fetch workers list
 * Uses cache if data is less than configured time
 * @param {boolean} forceRefresh - Force refresh ignoring cache
 * @returns {Promise<Array>} Workers array
 */
export async function fetchWorkers(forceRefresh = false) {
    const now = Date.now();
    
    // Return cached data if recent and not forcing refresh
    if (!forceRefresh && AppState.cache.workers.length > 0 && 
        (now - AppState.cache.lastWorkersFetch) < Config.cache.workers) {
        return AppState.cache.workers;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/pool/workers`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const workers = await response.json();
        AppState.cache.workers = workers || [];
        AppState.cache.lastWorkersFetch = now;
        return workers;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Fetch blocks from pool
 * @returns {Promise<Object>} Blocks data
 */
export async function fetchPoolBlocks() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/blocks`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Fetch share history/stats
 * Uses cache to avoid redundant requests
 * @param {boolean} forceRefresh - Force refresh ignoring cache
 * @returns {Promise<Object>} Share stats
 */
export async function fetchShareHistory(forceRefresh = false) {
    const now = Date.now();
    
    // Return cached data if recent and not forcing refresh
    if (!forceRefresh && AppState.cache.shareStats && 
        (now - (AppState.cache.lastSharesFetch || 0)) < Config.cache.shares) {
        return AppState.cache.shareStats;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/pool/shares`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) return AppState.cache.shareStats || null;
        
        const data = await response.json();
        AppState.cache.shareStats = data;
        AppState.cache.lastSharesFetch = now;
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        return AppState.cache.shareStats || null;
    }
}

/**
 * Fetch miner-specific stats
 * Uses cache to avoid redundant requests
 * @param {string} address - Miner address
 * @returns {Promise<Object|null>} Miner stats or null
 */
export async function fetchMinerStats(address) {
    const now = Date.now();
    const cacheKey = `minerStats_${address}`;
    
    // Check cache first
    if (AppState.cache[cacheKey] && (now - AppState.cache[cacheKey].timestamp) < Config.cache.minerStats) {
        return AppState.cache[cacheKey].data;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/miner/${encodedAddress}/stats`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        // Cache the result
        AppState.cache[cacheKey] = { data, timestamp: now };
        
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        return null;
    }
}

/**
 * Get miner address from connected workers
 * @returns {string|null} Miner address or null
 */
export function getMinerAddress() {
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

/**
 * Get list of worker names connected to this node
 * @returns {Array<string>} Worker names
 */
export function getNodeWorkerNames() {
    const workerNames = [];
    if (AppState.cache.workers && AppState.cache.workers.length > 0) {
        AppState.cache.workers.forEach(worker => {
            const name = worker.name || worker.worker || '';
            if (name.includes('.')) {
                const workerName = name.split('.').slice(1).join('.');
                if (workerName && !workerNames.includes(workerName)) {
                    workerNames.push(workerName);
                }
            }
        });
    }
    return workerNames;
}
/**
 * Fetch pool blocks using /api/pool/blocks endpoint
 * @returns {Promise<Object>} Blocks data
 */
export async function fetchPoolBlocksEndpoint() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/pool/blocks`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('Failed to fetch pool blocks from /api/pool/blocks:', error);
        throw error;
    }
}

/**
 * Fetch workers for a specific miner address
 * @param {string} address - Miner address
 * @returns {Promise<Array>} Workers array for the address
 */
export async function fetchMinerWorkers(address) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/miner/${encodedAddress}/workers`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('Failed to fetch miner workers:', error);
        return [];
    }
}

/**
 * Fetch all miners list
 * @returns {Promise<Array>} Miners array
 */
export async function fetchAllMiners() {
    const now = Date.now();
    if (AppState.cache.miners && (now - (AppState.cache.lastMinersFetch || 0)) < Config.cache.miners) {
        return AppState.cache.miners;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.timeouts.api);
    
    try {
        const response = await fetch(`${AppState.connection.apiBaseUrl}/api/miners`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        AppState.cache.miners = data;
        AppState.cache.lastMinersFetch = now;
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('Failed to fetch miners list:', error);
        return AppState.cache.miners || [];
    }
}