/**
 * Blocks Component
 * Handles blocks table display and updates
 */

import { AppState } from '../state.js?v=d689eb0615';
import { el, cell, row, messageRow, button, shortAddress, copyWithFeedback } from '../utils/dom.js?v=d689eb0615';

const BLOCK_COLS = 4;

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
        messageRow(tbody, BLOCK_COLS, 'No blocks found yet');
        return;
    }

    // Build table rows
    const rows = displayBlocks.map((block) => {
        // HEIGHT
        const height = el('span', { className: 'block-height', text: '#' + (block.height || '-') });

        // HASH (truncated with copy button)
        const fullHash = block.hash || '-';
        const shortHash = fullHash.length > 12 ? fullHash.substring(0, 8) : fullHash;
        const hashContainer = el('span', { className: 'hash-cell' }, [
            el('code', { text: shortHash, title: fullHash })
        ]);
        if (fullHash !== '-') {
            const copyBtn = button('copy', () => copyWithFeedback(fullHash, copyBtn), {
                className: 'btn-copy',
                title: 'Copy full hash',
                attrs: { 'aria-label': 'Copy full hash of block ' + (block.height || '') }
            });
            hashContainer.appendChild(copyBtn);
        }

        // FOUND BY (miner address with worker name)
        const minerRaw = block.miner || block.worker || '-';
        const minerAddress = minerRaw.includes('.') ? minerRaw.split('.')[0] : minerRaw;
        const workerName = minerRaw.includes('.') ? '.' + minerRaw.split('.').slice(1).join('.') : '';

        let foundBy;
        if (minerAddress !== '-') {
            foundBy = el('span', { className: 'found-by' }, [
                el('span', {
                    className: 'found-by-address',
                    text: minerAddress.length > 16 ? shortAddress(minerAddress) : minerAddress,
                    title: minerAddress
                }),
                workerName ? el('span', { className: 'found-by-worker', text: workerName }) : null
            ]);
        } else {
            foundBy = '-';
        }

        // TIME (if available)
        let ts = null;
        if (block.timestamp) {
            ts = block.timestamp > 1e12 ? block.timestamp : block.timestamp * 1000;
        } else if (block.foundAt) {
            const parsed = Date.parse(block.foundAt);
            if (!Number.isNaN(parsed)) ts = parsed;
        }

        return row([
            cell('height', height, 'c-height'),
            cell('hash', hashContainer),
            cell('found by', foundBy),
            cell('found at', ts ? new Date(ts).toLocaleString() : '-', 'c-time')
        ]);
    });

    tbody.replaceChildren(...rows);
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
    // (The page has no elements with these ids today, so nothing is shown: see MEJORAS.)
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
