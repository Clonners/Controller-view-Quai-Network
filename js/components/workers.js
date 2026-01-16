/**
 * Workers Component
 * Handles worker table display and updates
 */

import { AppState } from '../state.js';
import { formatHashrate } from '../utils/formatters.js';
import { fetchAllMiners } from '../api/poolApi.js';

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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No connected workers</td></tr>';
        return;
    }
    
    // Build DOM safely
    const rows = workersData.map(worker => {
        const tr = document.createElement('tr');
        
        // Address column
        const td1 = document.createElement('td');
        const span = document.createElement('span');
        span.className = 'worker-name clickable-address';
        const fullAddress = worker.address || '-';
        const addrShort = (fullAddress && fullAddress.length > 16)
            ? (fullAddress.substring(0, 8) + '...' + fullAddress.substring(fullAddress.length - 6))
            : fullAddress;
        // Show abbreviated address only on small screens
        span.textContent = (typeof window !== 'undefined' && window.innerWidth <= 768) ? addrShort : fullAddress;
        span.title = 'Click to view miner details';
        span.onclick = () => {
            if (worker.address && onMinerClick) {
                onMinerClick(worker.address);
            }
        };
        td1.appendChild(span);
        
        // Worker name column
        const td2 = document.createElement('td');
        const workerName = worker.name || worker.workerName || worker.worker || worker.rigName || worker.rig || null;
        td2.textContent = workerName || '1';
        
        // Algorithm column
        const td3 = document.createElement('td');
        const algoRaw = (worker.algorithm || '').toLowerCase();
        let algoLabel = '—';
        if (algoRaw.includes('kawpow') || algoRaw.includes('progpow')) {
            algoLabel = 'kawpow';
        } else if (algoRaw.includes('sha256') || algoRaw === 'sha' || algoRaw === 'sha-256') {
            algoLabel = 'sha256';
        } else if (algoRaw.includes('scrypt')) {
            algoLabel = 'scrypt';
        }
        td3.textContent = algoLabel;
        
        // Hashrate column
        const td4 = document.createElement('td');
        td4.textContent = formatHashrate(worker.hashrate);
        
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        
        return tr;
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
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
            const tbody = document.getElementById('minersBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No miners data from API</td></tr>';
            }
        }
    } catch (e) {
        console.error('Failed to fetch miners from API:', e);
        const tbody = document.getElementById('minersBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff6b6b;">Error loading miners from API</td></tr>';
        }
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No miners found</td></tr>';
        if (countEl) countEl.textContent = '0 miners';
        return;
    }
    
    if (countEl) countEl.textContent = `${miners.length} miner${miners.length !== 1 ? 's' : ''}`;
    
    // Build table rows
    tbody.innerHTML = '';
    miners.forEach(miner => {
        const row = document.createElement('tr');
        
        // Address cell
        const addressCell = document.createElement('td');
        const addressContainer = document.createElement('div');
        addressContainer.className = 'miner-address-cell';
        
        const address = miner.address || miner.miner || '-';
        const addressShort = address.length > 16 
            ? address.substring(0, 8) + '...' + address.substring(address.length - 6) 
            : address;
        
        if (address !== '-') {
            const addressLink = document.createElement('a');
            addressLink.href = '#';
            // Show abbreviated address only on small screens
            addressLink.textContent = (typeof window !== 'undefined' && window.innerWidth <= 768) ? addressShort : address;
            addressLink.title = address;
            addressLink.onclick = (e) => {
                e.preventDefault();
                if (onMinerClick) onMinerClick(address);
            };
            addressContainer.appendChild(addressLink);
        } else {
            addressContainer.textContent = address;
        }
        addressCell.appendChild(addressContainer);
        row.appendChild(addressCell);
        
        const active = activeWorkersByAddress.get(address) || { count: 0, hashrate: 0 };
        
        // Hashrate cell (active only)
        const hashrateCell = document.createElement('td');
        hashrateCell.textContent = formatHashrate(active.hashrate || 0);
        hashrateCell.style.color = '#4ade80';
        row.appendChild(hashrateCell);
        
        // Workers cell (active only)
        const workersCell = document.createElement('td');
        workersCell.textContent = active.count;
        row.appendChild(workersCell);
        
        // Last seen cell
        const lastSeenCell = document.createElement('td');
        const hasActiveHashrate = (active.hashrate || 0) > 0;
        
        if (hasActiveHashrate) {
            lastSeenCell.textContent = 'Online';
            lastSeenCell.style.color = '#4ade80';
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
                    lastSeenCell.textContent = 'Just now';
                    lastSeenCell.style.color = '#4ade80';
                } else if (diff < 3600000) {
                    lastSeenCell.textContent = Math.floor(diff / 60000) + 'm ago';
                    lastSeenCell.style.color = '#4ade80';
                } else if (diff < 86400000) {
                    lastSeenCell.textContent = Math.floor(diff / 3600000) + 'h ago';
                    lastSeenCell.style.color = '#ff9800';
                } else {
                    lastSeenCell.textContent = Math.floor(diff / 86400000) + 'd ago';
                    lastSeenCell.style.color = '#ff4b4b';
                }
            } else {
                lastSeenCell.textContent = '-';
            }
        } else {
            lastSeenCell.textContent = '-';
        }
        row.appendChild(lastSeenCell);
        
        tbody.appendChild(row);
    });
}
