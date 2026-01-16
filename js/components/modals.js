/**
 * Modals Component
 * Handles modal dialogs (miner stats, search, diagnostics)
 */

import { AppState } from '../state.js';
import { formatHashrate, formatNumber } from '../utils/formatters.js';
import { fetchMinerStats, fetchMinerWorkers } from '../api/poolApi.js';
import { forceRecordAddressHistory } from '../utils/storage.js';

// =====================
// Miner Stats Modal
// =====================

/**
 * Open miner statistics modal
 * @param {string} address - Miner address
 */
export function openMinerModal(address) {
    AppState.ui.currentMinerAddress = address;
    const modal = document.getElementById('minerModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    document.getElementById('modalMinerAddress').textContent = address;
    
    // Reset values
    // Prefer current hashrate from cached workers (real-time), fall back to API
    const currentHashEl = document.getElementById('modalMinerHashrate');
    const cachedWorkers = AppState.cache.workers || [];
    const currentHashrate = cachedWorkers.reduce((sum, w) => {
        try {
            const addr = (w.address || '').toLowerCase();
            if (addr && addr === (address || '').toLowerCase()) {
                return sum + (Number(w.hashrate) || 0);
            }
        } catch (e) {}
        return sum;
    }, 0);
    currentHashEl.textContent = currentHashrate > 0 ? formatHashrate(currentHashrate) : 'Loading...';
    document.getElementById('modalMinerWorkers').textContent = '-';
    document.getElementById('modalMinerValidShares').textContent = '-';
    document.getElementById('modalMinerInvalidShares').textContent = '-';
    document.getElementById('modalMinerStaleShares').textContent = '-';
    document.getElementById('modalMinerBlocks').textContent = '-';
    document.getElementById('modalMinerLastSeen').textContent = '-';
    document.getElementById('modalMinerFirstSeen').textContent = '-';
    document.getElementById('modalMinerLuck').textContent = '-';
    document.getElementById('modalMinerWorkersList').innerHTML = '<div class="miner-worker-item">Loading...</div>';
    
    // Fetch stats from API
    fetchMinerStats(address).then(stats => {
        if (stats) {
            updateMinerModalStats(stats);
        }
    });
    
    // Fetch specific workers for this miner address
    fetchMinerWorkers(address).then(workers => {
        const activeWorkers = (workers || []).filter(w => w.isConnected !== false);
        updateMinerSeenFromWorkers(workers || []);
        if (activeWorkers.length > 0) {
            renderMinerWorkersFromAPI(activeWorkers);
        } else {
            document.getElementById('modalMinerWorkersList').innerHTML = '<div class="miner-worker-item" style="color: #9ca3af; text-align: center;">No worker data</div>';
        }
    }).catch(err => {
        console.error('Failed to fetch miner workers:', err);
        document.getElementById('modalMinerWorkersList').innerHTML = '<div class="miner-worker-item" style="color: #ff6b6b; text-align: center;">Error loading workers</div>';
    });

    // Blocks found from cached pool blocks
    updateMinerBlocksFound(address);
}

/**
 * Update miner modal from API stats
 * @param {Object} stats - Miner stats from API
 */
function updateMinerModalStats(stats) {
    const hashrateFieldsPresent = stats.hashrate !== undefined || stats.hashrateSha !== undefined || stats.hashrateScrypt !== undefined || stats.hashrateKawpow !== undefined;
    if (hashrateFieldsPresent) {
        const totalHashrate = (stats.hashrate ?? 0)
            + (stats.hashrateSha ?? 0)
            + (stats.hashrateScrypt ?? 0)
            + (stats.hashrateKawpow ?? 0);
        // Only set hashrate from API if the modal doesn't already show a current real-time value
        const hrEl = document.getElementById('modalMinerHashrate');
        if (hrEl && (hrEl.textContent === 'Loading...' || hrEl.textContent === '-' )) {
            hrEl.textContent = formatHashrate(totalHashrate);
        }
    }
    
    const workersCount = stats.workersConnected ?? stats.workersTotal ?? stats.workers;
    if (workersCount !== undefined && workersCount !== null) {
        document.getElementById('modalMinerWorkers').textContent = workersCount;
    }
    
    if (stats.validShares !== undefined || stats.sharesValid !== undefined) {
        document.getElementById('modalMinerValidShares').textContent = 
            formatNumber(stats.validShares || stats.sharesValid || 0);
    }
    if (stats.invalidShares !== undefined || stats.sharesInvalid !== undefined) {
        document.getElementById('modalMinerInvalidShares').textContent = 
            formatNumber(stats.invalidShares || stats.sharesInvalid || 0);
    }
    if (stats.staleShares !== undefined || stats.sharesStale !== undefined) {
        document.getElementById('modalMinerStaleShares').textContent = 
            formatNumber(stats.staleShares || stats.sharesStale || 0);
    }
    
    if (stats.blocksFound !== undefined) {
        document.getElementById('modalMinerBlocks').textContent = stats.blocksFound;
    } else {
        updateMinerBlocksFound(AppState.ui.currentMinerAddress);
    }
    
    if (stats.lastSeen) {
        const lastSeenEl = document.getElementById('modalMinerLastSeen');
        lastSeenEl.textContent = new Date(stats.lastSeen).toLocaleString();
        lastSeenEl.style.color = '#4ade80';
    } else {
        document.getElementById('modalMinerLastSeen').textContent = '-';
    }
    
    if (stats.firstSeen) {
        document.getElementById('modalMinerFirstSeen').textContent = 
            new Date(stats.firstSeen).toLocaleString();
    } else {
        document.getElementById('modalMinerFirstSeen').textContent = '-';
    }
    
    // No per-miner luck in official APIs yet
    document.getElementById('modalMinerLuck').textContent = '-';
}

/**
 * Update miner first/last seen from workers list
 * @param {Array} workers - Workers array
 */
function updateMinerSeenFromWorkers(workers) {
    const lastSeenEl = document.getElementById('modalMinerLastSeen');
    const firstSeenEl = document.getElementById('modalMinerFirstSeen');
    if (!lastSeenEl || !firstSeenEl) return;

    if (!workers || workers.length === 0) {
        lastSeenEl.textContent = '-';
        firstSeenEl.textContent = '-';
        return;
    }

    const timestamps = workers.flatMap(w => {
        const first = Date.parse(w.firstShareAt || w.connectedAt || '');
        const last = Date.parse(w.lastShareAt || w.connectedAt || '');
        return [first, last].filter(t => !Number.isNaN(t));
    });

    if (timestamps.length === 0) {
        lastSeenEl.textContent = '-';
        firstSeenEl.textContent = '-';
        return;
    }

    const firstTs = Math.min(...timestamps);
    const lastTs = Math.max(...timestamps);
    firstSeenEl.textContent = new Date(firstTs).toLocaleString();
    lastSeenEl.textContent = new Date(lastTs).toLocaleString();
    lastSeenEl.style.color = '#4ade80';
}

/**
 * Update blocks found for a miner address from cached pool blocks
 * @param {string} address - Miner address
 */
function updateMinerBlocksFound(address) {
    const blocksEl = document.getElementById('modalMinerBlocks');
    if (!blocksEl || !address) return;

    const blocks = AppState.cache.blocks || [];
    if (!Array.isArray(blocks) || blocks.length === 0) {
        blocksEl.textContent = '-';
        return;
    }

    const count = blocks.filter(block => {
        const minerRaw = block.miner || block.worker || '';
        const minerAddress = minerRaw.includes('.') ? minerRaw.split('.')[0] : minerRaw;
        return minerAddress.toLowerCase() === address.toLowerCase();
    }).length;

    blocksEl.textContent = count.toString();
}

/**
 * Render miner workers from API response
 * @param {Array} workers - Workers array from API
 */
function renderMinerWorkersFromAPI(workers) {
    const container = document.getElementById('modalMinerWorkersList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!workers || workers.length === 0) {
        container.innerHTML = '<div class="miner-worker-item" style="color: #9ca3af; text-align: center;">No workers found</div>';
        return;
    }
    
    workers.forEach((worker, index) => {
        const item = document.createElement('div');
        item.className = 'miner-worker-item';
        
        const name = document.createElement('span');
        name.className = 'miner-worker-name';
        name.textContent = worker.name || worker.workerName || worker.worker || `Worker #${index + 1}`;
        
        const hashrate = document.createElement('span');
        hashrate.className = 'miner-worker-hashrate';
        hashrate.textContent = formatHashrate(worker.hashrate || 0);
        
        item.appendChild(name);
        item.appendChild(hashrate);
        container.appendChild(item);
    });
}

/**
 * Close miner modal
 */
export function closeMinerModal() {
    const modal = document.getElementById('minerModal');
    if (modal) {
        modal.style.display = 'none';
    }
    AppState.ui.currentMinerAddress = null;
}

// =====================
// Search Modal
// =====================

/**
 * Open search modal
 */
export function openSearchModal() {
    const modal = document.getElementById('searchModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    const input = document.getElementById('searchModalInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    const results = document.getElementById('searchModalResults');
    if (results) {
        renderAllAddresses(results);
    }
}

/**
 * Close search modal
 */
export function closeSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Search address in modal
 */
export function searchAddressInModal() {
    const input = document.getElementById('searchModalInput');
    const results = document.getElementById('searchModalResults');
    
    if (!input || !results) return;
    
    const query = input.value.trim().toLowerCase();
    
    if (query.length === 0) {
        renderAllAddresses(results);
        return;
    }
    
    const matches = AppState.cache.workers.filter(w => 
        w.address && w.isConnected !== false && w.address.toLowerCase().includes(query)
    );
    
    const addressMap = new Map();
    matches.forEach(w => {
        if (!addressMap.has(w.address)) {
            addressMap.set(w.address, {
                address: w.address,
                hashrate: w.hashrate || 0,
                algorithms: new Set([w.algorithm || '—']),
                count: 1
            });
        } else {
            const existing = addressMap.get(w.address);
            existing.hashrate += w.hashrate || 0;
            existing.count++;
            existing.algorithms.add(w.algorithm || '—');
        }
    });
    const resultsList = Array.from(addressMap.values()).map(entry => {
        const algos = Array.from(entry.algorithms).filter(a => a && a !== '—');
        const algorithm = algos.length === 0 ? '—' : (algos.length === 1 ? algos[0] : 'Mixed');
        return { address: entry.address, hashrate: entry.hashrate, algorithm, count: entry.count };
    });
    
    if (addressMap.size === 0) {
        results.innerHTML = '<div class="search-result-item no-results">No matching addresses found</div>';
        return;
    }
    
    renderAddressResults(results, resultsList);
}

/**
 * Render all connected addresses
 * @param {HTMLElement} container - Container element
 */
function renderAllAddresses(container) {
    container.innerHTML = '';
    
    if (!AppState.cache.workers || AppState.cache.workers.length === 0) {
        container.innerHTML = '<div class="search-result-item no-results">No connected workers</div>';
        return;
    }
    
    const addressMap = new Map();
    AppState.cache.workers.forEach(w => {
        if (!w.address || w.isConnected === false) return;
        
        if (!addressMap.has(w.address)) {
            addressMap.set(w.address, {
                address: w.address,
                hashrate: w.hashrate || 0,
                algorithms: new Set([w.algorithm || '—']),
                count: 1
            });
        } else {
            const existing = addressMap.get(w.address);
            existing.hashrate += w.hashrate || 0;
            existing.count++;
            existing.algorithms.add(w.algorithm || '—');
        }
    });
    
    const resultsList = Array.from(addressMap.values()).map(entry => {
        const algos = Array.from(entry.algorithms).filter(a => a && a !== '—');
        const algorithm = algos.length === 0 ? '—' : (algos.length === 1 ? algos[0] : 'Mixed');
        return { address: entry.address, hashrate: entry.hashrate, algorithm, count: entry.count };
    });
    
    renderAddressResults(container, resultsList);
}

/**
 * Render address search results
 * @param {HTMLElement} container - Container element
 * @param {Array} addresses - Addresses array
 */
function renderAddressResults(container, addresses) {
    container.innerHTML = '';
    
    addresses.forEach(data => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const addressSpan = document.createElement('div');
        addressSpan.className = 'result-address';
        addressSpan.textContent = data.address;
        
        const infoSpan = document.createElement('div');
        infoSpan.className = 'result-info';
        const workersCount = data.count ?? 0;
        infoSpan.innerHTML = `
            <span class="result-hashrate">${formatHashrate(data.hashrate || 0)}</span>
            <span class="result-algo">${data.algorithm || '—'}</span>
            <span class="result-status online">${workersCount} worker${workersCount !== 1 ? 's' : ''}</span>
        `;
        
        item.appendChild(addressSpan);
        item.appendChild(infoSpan);
        
        item.onclick = () => {
            closeSearchModal();
            openMinerModal(data.address);
        };
        
        container.appendChild(item);
    });
}

// =====================
// Block Search Modal
// =====================

/**
 * Open block search modal
 */
export function openBlockSearchModal() {
    const modal = document.getElementById('blockSearchModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    const input = document.getElementById('blockSearchInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    const results = document.getElementById('blockSearchResults');
    if (results) {
        renderBlockAddresses(results);
    }
}

/**
 * Close block search modal
 */
export function closeBlockSearchModal() {
    const modal = document.getElementById('blockSearchModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Search blocks by address
 */
export function searchBlocksByAddress() {
    const input = document.getElementById('blockSearchInput');
    const results = document.getElementById('blockSearchResults');
    
    if (!input || !results) return;
    
    const query = input.value.trim().toLowerCase();
    
    if (query.length === 0) {
        renderBlockAddresses(results);
        return;
    }
    
    // Get addresses from blocks
    const addressMap = new Map();
    if (AppState.cache.blocks && AppState.cache.blocks.length > 0) {
        AppState.cache.blocks.forEach(block => {
            const minerRaw = block.miner || block.worker || '';
            const minerAddress = minerRaw.includes('.') ? minerRaw.split('.')[0] : minerRaw;
            
            if (minerAddress && minerAddress !== '-' && minerAddress.toLowerCase().includes(query)) {
                if (!addressMap.has(minerAddress)) {
                    addressMap.set(minerAddress, {
                        address: minerAddress,
                        blockCount: 0,
                        totalReward: 0,
                        hasReward: false
                    });
                }
                const data = addressMap.get(minerAddress);
                data.blockCount++;
                    const reward = parseFloat(block.reward);
                    if (!Number.isNaN(reward)) {
                        data.totalReward += reward;
                        data.hasReward = true;
                    }
            }
        });
    }
    
    if (addressMap.size === 0) {
        results.innerHTML = '<div class="search-result-item no-results">No matching addresses found</div>';
        return;
    }
    
    renderBlockAddressResults(results, Array.from(addressMap.values()));
}

/**
 * Render all addresses with blocks
 * @param {HTMLElement} container - Container element
 */
function renderBlockAddresses(container) {
    container.innerHTML = '';
    
    if (!AppState.cache.blocks || AppState.cache.blocks.length === 0) {
        container.innerHTML = '<div class="search-result-item no-results">No blocks found yet</div>';
        return;
    }
    
    // Group blocks by address
    const addressMap = new Map();
    AppState.cache.blocks.forEach(block => {
        const minerRaw = block.miner || block.worker || '';
        const minerAddress = minerRaw.includes('.') ? minerRaw.split('.')[0] : minerRaw;
        
        if (minerAddress && minerAddress !== '-') {
            if (!addressMap.has(minerAddress)) {
                addressMap.set(minerAddress, {
                    address: minerAddress,
                    blockCount: 0,
                    totalReward: 0,
                    hasReward: false
                });
            }
            const data = addressMap.get(minerAddress);
            data.blockCount++;
            const reward = parseFloat(block.reward);
            if (!Number.isNaN(reward)) {
                data.totalReward += reward;
                data.hasReward = true;
            }
        }
    });
    
    if (addressMap.size === 0) {
        container.innerHTML = '<div class="search-result-item no-results">No addresses found</div>';
        return;
    }
    
    renderBlockAddressResults(container, Array.from(addressMap.values()));
}

/**
 * Render block address search results
 * @param {HTMLElement} container - Container element
 * @param {Array} addresses - Addresses array with block data
 */
function renderBlockAddressResults(container, addresses) {
    container.innerHTML = '';
    
    // Sort by block count descending
    addresses.sort((a, b) => b.blockCount - a.blockCount);
    
    addresses.forEach(data => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const shortAddr = data.address.length > 20 
            ? data.address.substring(0, 10) + '...' + data.address.substring(data.address.length - 8)
            : data.address;
        
        const addressDiv = document.createElement('div');
        addressDiv.className = 'result-address';
        addressDiv.textContent = shortAddr;
        addressDiv.title = data.address;
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'result-info';
            const rewardHtml = data.hasReward ? `<span class="result-algo">${data.totalReward.toFixed(4)} QUAI</span>` : '';
            infoDiv.innerHTML = `
                <span class="result-hashrate">${data.blockCount} block${data.blockCount !== 1 ? 's' : ''}</span>
                ${rewardHtml}
            `;
        
        item.appendChild(addressDiv);
        item.appendChild(infoDiv);
        
        // Filter blocks by address on click
        item.onclick = () => {
            selectBlockAddressFilter(data.address);
        };
        
        container.appendChild(item);
    });
}

/**
 * Select block address filter
 * @param {string|null} address - Address to filter by or null for all
 */
export function selectBlockAddressFilter(address) {
    AppState.ui.currentBlockAddressFilter = address;
    closeBlockSearchModal();
    
    updateBlockFilterIndicator();
    
    // Import updateBlocks dynamically to avoid circular imports
    import('./blocks.js').then(module => {
        if (AppState.cache.blocks) {
            module.updateBlocks(AppState.cache.blocks);
        }
    });
}

/**
 * Update block filter indicator
 */
export function updateBlockFilterIndicator() {
    const indicator = document.getElementById('blockFilterIndicator');
    if (!indicator) return;
    
    if (AppState.ui.currentBlockAddressFilter) {
        const shortAddr = AppState.ui.currentBlockAddressFilter.length > 16 
            ? AppState.ui.currentBlockAddressFilter.substring(0, 8) + '...' + AppState.ui.currentBlockAddressFilter.substring(AppState.ui.currentBlockAddressFilter.length - 6)
            : AppState.ui.currentBlockAddressFilter;
        
        indicator.innerHTML = `
            <span class="filter-label">Filtering:</span> 
            <span class="filter-address">${shortAddr}</span>
            <button class="clear-filter-btn" onclick="window.selectBlockAddressFilter(null)" title="Clear filter">✕</button>
        `;
        indicator.style.display = 'flex';
    } else {
        indicator.style.display = 'none';
    }
}

// =====================
// Event Listeners
// =====================

/**
 * Initialize modal event listeners
 */
export function initModalEventListeners() {
    // Close modal on clicking outside
    document.addEventListener('click', (e) => {
        const minerModal = document.getElementById('minerModal');
        if (e.target === minerModal) {
            closeMinerModal();
        }
        
        const searchModal = document.getElementById('searchModal');
        if (e.target === searchModal) {
            closeSearchModal();
        }
        
        const blockModal = document.getElementById('blockSearchModal');
        if (e.target === blockModal) {
            closeBlockSearchModal();
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMinerModal();
            closeSearchModal();
            closeBlockSearchModal();
        }
    });
    
    // Make functions available globally
    window.selectBlockAddressFilter = selectBlockAddressFilter;
}
