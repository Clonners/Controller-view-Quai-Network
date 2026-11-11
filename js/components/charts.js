/**
 * Charts Component
 * Handles history series and the share distribution, drawn with characters
 * (no canvas, no chart library).
 */

import { AppState } from '../state.js?v=d689eb0615';
import { formatLabel, formatNumber } from '../utils/formatters.js?v=d689eb0615';
import { el, isNarrow } from '../utils/dom.js?v=d689eb0615';

/**
 * Get period window in milliseconds
 * @param {string} period - '1h', '24h', or '7d'
 * @returns {number} Milliseconds
 */
export function getPeriodWindowMs(period) {
    switch (period) {
        case '24h': return 24 * 60 * 60 * 1000;
        case '7d': return 7 * 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000; // 1h
    }
}

/**
 * Downsample data points for chart display
 * @param {Array} points - Data points
 * @param {string} period - Time period
 * @returns {Array} Downsampled points
 */
export function downsample(points, period) {
    if (!points || points.length === 0) return [];
    
    const windowMs = getPeriodWindowMs(period);
    const cutoff = Date.now() - windowMs;
    const filtered = points.filter(p => p.t >= cutoff);
    
    if (filtered.length <= 30) return filtered;
    
    // Downsample to ~30 points
    const step = Math.ceil(filtered.length / 30);
    const result = [];
    for (let i = 0; i < filtered.length; i += step) {
        result.push(filtered[i]);
    }
    return result;
}

/**
 * Normalize server history data to our format
 * @param {Object} data - Server history data
 * @returns {Object} Normalized history
 */
export function normalizeServerHistory(data) {
    const result = { sha: [], scrypt: [], kawpow: [] };
    
    if (!data) return result;
    
    // Handle different server response formats
    if (Array.isArray(data)) {
        data.forEach(point => {
            const ts = point.timestamp || point.t || point.time;
            const time = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : new Date(ts).getTime();
            
            if (point.sha256 !== undefined || point.sha !== undefined) {
                result.sha.push({ t: time, v: point.sha256 || point.sha || 0 });
            }
            if (point.scrypt !== undefined) {
                result.scrypt.push({ t: time, v: point.scrypt || 0 });
            }
            if (point.kawpow !== undefined || point.progpow !== undefined) {
                result.kawpow.push({ t: time, v: point.kawpow || point.progpow || 0 });
            }
            // If only hashrate is provided, assume kawpow
            if (point.hashrate !== undefined && 
                point.sha256 === undefined && 
                point.scrypt === undefined && 
                point.kawpow === undefined) {
                result.kawpow.push({ t: time, v: point.hashrate });
            }
        });
    } else if (data.history && Array.isArray(data.history)) {
        return normalizeServerHistory(data.history);
    }
    
    return result;
}

/**
 * Build algorithm series data for charts
 * @param {string} period - Time period
 * @param {string|null} filterAddress - Address to filter by
 * @returns {Object} Chart series data
 */
export function buildAlgorithmSeries(period, filterAddress = null) {
    const windowMs = getPeriodWindowMs(period);
    const cutoff = Date.now() - windowMs;
    
    let shaPoints, scryptPoints, kawpowPoints;
    
    if (filterAddress) {
        // Try server history first
        const serverData = AppState.history.serverCache[filterAddress]?.data;
        if (serverData) {
            const normalized = normalizeServerHistory(serverData);
            shaPoints = normalized.sha.filter(p => p.t >= cutoff);
            scryptPoints = normalized.scrypt.filter(p => p.t >= cutoff);
            kawpowPoints = normalized.kawpow.filter(p => p.t >= cutoff);
        }
        
        // Fall back to local history if no server data
        if ((!shaPoints || shaPoints.length === 0) && 
            (!scryptPoints || scryptPoints.length === 0) && 
            (!kawpowPoints || kawpowPoints.length === 0)) {
            const addrHist = AppState.history.address[filterAddress] || { sha: [], scrypt: [], kawpow: [] };
            shaPoints = (addrHist.sha || []).filter(p => p.t >= cutoff);
            scryptPoints = (addrHist.scrypt || []).filter(p => p.t >= cutoff);
            kawpowPoints = (addrHist.kawpow || []).filter(p => p.t >= cutoff);
        }
    } else {
        // Pool-wide history
        shaPoints = AppState.history.chart.sha.filter(p => p.t >= cutoff);
        scryptPoints = AppState.history.chart.scrypt.filter(p => p.t >= cutoff);
        kawpowPoints = AppState.history.chart.kawpow.filter(p => p.t >= cutoff);
    }
    
    // Downsample for display
    shaPoints = downsample(shaPoints, period);
    scryptPoints = downsample(scryptPoints, period);
    kawpowPoints = downsample(kawpowPoints, period);
    
    // Build unified timeline
    const allTimestamps = new Set([
        ...shaPoints.map(p => p.t),
        ...scryptPoints.map(p => p.t),
        ...kawpowPoints.map(p => p.t)
    ]);
    
    const timeline = Array.from(allTimestamps).sort((a, b) => a - b);
    
    // If no data, create dummy timeline
    if (timeline.length === 0) {
        const now = Date.now();
        const step = windowMs / 10;
        for (let t = now - windowMs; t <= now; t += step) {
            timeline.push(t);
        }
    }
    
    // Map values to timeline
    const shaMap = new Map(shaPoints.map(p => [p.t, p.v]));
    const scryptMap = new Map(scryptPoints.map(p => [p.t, p.v]));
    const kawpowMap = new Map(kawpowPoints.map(p => [p.t, p.v]));
    
    return {
        labels: timeline.map(t => formatLabel(t, period)),
        sha: timeline.map(t => shaMap.get(t) || 0),
        scrypt: timeline.map(t => scryptMap.get(t) || 0),
        kawpow: timeline.map(t => kawpowMap.get(t) || 0)
    };
}

/**
 * Update performance chart
 * @param {Object} stats - Pool stats
 */
export function updateCharts(stats) {
    updateAlgorithmChart();
    updateSharesChart(stats);
}

/**
 * Update algorithm hashrate history
 *
 * The page has no element with id "algorithmsChart" (it was already missing
 * before the text rebuild), so this history is recorded but not shown.
 * The series is still built by buildAlgorithmSeries(); drawing it is listed
 * as a suggested improvement, not done here.
 */
function updateAlgorithmChart() {
    const target = document.getElementById('algorithmsChart');
    if (!target) return;
}

// ---------------------
// Share distribution, drawn with characters
// ---------------------

const SHARE_TYPES = [
    { key: 'valid', label: 'valid', field: 'sharesValid' },
    { key: 'stale', label: 'stale', field: 'sharesStale' },
    { key: 'invalid', label: 'invalid', field: 'sharesInvalid' }
];

// Last stats drawn, so the focus buttons and a resize always use current numbers.
let lastSharesStats = null;
let sharesResizeBound = false;

// Columns one row needs to keep name, a 40-cell bar, percentage and count on a line.
const SHARES_WIDE_COLS = 72;
let lastSharesCols = 0;

/** Columns of text the shares block has (a character is half an em wide). */
function sharesColumns(target) {
    const size = parseFloat(getComputedStyle(target).fontSize);
    if (!size || !target.clientWidth) return isNarrow() ? 36 : 81;
    return Math.floor(target.clientWidth / (size / 2) + 0.01);
}

/** Cells of the bar: 40 where the box is wide; in a narrow box, what is left beside name and percentage. */
function sharesBarCells(cols) {
    return cols >= SHARES_WIDE_COLS ? 40 : Math.max(8, Math.min(40, cols - 18));
}

/**
 * Update shares distribution (three rows: name, bar, percentage, count)
 * @param {Object} stats - Pool stats
 */
function updateSharesChart(stats) {
    const target = document.getElementById('sharesChart');
    if (!target) return;

    lastSharesStats = stats || {};
    renderSharesRows();

    if (!AppState.ui.charts.shares) {
        // Same slot the canvas chart used; clearConfig and others only test that it exists.
        AppState.ui.charts.shares = { update: renderSharesRows, destroy() {} };
        createSharesControls();
    }

    // The bar follows the width of its box, so it is drawn again when that changes.
    if (!sharesResizeBound && typeof window !== 'undefined') {
        if (typeof ResizeObserver === 'function') {
            sharesResizeBound = true;
            new ResizeObserver(() => {
                if (sharesColumns(target) !== lastSharesCols) renderSharesRows();
            }).observe(target);
        } else if (window.matchMedia) {
            sharesResizeBound = true;
            const mq = window.matchMedia('(max-width: 59.99em)');
            const onChange = () => renderSharesRows();
            if (mq.addEventListener) mq.addEventListener('change', onChange);
            else if (mq.addListener) mq.addListener(onChange);
        }
    }
}

/** Draw the three rows from the last stats and the current focus. */
function renderSharesRows() {
    const target = document.getElementById('sharesChart');
    if (!target || !lastSharesStats) return;

    const values = SHARE_TYPES.map(t => Number(lastSharesStats[t.field]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const filter = AppState.ui.currentSharesFilter;
    const cols = sharesColumns(target);
    const cells = sharesBarCells(cols);
    lastSharesCols = cols;
    target.classList.toggle('wide', cols >= SHARES_WIDE_COLS);

    const rows = SHARE_TYPES.map((t, i) => {
        const value = values[i];
        const share = total > 0 ? value / total : 0;
        // A focused category keeps its bar; the others are emptied (the numbers stay).
        const dimmed = !!filter && filter !== t.key;
        let filled = dimmed ? 0 : Math.round(share * cells);
        if (!dimmed && value > 0 && filled === 0) filled = 1;

        const bar = el('span', { className: 'bar', attrs: { 'aria-hidden': 'true' } }, [
            el('span', { className: 'bar-on', text: '\u2588'.repeat(filled) }),
            el('span', { className: 'bar-off', text: '\u2591'.repeat(cells - filled) })
        ]);

        return el('div', {
            className: 'share-row share-' + t.key + (dimmed ? ' dim' : '') + (filter === t.key ? ' focus' : ''),
            attrs: { role: 'listitem' }
        }, [
            el('span', { className: 'share-label', text: t.label }),
            bar,
            el('span', { className: 'share-pct', text: total > 0 ? (share * 100).toFixed(2) + ' %' : '-' }),
            el('span', { className: 'share-count', text: formatNumber(value) })
        ]);
    });

    target.replaceChildren(...rows);
}

/**
 * Create toggle controls under the shares rows to focus on a single category.
 * Pressing a button keeps only that category's bar (pressing it again resets).
 */
function createSharesControls() {
    const container = document.getElementById('sharesControls');
    if (!container) return;
    container.replaceChildren();

    const activeFilter = AppState.ui.currentSharesFilter;
    SHARE_TYPES.forEach(t => {
        const btn = el('button', {
            className: 'btn toggle-btn' + (activeFilter === t.key ? ' active' : ''),
            text: t.label,
            attrs: { type: 'button', 'data-type': t.key, 'aria-pressed': activeFilter === t.key ? 'true' : 'false' }
        });

        btn.addEventListener('click', () => {
            const wasActive = (AppState.ui.currentSharesFilter === t.key);
            // toggle filter in AppState (null => no filter)
            AppState.ui.currentSharesFilter = wasActive ? null : t.key;

            // Update button states
            document.querySelectorAll('#sharesControls .toggle-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            if (!wasActive) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            }

            renderSharesRows();
        });

        container.appendChild(btn);
    });
}

/**
 * Update chart period
 * @param {Event} event - Click event
 * @param {string} period - New period
 */
export function updateChartPeriod(event, period) {
    if (event) event.preventDefault();
    AppState.ui.currentChartPeriod = period;
    
    // Update button states
    document.querySelectorAll('.chart-control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Trigger chart update
    if (AppState.connection.isConnected && AppState.cache.poolStats) {
        updateCharts(AppState.cache.poolStats);
    }
}
