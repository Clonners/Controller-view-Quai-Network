/**
 * Workers Component
 * Handles worker table display and updates
 */

import { AppState } from '../state.js?v=d689eb0615';
import { formatHashrate } from '../utils/formatters.js?v=d689eb0615';
import { fetchAllMiners } from '../api/poolApi.js?v=d689eb0615';
import { el, cell, row, messageRow, isNarrow, shortAddress } from '../utils/dom.js?v=d689eb0615';

const WORKER_COLS = 4;
const MINER_COLS = 4;

/** An address the reader can open (mouse, touch or keyboard). */
function addressButton(address, className, onOpen) {
    const btn = el('button', {
        className: 'link ' + className,
        // The 40-column grid has no room for a whole address.
        text: isNarrow() ? shortAddress(address) : address,
        title: address + ' (view miner details)',
        attrs: { type: 'button' }
    });
    btn.addEventListener('click', () => onOpen(address));
    return btn;
}

/**
 * Update workers table
 * @param {Array} workersData - Workers array
 * @param {Function} onMinerClick - Callback when miner is clicked
 */
export function updateWorkers(workersData, onMinerClick) {
    const tbody = document.getElementById('workersBody');

    // Cache workers data
    AppState.cache.workers = workersData || [];

    // Check if workers changed to prevent flickering
    const workersHash = JSON.stringify(workersData?.map(w => ({ a: w.address, h: w.hashrate })) || []);
    if (workersHash === AppState.hashes.workers) return;
    AppState.hashes.workers = workersHash;

    if (!tbody) return;

    if (!workersData || workersData.length === 0) {
        messageRow(tbody, WORKER_COLS, 'No connected workers');
        return;
    }

    const rows = workersData.map(worker => {
        // Address column
        let addressContent;
        if (worker.address) {
            addressContent = addressButton(worker.address, 'worker-name clickable-address', (address) => {
                if (onMinerClick) onMinerClick(address);
            });
        } else {
            addressContent = '-';
        }

        // Worker name column
        const workerName = worker.name || worker.workerName || worker.worker || worker.rigName || worker.rig || null;

        // Algorithm column
        const algoRaw = (worker.algorithm || '').toLowerCase();
        let algoLabel = '—';
        if (algoRaw.includes('kawpow') || algoRaw.includes('progpow')) {
            algoLabel = 'kawpow';
        } else if (algoRaw.includes('sha256') || algoRaw === 'sha' || algoRaw === 'sha-256') {
            algoLabel = 'sha256';
        } else if (algoRaw.includes('scrypt')) {
            algoLabel = 'scrypt';
        }

        return row([
            cell('address', addressContent, 'c-address'),
            cell('worker', workerName || '1', 'c-name'),
            cell('algorithm', algoLabel),
            cell('hashrate', formatHashrate(worker.hashrate), 'r')
        ]);
    });

    tbody.replaceChildren(...rows);
}

/**
 * Generate miners list from API (/api/miners endpoint)
 * @param {Function} onMinerClick - Callback when miner is clicked
 */
export async function generateMinersFromAPI(onMinerClick) {
    try {
        const minersPayload = await fetchAllMiners();
        const minersList = Array.isArray(minersPayload) ? minersPayload : (minersPayload?.miners || []);
        const activeAddresses = new Set(
            (AppState.cache.workers || [])
                .filter(w => w.isConnected !== false)
                .map(w => w.address)
                .filter(Boolean)
        );
        if (minersList.length > 0) {
            updateMiners(minersPayload, onMinerClick, activeAddresses);
        } else {
            // No data from API
            messageRow(document.getElementById('minersBody'), MINER_COLS, 'No miners data from API');
        }
    } catch (e) {
        console.error('Failed to fetch miners from API:', e);
        messageRow(document.getElementById('minersBody'), MINER_COLS, 'Error loading miners from API', 'bad');
    }
}


/**
 * Update miners list table
 * @param {Array} minersData - Miners array
 * @param {Function} onMinerClick - Callback when miner is clicked
 */
export function updateMiners(minersData, onMinerClick, activeAddresses = null) {
    const tbody = document.getElementById('minersBody');
    const countEl = document.getElementById('minersCount');

    if (!tbody) return;

    // Handle different response formats
    let miners = minersData;
    if (minersData && !Array.isArray(minersData)) {
        miners = minersData.miners || minersData.data || minersData.list || [];
    }
    if (!Array.isArray(miners)) {
        miners = [];
    }
    if (activeAddresses && activeAddresses.size > 0) {
        miners = miners.filter(miner => activeAddresses.has(miner.address || miner.miner));
    }

    const activeWorkersByAddress = new Map();
    (AppState.cache.workers || []).forEach(worker => {
        const address = worker.address;
        if (!address || worker.isConnected === false) return;
        if (!activeWorkersByAddress.has(address)) {
            activeWorkersByAddress.set(address, { count: 0, hashrate: 0 });
        }
        const entry = activeWorkersByAddress.get(address);
        entry.count += 1;
        entry.hashrate += worker.hashrate || 0;
    });

    // Check if data changed
    const minersHash = JSON.stringify((miners || []).map(m => {
        const addr = m.address || m.miner;
        const active = activeWorkersByAddress.get(addr) || { count: 0, hashrate: 0 };
        return { addr, c: active.count, h: Math.round(active.hashrate) };
    }));
    if (minersHash === AppState.hashes.miners) return;
    AppState.hashes.miners = minersHash;

    if (miners.length === 0) {
        messageRow(tbody, MINER_COLS, 'No miners found');
        if (countEl) countEl.textContent = '0 miners';
        return;
    }

    if (countEl) countEl.textContent = `${miners.length} miner${miners.length !== 1 ? 's' : ''}`;

    // Build table rows
    const rows = miners.map(miner => {
        const address = miner.address || miner.miner || '-';

        // Address cell
        const addressContainer = el('div', { className: 'miner-address-cell' });
        if (address !== '-') {
            addressContainer.appendChild(addressButton(address, 'miner-address', (addr) => {
                if (onMinerClick) onMinerClick(addr);
            }));
        } else {
            addressContainer.textContent = address;
        }

        const active = activeWorkersByAddress.get(address) || { count: 0, hashrate: 0 };

        // Last seen: the state is said with a glyph and a word, never by colour alone.
        const hasActiveHashrate = (active.hashrate || 0) > 0;
        let lastSeenText = '-';
        let lastSeenState = '';

        if (hasActiveHashrate) {
            lastSeenText = 'Online';
            lastSeenState = 'ok';
        } else if (miner.lastSeen || miner.lastShare) {
            const timestamp = miner.lastSeen || miner.lastShare;
            let date;
            if (typeof timestamp === 'number') {
                date = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
            } else {
                date = new Date(timestamp);
            }
            if (!isNaN(date.getTime())) {
                const diff = Date.now() - date.getTime();
                if (diff < 60000) {
                    lastSeenText = 'Just now';
                    lastSeenState = 'ok';
                } else if (diff < 3600000) {
                    lastSeenText = Math.floor(diff / 60000) + 'm ago';
                    lastSeenState = 'ok';
                } else if (diff < 86400000) {
                    lastSeenText = Math.floor(diff / 3600000) + 'h ago';
                    lastSeenState = 'warn';
                } else {
                    lastSeenText = Math.floor(diff / 86400000) + 'd ago';
                    lastSeenState = 'bad';
                }
            }
        }
        const glyph = { ok: '● ', warn: '○ ', bad: '○ ' }[lastSeenState] || '';
        const lastSeen = el('span', { className: lastSeenState ? 'state ' + lastSeenState : '' }, [
            glyph ? el('span', { text: glyph, attrs: { 'aria-hidden': 'true' } }) : null,
            lastSeenText
        ]);

        return row([
            cell('address', addressContainer, 'c-address'),
            // Hashrate and workers count only what is connected now.
            cell('hashrate', formatHashrate(active.hashrate || 0), 'r'),
            cell('workers', active.count, 'r'),
            cell('last seen', lastSeen)
        ]);
    });

    tbody.replaceChildren(...rows);
}
