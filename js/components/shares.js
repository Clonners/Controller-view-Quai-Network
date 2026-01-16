/**
 * Shares Component
 * Handles share statistics display and updates
 */

import { AppState } from '../state.js';
import { formatNumber } from '../utils/formatters.js';

/**
 * Update share section from pool stats
 * @param {Object} stats - Pool stats object
 */
export function updateShareSectionFromPoolStats(stats) {
    const totalSharesEl = document.getElementById('totalShares');
    const currentLuck = document.getElementById('currentLuck');
    const luckStatus = document.getElementById('luckStatus');
    const avgSharesPerBlock = document.getElementById('avgSharesPerBlock');
    const lastShareTime = document.getElementById('lastShareTime');
    
    // Calculate total shares
    const validShares = stats.sharesValid || 0;
    const staleShares = stats.sharesStale || 0;
    const invalidShares = stats.sharesInvalid || 0;
    const total = validShares + staleShares + invalidShares;
    
    if (totalSharesEl) {
        totalSharesEl.textContent = formatNumber(total);
    }
    
    // Luck from official /api/pool/shares
    const shareStats = AppState.cache.shareStats;
    if (currentLuck && luckStatus) {
        if (shareStats && shareStats.averageLuck !== undefined) {
            const luckValue = shareStats.averageLuck * 100;
            currentLuck.textContent = `${luckValue.toFixed(1)}%`;
            if (luckValue >= 100) {
                luckStatus.textContent = '🍀 Lucky!';
                luckStatus.style.color = '#4ade80';
            } else if (luckValue >= 80) {
                luckStatus.textContent = '👍 Good';
                luckStatus.style.color = '#ffc107';
            } else {
                luckStatus.textContent = '📉 Below average';
                luckStatus.style.color = '#ff6b6b';
            }
        } else {
            currentLuck.textContent = '-';
            luckStatus.textContent = 'Waiting for share data...';
            luckStatus.style.color = '#9ca3af';
        }
    }
    
    // Average shares per block (from /api/pool/shares if available)
    if (avgSharesPerBlock) {
        if (shareStats && shareStats.blocksFound > 0 && shareStats.totalShares > 0) {
            avgSharesPerBlock.textContent = formatNumber(Math.round(shareStats.totalShares / shareStats.blocksFound));
        } else {
            avgSharesPerBlock.textContent = '-';
        }
    }
    
    // Last share time (from /api/pool/shares)
    if (lastShareTime) {
        const lastShareTs = shareStats?.shares?.[0]?.timestamp;
        if (lastShareTs) {
            const parsed = Date.parse(lastShareTs);
            if (!Number.isNaN(parsed)) {
                lastShareTime.textContent = new Date(parsed).toLocaleString();
                lastShareTime.style.color = '#4ade80';
            } else {
                lastShareTime.textContent = '-';
                lastShareTime.style.color = '';
            }
        } else {
            lastShareTime.textContent = '-';
            lastShareTime.style.color = '';
        }
    }
    
    // Update recent shares display
    renderShareSummary(stats);
}

/**
 * Render share summary
 * @param {Object} stats - Pool stats object
 */
export function renderShareSummary(stats) {
    const container = document.getElementById('sharesHistoryList');
    if (!container) return;
    
    const validShares = stats.sharesValid || 0;
    const staleShares = stats.sharesStale || 0;
    const invalidShares = stats.sharesInvalid || 0;
    
    // Check if we need to update
    const summaryHash = `${validShares}-${staleShares}-${invalidShares}`;
    if (summaryHash === AppState.hashes.shareSummary) return;
    AppState.hashes.shareSummary = summaryHash;
    
    container.innerHTML = '';
    
    if (validShares === 0 && staleShares === 0 && invalidShares === 0) {
        const noShares = document.createElement('div');
        noShares.className = 'share-item no-shares';
        noShares.textContent = 'No shares submitted yet';
        container.appendChild(noShares);
        return;
    }
    
    // Show share breakdown
    const shareTypes = [
        { type: 'valid', count: validShares, label: 'Valid Shares' },
        { type: 'stale', count: staleShares, label: 'Stale Shares' },
        { type: 'invalid', count: invalidShares, label: 'Invalid Shares' }
    ];
    
    shareTypes.forEach(share => {
        if (share.count > 0) {
            const item = document.createElement('div');
            item.className = 'share-item';
            
            const label = document.createElement('span');
            label.className = 'share-label';
            label.textContent = share.label;
            
            const type = document.createElement('span');
            type.className = `share-type ${share.type}`;
            type.textContent = share.type.toUpperCase();
            
            const count = document.createElement('span');
            count.className = 'share-count';
            count.textContent = formatNumber(share.count);
            
            item.appendChild(label);
            item.appendChild(type);
            item.appendChild(count);
            container.appendChild(item);
        }
    });
    
    // Show efficiency rate
    const total = validShares + staleShares + invalidShares;
    if (total > 0) {
        const efficiency = (validShares / total * 100).toFixed(2);
        const effItem = document.createElement('div');
        effItem.className = 'share-item efficiency-row';
        effItem.innerHTML = `
            <span class="share-label">Efficiency Rate</span>
            <span class="share-type ${efficiency >= 99 ? 'valid' : efficiency >= 95 ? 'stale' : 'invalid'}">${efficiency}%</span>
            <span class="share-count">${formatNumber(total)} total</span>
        `;
        container.appendChild(effItem);
    }
}

/**
 * Update share stats from API data
 * @param {Object} data - Share stats data
 */
export function updateShareStats(data) {
    if (!data) return;
    
    // Update cached share stats
    AppState.cache.shareStats = data;
    
    // Update luck display if available
    const luckEl = document.getElementById('currentLuck');
    const luckStatusEl = document.getElementById('luckStatus');
    
    if (luckEl && data.averageLuck !== undefined) {
        const luckValue = data.averageLuck * 100;
        luckEl.textContent = `${luckValue.toFixed(1)}%`;
        
        if (luckStatusEl) {
            if (luckValue >= 100) {
                luckStatusEl.textContent = '🍀 Lucky!';
                luckStatusEl.style.color = '#4ade80';
            } else if (luckValue >= 80) {
                luckStatusEl.textContent = '👍 Good';
                luckStatusEl.style.color = '#ffc107';
            } else {
                luckStatusEl.textContent = '📉 Below average';
                luckStatusEl.style.color = '#ff6b6b';
            }
        }
    }
}
