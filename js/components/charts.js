/**
 * Charts Component
 * Handles chart initialization, updates, and history visualization
 */

import { AppState, Constants } from '../state.js';
import { formatHashrate, formatLabel, formatNumber } from '../utils/formatters.js';

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
 * Update algorithm hashrate line chart
 */
function updateAlgorithmChart() {
    const algoCtx = document.getElementById('algorithmsChart');
    if (!algoCtx) return;
    
    const series = buildAlgorithmSeries(
        AppState.ui.currentChartPeriod, 
        AppState.ui.currentPerformanceFilter
    );
    
    const algorithmData = {
        labels: series.labels,
        datasets: [
            {
                label: 'SHA-256',
                data: series.sha,
                borderColor: '#ff253a',
                backgroundColor: 'rgba(255, 37, 58, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                pointBackgroundColor: '#ff253a',
                pointBorderColor: 'rgba(15, 5, 10, 0.8)',
                pointBorderWidth: 1
            },
            {
                label: 'Scrypt',
                data: series.scrypt,
                borderColor: '#ff6b81',
                backgroundColor: 'rgba(255, 107, 129, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                pointBackgroundColor: '#ff6b81',
                pointBorderColor: 'rgba(15, 5, 10, 0.8)',
                pointBorderWidth: 1
            },
            {
                label: 'KawPoW',
                data: series.kawpow,
                borderColor: '#ff94b2',
                backgroundColor: 'rgba(255, 148, 178, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                pointBackgroundColor: '#ff94b2',
                pointBorderColor: 'rgba(15, 5, 10, 0.8)',
                pointBorderWidth: 1
            }
        ]
    };
    
    if (AppState.ui.charts.algorithms) {
        AppState.ui.charts.algorithms.data.labels = algorithmData.labels;
        AppState.ui.charts.algorithms.data.datasets[0].data = algorithmData.datasets[0].data;
        AppState.ui.charts.algorithms.data.datasets[1].data = algorithmData.datasets[1].data;
        AppState.ui.charts.algorithms.data.datasets[2].data = algorithmData.datasets[2].data;
        AppState.ui.charts.algorithms.update('none');
    } else {
        AppState.ui.charts.algorithms = new Chart(algoCtx, {
            type: 'line',
            data: algorithmData,
            options: getChartOptions()
        });
    }
}

/**
 * Update shares doughnut chart
 * @param {Object} stats - Pool stats
 */
function updateSharesChart(stats) {
    const sharesCtx = document.getElementById('sharesChart');
    if (!sharesCtx) return;
    
    const sharesData = {
        labels: ['Valid', 'Stale', 'Invalid'],
        datasets: [{
            label: 'Shares',
            data: [
                stats.sharesValid || 0,
                stats.sharesStale || 0,
                stats.sharesInvalid || 0
            ],
            backgroundColor: [
                'rgba(74, 222, 128, 0.7)',
                'rgba(245, 158, 11, 0.7)',
                'rgba(255, 75, 75, 0.7)'
            ],
            borderColor: ['#4ade80', '#f59e0b', '#ff4b4b'],
            borderWidth: 1
        }]
    };
    
    // Create gradients for a nicer look
    const ctx = sharesCtx.getContext('2d');
    const g0 = ctx.createLinearGradient(0,0,0,sharesCtx.height || 300);
    g0.addColorStop(0, 'rgba(102, 252, 179, 0.95)');
    g0.addColorStop(1, 'rgba(20, 160, 95, 0.85)');
    const g1 = ctx.createLinearGradient(0,0,0,sharesCtx.height || 300);
    g1.addColorStop(0, 'rgba(255, 200, 120, 0.95)');
    g1.addColorStop(1, 'rgba(220, 120, 10, 0.85)');
    const g2 = ctx.createLinearGradient(0,0,0,sharesCtx.height || 300);
    g2.addColorStop(0, 'rgba(255, 140, 140, 0.95)');
    g2.addColorStop(1, 'rgba(200, 60, 60, 0.85)');

    sharesData.datasets[0].backgroundColor = [g0, g1, g2];
    // Disable hover expansion and hover borders so arcs remain whole on mouseover
    sharesData.datasets[0].hoverOffset = 0;
    sharesData.datasets[0].hoverBorderWidth = 0;
    sharesData.datasets[0].borderRadius = 0; // no rounded edges to avoid visible seams
    sharesData.datasets[0].borderWidth = 0; // remove borders between segments
    sharesData.datasets[0].spacing = 0; // ensure no spacing between arcs
    sharesData.datasets[0].cutout = '50%'; // smaller cutout => thicker/wider ring

    if (AppState.ui.charts.shares) {
        // Respect any active shares filter so periodic updates don't undo the user's focus
        const chart = AppState.ui.charts.shares;
        const original = sharesData.datasets[0].data.slice();
        const filter = AppState.ui.currentSharesFilter;
        let applied = original;
        if (filter) {
            const idx = filter === 'valid' ? 0 : filter === 'stale' ? 1 : 2;
                applied = original.map((v, i) => (i === idx ? v : 0));
        }
        chart.data.datasets[0].data = applied;
        chart.update({duration: 600, easing: 'easeOutQuart'});
    } else {
        AppState.ui.charts.shares = new Chart(sharesCtx, {
            type: 'doughnut',
            data: sharesData,
            options: Object.assign({}, getDoughnutOptions(), {
                cutout: '50%',
                animation: { animateRotate: true, duration: 700, easing: 'easeOutQuart' }
            })
        });

        // Create custom controls for toggling focus
        createSharesControls(stats);
    }
}

/**
 * Create toggle controls under the shares chart to focus on a single category.
 * Clicking a button will animate chart composition to show only that category (or reset).
 */
function createSharesControls(stats) {
    const container = document.getElementById('sharesControls');
    if (!container) return;
    container.innerHTML = '';

    const types = [
        { key: 'valid', label: 'Valid', valueIndex: 0 },
        { key: 'stale', label: 'Stale', valueIndex: 1 },
        { key: 'invalid', label: 'Invalid', valueIndex: 2 }
    ];

    const activeFilter = AppState.ui.currentSharesFilter;
    types.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'toggle-btn';
        btn.setAttribute('data-type', t.key);
        btn.innerHTML = `<span class="dot"></span><span>${t.label}</span>`;

        // initialize active state from AppState
        if (activeFilter === t.key) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            const wasActive = (AppState.ui.currentSharesFilter === t.key);
            // toggle filter in AppState (null => no filter)
            AppState.ui.currentSharesFilter = wasActive ? null : t.key;

            // Update button classes
            document.querySelectorAll('#sharesControls .toggle-btn').forEach(b => b.classList.remove('active'));
            if (!wasActive) btn.classList.add('active');

            const chart = AppState.ui.charts.shares;
            if (!chart) return;

            const original = [stats.sharesValid || 0, stats.sharesStale || 0, stats.sharesInvalid || 0];
            let newData = original;
            const filterNow = AppState.ui.currentSharesFilter;
            if (filterNow) {
                const idx = filterNow === 'valid' ? 0 : filterNow === 'stale' ? 1 : 2;
                    newData = original.map((v, i) => (i === idx ? v : 0));
            }

            chart.data.datasets[0].data = newData;
            chart.update({duration: 700, easing: 'easeOutQuart'});
        });

        container.appendChild(btn);
    });
}

/**
 * Get line chart options
 * @returns {Object} Chart.js options
 */
function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                display: false,
                position: 'bottom',
                labels: {
                    color: '#9ca3af',
                    font: { size: 11, family: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
                    padding: 12,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(7, 3, 6, 0.95)',
                titleColor: '#e5e7eb',
                bodyColor: '#9ca3af',
                borderColor: 'rgba(255, 37, 58, 0.3)',
                borderWidth: 1,
                titleFont: { size: 12, weight: 600 },
                bodyFont: { size: 11 },
                padding: 10,
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ' + formatHashrate(context.raw);
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 37, 58, 0.1)', drawBorder: false },
                ticks: {
                    color: '#9ca3af',
                    font: { size: 10 },
                    callback: function(value) { return formatHashrate(value); }
                }
            },
            x: {
                grid: { color: 'rgba(255, 37, 58, 0.05)', drawBorder: false },
                ticks: { color: '#9ca3af', font: { size: 10 } }
            }
        }
    };
}

/**
 * Get doughnut chart options
 * @returns {Object} Chart.js options
 */
function getDoughnutOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        elements: {
            arc: {
                borderWidth: 0
            }
        },
        plugins: {
            legend: {
                display: false,
                position: 'bottom',
                labels: {
                    color: '#9ca3af',
                    font: { size: 11, family: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
                    padding: 12,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(7, 3, 6, 0.95)',
                titleColor: '#e5e7eb',
                bodyColor: '#9ca3af',
                borderColor: 'rgba(255, 37, 58, 0.3)',
                borderWidth: 1,
                titleFont: { size: 12, weight: 600 },
                bodyFont: { size: 11 },
                padding: 10,
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        return context.label + ': ' + formatNumber(context.raw);
                    }
                }
            }
        }
    };
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
