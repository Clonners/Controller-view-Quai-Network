/**
 * Blocks Component
 * Handles blocks table display and updates
 */

import { AppState } from '../state.js';
import { formatNumber } from '../utils/formatters.js';

/**
 * Update blocks table
 * @param {Array} blocksData - Blocks array
 */
export function updateBlocks(blocksData) {
    const tbody = document.getElementById('blocksTableBody');
    
    if (!tbody) return;
    
    // Check if blocks or filter changed to prevent flickering
    const blocksHash = JSON.stringify({
        blocks: blocksData?.map(b => b.hash || b.blockHash) || [],
        filter: AppState.ui.currentBlockAddressFilter
    });
    if (blocksHash === AppState.hashes.blocks) return;
    AppState.hashes.blocks = blocksHash;
    
    // Filter blocks by address if filter is set
    let displayBlocks = blocksData || [];
    if (AppState.ui.currentBlockAddressFilter) {
        displayBlocks = displayBlocks.filter(block => {
            const minerRaw = block.miner || block.worker || '';
            const minerAddress = minerRaw.includes('.') ? minerRaw.split('.')[0] : minerRaw;
            return minerAddress.toLowerCase() === AppState.ui.currentBlockAddressFilter.toLowerCase();
        });
    }
    
    if (!displayBlocks || displayBlocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No blocks found yet</td></tr>';
        return;
    }
    
    // Build table rows
    tbody.innerHTML = '';
    displayBlocks.forEach((block) => {
        const row = document.createElement('tr');
        
        // HEIGHT
        const heightCell = document.createElement('td');
        heightCell.innerHTML = `<span style="color: #4ade80; font-weight: 600;">#${block.height || '-'}</span>`;
        row.appendChild(heightCell);
        
        // HASH (truncated with copy button)
        const hashCell = document.createElement('td');
        const fullHash = block.hash || '-';
        const shortHash = fullHash.length > 12 ? fullHash.substring(0, 8) : fullHash;
        const hashContainer = document.createElement('div');
        hashContainer.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        
        const hashCode = document.createElement('code');
        hashCode.style.cssText = 'color: #667eea; font-size: 12px;';
        hashCode.textContent = shortHash;
        hashCode.title = fullHash;
        hashContainer.appendChild(hashCode);
        
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '📋';
        copyBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px;';
        copyBtn.title = 'Copy full hash';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(fullHash);
            copyBtn.innerHTML = '✓';
            setTimeout(() => copyBtn.innerHTML = '📋', 1500);
        };
        hashContainer.appendChild(copyBtn);
        hashCell.appendChild(hashContainer);
        row.appendChild(hashCell);
        
        // FOUND BY (miner address with worker name)
        const minerCell = document.createElement('td');
        const minerRaw = block.miner || block.worker || '-';
        const minerAddress = minerRaw.includes('.') ? minerRaw.split('.')[0] : minerRaw;
        const workerName = minerRaw.includes('.') ? '.' + minerRaw.split('.').slice(1).join('.') : '';
        
        if (minerAddress !== '-') {
            const minerSpan = document.createElement('span');
            minerSpan.style.cssText = 'color: #667eea;';
            
            const shortAddr = minerAddress.length > 16 
                ? minerAddress.substring(0, 8) + '...' + minerAddress.slice(-6) 
                : minerAddress;
            minerSpan.textContent = shortAddr;
            minerSpan.title = minerAddress;
            minerCell.appendChild(minerSpan);
            
            if (workerName) {
                const workerSpan = document.createElement('span');
                workerSpan.style.cssText = 'color: #9ca3af; font-size: 11px; margin-left: 4px;';
                workerSpan.textContent = workerName;
                minerCell.appendChild(workerSpan);
            }
        } else {
            minerCell.textContent = '-';
        }
        row.appendChild(minerCell);
        
        // TIME (if available)
        const timeCell = document.createElement('td');
        let ts = null;
        if (block.timestamp) {
            ts = block.timestamp > 1e12 ? block.timestamp : block.timestamp * 1000;
        } else if (block.foundAt) {
            const parsed = Date.parse(block.foundAt);
            if (!Number.isNaN(parsed)) ts = parsed;
        }
        if (ts) {
            const date = new Date(ts);
            timeCell.textContent = date.toLocaleString();
            timeCell.style.color = '#9ca3af';
            timeCell.style.fontSize = '12px';
        } else {
            timeCell.textContent = '-';
        }
        row.appendChild(timeCell);
        
        tbody.appendChild(row);
    });
}

/**
 * Update quick stats based on period
 * @param {Array} blocksData - Blocks array
 */
export function updateQuickStats(blocksData) {
    // Cache blocks data
    if (blocksData && blocksData.length > 0) {
        AppState.cache.blocks = blocksData;
    }
    
    const now = Date.now();
    let periodMs, periodLabel;
    
    switch (AppState.ui.currentStatsPeriod) {
        case '1h':
            periodMs = 60 * 60 * 1000;
            periodLabel = '1 hour';
            break;
        case '24h':
            periodMs = 24 * 60 * 60 * 1000;
            periodLabel = '24 hours';
            break;
        case '7d':
            periodMs = 7 * 24 * 60 * 60 * 1000;
            periodLabel = '7 days';
            break;
        default:
            periodMs = 60 * 60 * 1000;
            periodLabel = '1 hour';
    }
    
    // Filter blocks by timestamp within period
    const blocksInPeriod = AppState.cache.blocks.filter(block => {
        let blockTime = null;
        if (block.timestamp) {
            blockTime = block.timestamp > 1e12 ? block.timestamp : block.timestamp * 1000;
        } else if (block.foundAt) {
            const parsed = Date.parse(block.foundAt);
            if (!Number.isNaN(parsed)) blockTime = parsed;
        }
        if (!blockTime) return false;
        return (now - blockTime) <= periodMs;
    });
    
    // Calculate totals
    const blockCount = blocksInPeriod.length;
    const hasReward = blocksInPeriod.some(block => block.reward !== undefined && block.reward !== null && block.reward !== '');
    const totalReward = hasReward ? blocksInPeriod.reduce((sum, block) => {
        return sum + parseFloat(block.reward || 0);
    }, 0) : null;
    const avgReward = (hasReward && blockCount > 0) ? (totalReward / blockCount) : null;
    
    // Update UI
    const quaiEarnedEl = document.getElementById('quaiEarned');
    const blocksInPeriodEl = document.getElementById('blocksInPeriod');
    const avgBlockRewardEl = document.getElementById('avgBlockReward');
    const earningsPeriodEl = document.getElementById('earningsPeriod');
    const blocksPeriodEl = document.getElementById('blocksPeriod');
    const avgRewardPeriodEl = document.getElementById('avgRewardPeriod');
    
    if (quaiEarnedEl) quaiEarnedEl.textContent = totalReward === null ? '-' : `${totalReward.toFixed(4)} QUAI`;
    if (blocksInPeriodEl) blocksInPeriodEl.textContent = blockCount.toString();
    if (avgBlockRewardEl) avgBlockRewardEl.textContent = avgReward === null ? '-' : `${avgReward.toFixed(4)} QUAI`;
    if (earningsPeriodEl) earningsPeriodEl.textContent = periodLabel;
    if (blocksPeriodEl) blocksPeriodEl.textContent = periodLabel;
    if (avgRewardPeriodEl) avgRewardPeriodEl.textContent = periodLabel;
}

/**
 * Set stats period
 * @param {string} period - New period
 */
export function setStatsPeriod(period) {
    AppState.ui.currentStatsPeriod = period;
    
    // Update button states
    const periodLabels = { '1h': '1 Hour', '24h': '24 Hours', '7d': '7 Days' };
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === periodLabels[period]);
    });
    
    // Recalculate with cached data
    updateQuickStats(AppState.cache.blocks);
}
