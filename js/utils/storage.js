/**
 * LocalStorage Utilities
 * Functions for persisting data to localStorage
 */

import { AppState } from '../state.js';
import { Config } from '../config.js';

/**
 * Save server configuration to localStorage
 * @param {string} ip - Server IP
 * @param {string} port - Server port
 */
export function saveServerConfig(ip, port) {
    localStorage.setItem(Config.storage.serverIp, ip);
    localStorage.setItem(Config.storage.serverPort, port);
}

/**
 * Load server configuration from localStorage
 * @returns {Object} Server configuration { ip, port }
 */
export function loadServerConfig() {
    return {
        ip: localStorage.getItem(Config.storage.serverIp) || '',
        port: localStorage.getItem(Config.storage.serverPort) || ''
    };
}

/**
 * Clear server configuration from localStorage
 */
export function clearServerConfig() {
    localStorage.removeItem(Config.storage.serverIp);
    localStorage.removeItem(Config.storage.serverPort);
}

/**
 * Initialize chart history from localStorage
 */
export function initHistory() {
    try {
        const raw = localStorage.getItem(Config.storage.chartHistory);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                AppState.history.chart.sha = Array.isArray(parsed.sha) ? parsed.sha : [];
                AppState.history.chart.scrypt = Array.isArray(parsed.scrypt) ? parsed.scrypt : [];
                AppState.history.chart.kawpow = Array.isArray(parsed.kawpow) ? parsed.kawpow : [];
            }
        }
    } catch (e) {
        console.warn('Failed to load chart history:', e);
        AppState.history.chart = { sha: [], scrypt: [], kawpow: [] };
    }
    
    // Load address history
    try {
        const addressRaw = localStorage.getItem(Config.storage.addressHistory);
        if (addressRaw) {
            AppState.history.address = JSON.parse(addressRaw) || {};
        }
    } catch (e) {
        console.warn('Failed to load address history:', e);
        AppState.history.address = {};
    }
    
    pruneHistory();
}

/**
 * Prune old history data and save to localStorage
 */
export function pruneHistory() {
    const cutoff = Date.now() - Config.limits.historyMaxDays * 24 * 60 * 60 * 1000;
    
    // Prune chart history
    ['sha', 'scrypt', 'kawpow'].forEach(key => {
        AppState.history.chart[key] = AppState.history.chart[key].filter(
            p => p && typeof p.t === 'number' && p.t >= cutoff
        );
    });
    
    // Prune address history
    Object.keys(AppState.history.address).forEach(addr => {
        ['sha', 'scrypt', 'kawpow'].forEach(key => {
            if (AppState.history.address[addr] && AppState.history.address[addr][key]) {
                AppState.history.address[addr][key] = AppState.history.address[addr][key].filter(
                    p => p && typeof p.t === 'number' && p.t >= cutoff
                );
            }
        });
        
        // Remove address if all arrays are empty
        const addrHistory = AppState.history.address[addr];
        if (addrHistory && 
            (!addrHistory.sha || addrHistory.sha.length === 0) &&
            (!addrHistory.scrypt || addrHistory.scrypt.length === 0) &&
            (!addrHistory.kawpow || addrHistory.kawpow.length === 0)) {
            delete AppState.history.address[addr];
        }
    });
    
    // Save to localStorage
    try {
        localStorage.setItem(Config.storage.chartHistory, JSON.stringify(AppState.history.chart));
        localStorage.setItem(Config.storage.addressHistory, JSON.stringify(AppState.history.address));
    } catch (e) {
        console.warn('Failed to persist chart history:', e);
    }
}

/**
 * Record current stats to history
/**
 * Record current stats to history
 * @param {Object} stats - Pool stats object
 */
export function recordHistory(stats) {
    const now = Date.now();
    
    // Throttle to 1 minute
    if (now - AppState.history.lastRecord < Config.intervals.historySample) return;
    AppState.history.lastRecord = now;
    
    // Push values if present
    if (stats.sha256 && typeof stats.sha256.hashrate === 'number') {
        AppState.history.chart.sha.push({ t: now, v: stats.sha256.hashrate });
    }
    if (stats.scrypt && typeof stats.scrypt.hashrate === 'number') {
        AppState.history.chart.scrypt.push({ t: now, v: stats.scrypt.hashrate });
    }
    if (stats.kawpow && typeof stats.kawpow.hashrate === 'number') {
        AppState.history.chart.kawpow.push({ t: now, v: stats.kawpow.hashrate });
    }
    
    // Record per-address history
    recordAddressHistory(now);
    
    pruneHistory();
}

/**
 * Record hashrate history per address from workers data
 * @param {number} now - Current timestamp
 */
function recordAddressHistory(now) {
    if (!AppState.cache.workers || AppState.cache.workers.length === 0) return;
    
    // Group workers by address and algorithm
    const addressStats = {};
    AppState.cache.workers.forEach(worker => {
        const addr = worker.address || 'Unknown';
        const algo = (worker.algorithm || 'kawpow').toLowerCase();
        
        if (!addressStats[addr]) {
            addressStats[addr] = { sha: 0, scrypt: 0, kawpow: 0 };
        }
        
        const hashrate = worker.hashrate || 0;
        if (algo.includes('sha') || algo === 'sha256' || algo === 'sha-256') {
            addressStats[addr].sha += hashrate;
        } else if (algo.includes('scrypt')) {
            addressStats[addr].scrypt += hashrate;
        } else {
            addressStats[addr].kawpow += hashrate;
        }
    });
    
    // Record history for each address
    Object.keys(addressStats).forEach(addr => {
        if (!AppState.history.address[addr]) {
            AppState.history.address[addr] = { sha: [], scrypt: [], kawpow: [] };
        }
        
        const stats = addressStats[addr];
        if (stats.sha > 0) {
            AppState.history.address[addr].sha.push({ t: now, v: stats.sha });
        }
        if (stats.scrypt > 0) {
            AppState.history.address[addr].scrypt.push({ t: now, v: stats.scrypt });
        }
        if (stats.kawpow > 0) {
            AppState.history.address[addr].kawpow.push({ t: now, v: stats.kawpow });
        }
    });
}

/**
 * Force record history for a specific address without throttle
 * @param {string} targetAddress - Address to record
 */
export function forceRecordAddressHistory(targetAddress) {
    const now = Date.now();
    const addressWorkers = AppState.cache.workers.filter(w => w.address === targetAddress);
    
    if (addressWorkers.length === 0) return;
    
    if (!AppState.history.address[targetAddress]) {
        AppState.history.address[targetAddress] = { sha: [], scrypt: [], kawpow: [] };
    }
    
    // Calculate hashrate by algorithm
    let sha = 0, scrypt = 0, kawpow = 0;
    addressWorkers.forEach(w => {
        const algo = (w.algorithm || 'kawpow').toLowerCase();
        const hr = w.hashrate || 0;
        if (algo.includes('sha') || algo === 'sha256' || algo === 'sha-256') {
            sha += hr;
        } else if (algo.includes('scrypt')) {
            scrypt += hr;
        } else {
            kawpow += hr;
        }
    });
    
    // Add points if we don't have a recent one (within 30 seconds)
    const history = AppState.history.address[targetAddress];
    const addIfNeeded = (arr, value) => {
        if (value > 0) {
            const last = arr[arr.length - 1];
            if (!last || (now - last.t) > 30000) {
                arr.push({ t: now, v: value });
            }
        }
    };
    
    addIfNeeded(history.sha, sha);
    addIfNeeded(history.scrypt, scrypt);
    addIfNeeded(history.kawpow, kawpow);
}
