/**
 * Formatting Utilities
 * Functions for formatting numbers, hashrates, time, etc.
 */

/**
 * Format numbers with thousand separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '-';
    return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format hashrate to human readable format
 * @param {number} hashrate - Hashrate in H/s
 * @returns {string} Formatted hashrate string
 */
export function formatHashrate(hashrate) {
    if (hashrate === null || hashrate === undefined || hashrate === 0) return '-';
    
    const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
    let size = hashrate;
    let unitIndex = 0;
    
    while (size >= 1000 && unitIndex < units.length - 1) {
        size /= 1000;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format uptime seconds to human readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
export function formatUptime(seconds) {
    if (!seconds) return '-';
    
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

/**
 * Format elapsed time from milliseconds
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
export function formatElapsedTime(ms) {
    if (ms < 60000) return 'Just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
    return `${Math.floor(ms / 86400000)}d ago`;
}

/**
 * Format timestamp label for charts
 * @param {number} ts - Timestamp in milliseconds
 * @param {string} period - Time period ('1h', '24h', '7d')
 * @returns {string} Formatted label
 */
export function formatLabel(ts, period) {
    const d = new Date(ts);
    if (period === '7d') {
        return d.toLocaleDateString(undefined, { weekday: 'short' });
    } else if (period === '24h') {
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Create a simple hash of stats for comparison
 * @param {Object} stats - Stats object
 * @returns {string} Hash string
 */
export function hashStats(stats) {
    if (!stats) return '';
    return JSON.stringify({
        h: stats.hashrate,
        w: stats.workersConnected,
        v: stats.sharesValid,
        b: stats.blocksFound
    });
}

/**
 * Node name as shown on screen.
 * The node still reports its old name ("bitquai-cyprus1"). Renaming it is a
 * change on the node itself, so until that happens the panel leaves the
 * retired prefix out and shows the rest ("cyprus1"). Once the node is renamed
 * this function returns the name untouched.
 * @param {string} name - Name reported by the node
 * @returns {string} Name to display
 */
export function shownNodeName(name) {
    const text = String(name ?? '').trim();
    if (!text) return '-';
    const rest = text.replace(/^bitquai[\s._-]*/i, '');
    return rest || '-';
}
