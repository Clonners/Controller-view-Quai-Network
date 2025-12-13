// main.js — extracted from index.html
const alphaCtrl = 0.001; // controller α for kQuai

const rpcUrlInput   = document.getElementById("rpc-url") || { value: 'http://181.99.245.152:9001' };
const windowInput   = document.getElementById("window") || { value: '4000' };
const chunkInput    = document.getElementById("chunk") || { value: '200' };
const alphaSelect   = document.getElementById("alpha") || { value: '4000' };
const refreshBtn    = document.getElementById("refresh-btn");
const autoBtn       = document.getElementById("auto-btn");
const connDot       = document.getElementById("conn-dot");
const connLabel     = document.getElementById("conn-label");
// Status elements: `conn-dot` and `conn-label`
const statusDot     = document.getElementById("status-dot");
const statusText    = document.getElementById("status-text");

const metricBlock      = document.getElementById("metric-block");
const metricTs         = document.getElementById("metric-ts");
const metricSideDot    = document.getElementById("metric-side-dot");
const metricSide       = document.getElementById("metric-side");

const metricRatio      = document.getElementById("metric-ratio");
const metricRatioBadge = document.getElementById("metric-ratio-badge");
const metricRatioText  = document.getElementById("metric-ratio-text");
const metricRatioDot   = document.getElementById("metric-ratio-dot");
const metricRatioSide  = document.getElementById("metric-ratio-side");

const metricExrate     = document.getElementById("metric-exrate");
const metricExrateHex  = document.getElementById("metric-exrate-hex");

const metricDk         = document.getElementById("metric-dk");
const metricDkText     = document.getElementById("metric-dk-text");
const metricDkDot      = document.getElementById("metric-dk-dot");
const metricDkSide     = document.getElementById("metric-dk-side");

const timeframeButtons = document.querySelectorAll(".tf-btn");
const donationPill     = document.getElementById("donation-pill");
const donationAddress  = "0x0042843bC5C3fcAFda51d2c6BB17d47370567C9a";

let autoInterval = null;
let chart = null;
let currentSeries = []; // holds the in-memory series used for incremental updates

// Update UI (chart + metrics) from a full `series` array
async function updateUIFromSeries(series, chunkSizePrime, url) {
  const labels = [];
  const dValues = [];
  const dStarValues = [];
  const dkValues = [];

  for (let i = 0; i < series.length; i += chunkSizePrime) {
    const chunk = series.slice(i, i + chunkSizePrime);
    if (!chunk.length) continue;
    const firstPrime = chunk[0].primeNum;
    const lastPrime = chunk[chunk.length - 1].primeNum;
    labels.push(`${firstPrime}–${lastPrime}`);

    const avgD = avgDec(chunk.map(x => x.dInstant));
    const avgDStar = avgDec(chunk.map(x => x.dStar));
    const avgDk = avgDec(chunk.map(x => x.deltaK));

    dValues.push(avgD);
    dStarValues.push(avgDStar);
    dkValues.push(avgDk);
  }

  const dValuesNum = dValues.map(v => v.toNumber());
  const dStarValuesNum = dStarValues.map(v => v.toNumber());
  const dkValuesNum = dkValues.map(v => v.times(100).toNumber());

  renderChart(labels, dValuesNum, dStarValuesNum, dkValuesNum);

  // Update latest metrics using latest series entry and fetch last header + exchange rate
  const lastEntry = series[series.length - 1] || {};
  const lastPrimeNum = lastEntry.primeNum || null;

  try {
    const convElem = document.getElementById('metric-conv-count');
    const noteElem = document.getElementById('metric-nearest-block-note');
    if (convElem) convElem.textContent = '0';
    if (noteElem) noteElem.textContent = 'no ETX';
  } catch (e) {}

  if (lastPrimeNum !== null) {
    metricBlock.textContent = lastPrimeNum.toLocaleString('en-US');

    // try to fetch last header for timestamp and exchangeRate fallback
    let lastPrimeHeader = null;
    try {
      lastPrimeHeader = await rpcCall(url, 'quai_getHeaderByNumber', ['0x' + lastPrimeNum.toString(16)], { timeout: 12000, retries: 0 });
    } catch (e) { lastPrimeHeader = null; }

    const tsHex = (lastPrimeHeader && lastPrimeHeader.woHeader && lastPrimeHeader.woHeader.timestamp) || (lastPrimeHeader && lastPrimeHeader.timestamp) || null;
    const ts = tsHex ? new Date(hexToInt(tsHex) * 1000) : null;
    metricTs.textContent = ts ? 'timestamp: ' + ts.toLocaleString('en-US') : 'timestamp: –';

    const lastRatio = lastEntry.ratio || new Decimal(1);
    const lastDeltaK = lastEntry.deltaK || new Decimal(0);

    metricRatio.textContent = formatNumber(lastRatio, 4);
    const ratioOne = new Decimal(1);
    metricRatioBadge.textContent = lastRatio.gt(ratioOne) ? 'pro-Qi' : lastRatio.lt(ratioOne) ? 'pro-Quai' : 'neutral';
    metricRatioText.textContent = lastRatio.gt(ratioOne) ? 'FX (Prime) favors Qi (d* > d).' : lastRatio.lt(ratioOne) ? 'FX (Prime) favors Quai (d* < d).' : 'FX roughly neutral (d* ≈ d).';
    metricRatioDot.style.background = lastRatio.gte(ratioOne) ? '#4ade80' : '#f97373';
    metricRatioSide.textContent = lastRatio.gt(ratioOne) ? 'FX (Prime) pro-Qi' : lastRatio.lt(ratioOne) ? 'FX (Prime) pro-Quai' : 'Approximate equilibrium';

    // Exchange rate (prefer canonical RPC)
    let rate = null;
    try {
      const oneQiInQits = '0x3e8';
      const qiToQuaiHex = await rpcCall(url, 'quai_qiToQuai', [oneQiInQits, 'latest'], { timeout: 10000, retries: 1 });
      if (qiToQuaiHex) {
        const amountWei = hexToBigInt(qiToQuaiHex);
        if (amountWei > 0n) rate = formatWeiToQuai(amountWei, amountWei < 10n ** 18n ? 8 : 6);
      }
    } catch (e) { /* noop */ }

    if (rate !== null) metricExrate.textContent = String(rate); else metricExrate.textContent = '–';

    // Also show the exchangeRate hex from last series entry if present
    const lastSeriesEntry = series[series.length - 1] || {};
    metricExrateHex.textContent = lastSeriesEntry.kQuai ? lastSeriesEntry.kQuai : (lastPrimeHeader ? lastPrimeHeader.exchangeRate : '–');

    const deltaKPercent = lastDeltaK.times(100);
    metricDk.textContent = formatNumber(deltaKPercent, 4);
    metricDkText.textContent = 'Controller α = 0.001 (per spec), estimated from d*/d (per Prime block).';
    metricDkDot.style.background = lastDeltaK.gte(0) ? '#4ade80' : '#f97373';
    metricDkSide.textContent = lastDeltaK.gte(0) ? 'kQuai tends to increase ⇒ more Quai per 1 Qi' : 'kQuai tends to decrease ⇒ less Quai per 1 Qi';

    metricSideDot.style.background = lastRatio.gte(ratioOne) ? '#4ade80' : '#f97373';
    metricSide.textContent = lastRatio.gt(ratioOne) ? 'd* > d ⇒ pro-Qi (more Quai per 1 Qi).' : lastRatio.lt(ratioOne) ? 'd* < d ⇒ pro-Quai (less Quai per 1 Qi).' : 'Almost neutral (d* ≈ d).';

    statusDot.classList.remove('red');
    statusText.innerHTML = '<span class="em">OK</span> · ' + labels.length + ' points (' + series.length + ' Prime blocks). Last d*/d = ' + formatNumber(lastRatio, 4);
  }
}

// Cache prime headers by hash (persist in session for current tab)
// No persistent prime header cache: always resolve headers from RPC on demand.

// Global error handlers
window.addEventListener('error', (ev) => {
  try {
    const msg = ev && ev.message ? ev.message : String(ev.error || ev);
    console.error('Unhandled error:', ev.error || ev);
    if (connLabel) connLabel.textContent = 'JS error';
    if (statusText) statusText.textContent = 'Runtime error: ' + msg;
    if (statusDot) statusDot.classList.add('red');
  } catch (e) { /* noop */ }
});
window.addEventListener('unhandledrejection', (ev) => {
  try {
    const reason = ev && ev.reason ? ev.reason : ev;
    console.error('Unhandled promise rejection:', reason);
    if (connLabel) connLabel.textContent = 'JS error';
    if (statusText) statusText.textContent = 'Unhandled rejection: ' + (reason && reason.message ? reason.message : String(reason));
    if (statusDot) statusDot.classList.add('red');
  } catch (e) { /* noop */ }
});

function hexToInt(hex) { if (!hex) return 0; return parseInt(hex, 16); }
function hexToBigInt(hex) { if (!hex) return 0n; try { if (typeof hex === 'string' && hex.startsWith('0x')) return BigInt(hex); return BigInt(hex); } catch (e) { return 0n; } }

// Decimal helpers
const DECIMAL_PREC = 40;
Decimal.set({ precision: DECIMAL_PREC, rounding: Decimal.ROUND_HALF_UP });
function toDecimalFromBigInt(bi) { return new Decimal(bi.toString()); }
// Compute ratio and deltaK using integer arithmetic mirroring node behavior.
// Uses floor integer divisions to match node truncation. Returns Decimal values.
const ONE_OVER_ALPHA_BI = 1000n; // matches node OneOverAlpha (1000)
const SCALE_BI = 1n << 64n; // 2^64 scaling to mirror node fixed-point behavior
function computeRatioAndDeltaKFromNormHex(bestHex, minerHex) {
  try {
    const best = hexToBigInt(bestHex);
    const miner = hexToBigInt(minerHex);
    if (!best || !miner) return { ratio: new Decimal(1), deltaK: new Decimal(0) };
    // ratioScaled = floor(best * SCALE / miner)
    const ratioScaled = (best * SCALE_BI) / miner;
    const deltaScaled = ratioScaled - SCALE_BI; // scaled by SCALE
    const deltaKScaled = deltaScaled / ONE_OVER_ALPHA_BI; // apply OneOverAlpha as integer division
    const ratioDec = new Decimal(ratioScaled.toString()).div(new Decimal(SCALE_BI.toString()));
    const deltaKDec = new Decimal(deltaKScaled.toString()).div(new Decimal(SCALE_BI.toString()));
    return { ratio: ratioDec, deltaK: deltaKDec };
  } catch (e) {
    return { ratio: new Decimal(1), deltaK: new Decimal(0) };
  }
}
// Centralized status updater for the connection pill — keep messages informative.
function setConnStatus(step, details = '') {
  try {
    const ts = new Date().toLocaleTimeString();
    connLabel.textContent = `${step}${details ? ' · ' + details : ''}`;
  } catch (e) { /* noop */ }
}

// Average an array of Decimal values, returns Decimal
function avgDec(arr) { if (!Array.isArray(arr) || arr.length === 0) return new Decimal(0); let sum = new Decimal(0); for (const v of arr) { if (v instanceof Decimal) sum = sum.plus(v); else if (typeof v === 'bigint') sum = sum.plus(new Decimal(v.toString())); else if (v === null || v === undefined) sum = sum.plus(new Decimal(0)); else sum = sum.plus(new Decimal(v)); } return sum.div(new Decimal(arr.length)); }

function formatNumber(x, decimals = 2) { if (x === null || x === undefined) return "–"; if (x instanceof Decimal) return x.toFixed(decimals); if (typeof x === 'bigint') { const WEI = 10n ** 18n; const whole = x / WEI; const rem = x % WEI; const frac = (rem * (10n ** BigInt(decimals))) / WEI; return `${whole.toString()}.${frac.toString().padStart(decimals,'0')}`; } if (isNaN(x)) return "–"; return Number(x).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, }); }

// Format a BigInt amount in wei (1e18) to a human-readable Quai string.
// `decimals` controls fractional digits to display.
function formatWeiToQuai(amountWei, decimals = 6) {
  try {
    const WEI = 10n ** 18n;
    const whole = amountWei / WEI;
    const rem = amountWei % WEI;
    const scale = 10n ** BigInt(decimals);
    const frac = (rem * scale) / WEI; // integer fractional part
    let fracStr = frac.toString().padStart(decimals, '0');
    // trim trailing zeros but leave at least one digit if decimals > 0
    if (decimals > 0) {
      fracStr = fracStr.replace(/0+$/, '');
    }
    return fracStr.length ? `${whole.toString()}.${fracStr}` : `${whole.toString()}`;
  } catch (e) {
    return String(amountWei);
  }
}

function formatNormalizedDifficultyTick(value) { let dec; if (value instanceof Decimal) dec = value; else if (typeof value === 'bigint') dec = new Decimal(value.toString()).div(new Decimal('1e18')); else dec = new Decimal(value); const abs = dec.abs(); let scaled = dec; let suffix = " nD"; const thousand = new Decimal('1e3'); const million = new Decimal('1e6'); const billion = new Decimal('1e9'); const trillion = new Decimal('1e12'); const peta = new Decimal('1e15'); const exa = new Decimal('1e18'); if (abs.greaterThanOrEqualTo(exa)) { scaled = dec.div(exa); suffix = " EnD"; } else if (abs.greaterThanOrEqualTo(peta)) { scaled = dec.div(peta); suffix = " PnD"; } else if (abs.greaterThanOrEqualTo(trillion)) { scaled = dec.div(trillion); suffix = " TnD"; } else if (abs.greaterThanOrEqualTo(billion)) { scaled = dec.div(billion); suffix = " GnD"; } else if (abs.greaterThanOrEqualTo(million)) { scaled = dec.div(million); suffix = " MnD"; } else if (abs.greaterThanOrEqualTo(thousand)) { scaled = dec.div(thousand); suffix = " knD"; } const decPlaces = scaled.abs().lessThan(10) ? 2 : scaled.abs().lessThan(100) ? 1 : 0; return scaled.toFixed(decPlaces) + suffix; }

async function rpcCall(url, method, params = [], opts = {}) {
  const { timeout = 120000, retries = 0 } = opts;
  const body = { jsonrpc: "2.0", method, params, id: Date.now() };
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal, });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} (${method})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "RPC error");
      return data.result;
    } catch (err) {
      clearTimeout(timer);
      // Log context for debugging before retrying/throwing
      try { console.error(`rpcCall failed: method=${method} attempt=${attempt} params=${JSON.stringify(params)} error=`, err); } catch (e) {}
      if (attempt < retries) { await new Promise((r) => setTimeout(r, 400 * 2 ** attempt)); continue; }
      throw err;
    }
  }
}

// Send a JSON-RPC batch (array of requests). Returns a map id -> result|null
async function rpcBatch(url, batchReq, opts = {}) {
  const { timeout = 120000, retries = 0 } = opts;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchReq),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} (batch)`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid batch response');
      const map = {};
      for (const item of data) {
        try {
          if (!item || item.error || typeof item.id === 'undefined') {
            if (item && typeof item.id !== 'undefined') map[item.id] = null;
            continue;
          }
          map[item.id] = item.result;
        } catch (e) {
          // best-effort per-item
          try { console.error('rpcBatch item parse error', e); } catch (ee) {}
        }
      }
      return map;
    } catch (err) {
      clearTimeout(timer);
      try { console.error(`rpcBatch failed attempt=${attempt} len=${batchReq.length}`, err); } catch (e) {}
      if (attempt < retries) { await new Promise((r) => setTimeout(r, 400 * 2 ** attempt)); continue; }
      throw err;
    }
  }
}

// Send very large batch requests by splitting into smaller POSTs of `maxPer` items.
// Returns a merged map of id->result. Continues on partial failures (best-effort).
async function sendBatchWithLimit(url, batchReq, maxPer = 2000, opts = {}) {
  if (!Array.isArray(batchReq) || batchReq.length === 0) return {};
  if (batchReq.length <= maxPer) {
    try {
      return await rpcBatch(url, batchReq, opts);
    } catch (e) {
      // bubble up to caller to allow specialized fallback
      throw e;
    }
  }

  const merged = {};
  for (let i = 0; i < batchReq.length; i += maxPer) {
    const slice = batchReq.slice(i, i + maxPer);
    try {
      const partMap = await rpcBatch(url, slice, opts);
      // merge
      for (const k of Object.keys(partMap || {})) merged[k] = partMap[k];
    } catch (err) {
      try { console.warn('sendBatchWithLimit: slice failed', { index: i, len: slice.length, err }); } catch (e) {}
      // continue with next slice
    }
  }
  return merged;
}

// Prime header fetch implemented below.
// View operates from canonical header data and node RPCs.

// Fetch headers by block number in batches (used to scan Prime headers to find Prime blocks)
async function fetchHeadersByNumber(url, startBlock, endBlock, batchSize = 2000) {
  const headersMap = {};
  let total = endBlock - startBlock + 1;
  let fetched = 0;
  for (let b = startBlock; b <= endBlock; b += batchSize) {
    const batchEnd = Math.min(b + batchSize - 1, endBlock);
    const batchReq = [];
    for (let n = b; n <= batchEnd; n++) {
      batchReq.push({
        jsonrpc: "2.0",
        method: "quai_getHeaderByNumber",
        params: ["0x" + n.toString(16)],
        id: n,
      });
    }
    try {
      setConnStatus('Collecting headers', `${Math.min(batchEnd, endBlock)} / ${endBlock}`);
    } catch (e) {}

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchReq),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} (Prime headers)`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid batch response (Prime)");
      for (const item of data) {
        if (item.error || !item.result) continue;
        headersMap[item.id] = item.result;
        fetched++;
      }
    } catch (err) {
      try { console.error('fetchHeadersByNumber error (batch)', { start: b, end: batchEnd, error: err }); } catch (e) {}
      try { setConnStatus('Header fetch error', String(err && err.message ? err.message : err)); } catch (e) {}
      throw err;
    }
  }
  try { setConnStatus('Headers fetched', `${fetched} headers`); } catch (e) {}
  return headersMap;
}

// We fetch Prime headers by number and use header fields for metrics.

async function fetchWindowData() {

  const url = rpcUrlInput.value.trim();

  const totalPrimeRaw = parseInt(windowInput.value, 10) || 4000;
  const totalPrime = totalPrimeRaw || 4000;
  windowInput.value = totalPrime;

  const chunkSizePrimeRaw = parseInt(chunkInput.value, 10) || 200;
  const chunkSizePrime = chunkSizePrimeRaw || 200;
  chunkInput.value = chunkSizePrime;

  const windowDstar = parseInt(alphaSelect.value, 10);

  connDot.classList.remove("red");
  setConnStatus('Connecting to RPC', 'starting');
  refreshBtn.disabled = true;

  try {
    // latest Prime block
    const latestHex = await rpcCall(url, "quai_blockNumber", []);
    // Interpret RPC `quai_blockNumber` as the latest Prime block number (endpoint on :9001)
    const latestPrimeBlock = parseInt(latestHex, 16);
    const startPrimeBlock = Math.max(0, latestPrimeBlock - totalPrime + 1);

    try { setConnStatus('Preparing prime list', `${startPrimeBlock} → ${latestPrimeBlock}`); } catch (e) {}

    // Build contiguous list of prime numbers for the window.
    const primeNums = [];
    for (let n = startPrimeBlock; n <= latestPrimeBlock; n++) primeNums.push(n);
    if (!primeNums.length) throw new Error("No Prime blocks found in this window.");

    // 5) build series (per Prime block) — call node RPCs directly using block numbers
    const series = [];
    const chunkSize = chunkSizePrime;

    // Single large batch: miner+best for all prime numbers in one POST
    try { setConnStatus('Fetching diffs', `${primeNums.length} blocks`); } catch (e) {}

    const combinedBatch = [];
    for (const n of primeNums) {
      combinedBatch.push({ jsonrpc: '2.0', method: 'quai_getMinerDiffNormalized', params: ['0x' + n.toString(16)], id: `${n}_m` });
      combinedBatch.push({ jsonrpc: '2.0', method: 'quai_getBestDiffNormalized', params: ['0x' + n.toString(16)], id: `${n}_b` });
      combinedBatch.push({ jsonrpc: '2.0', method: 'quai_getHeaderByNumber', params: ['0x' + n.toString(16)], id: `${n}_h` });
    }

    // Try sending the combined batch in 2 POSTs first (avoid one massive POST)
    let combinedMap = {};
    try {
      if (!Array.isArray(combinedBatch) || combinedBatch.length <= 1) {
        combinedMap = await rpcBatch(url, combinedBatch, { timeout: 180000, retries: 0 });
      } else {
        const mid = Math.ceil(combinedBatch.length / 2);
        const firstSlice = combinedBatch.slice(0, mid);
        const secondSlice = combinedBatch.slice(mid);
        try {
          // Send two POSTs (sequential to reduce pressure). If both succeed, merge maps.
          const firstMap = await rpcBatch(url, firstSlice, { timeout: 180000, retries: 0 });
          const secondMap = await rpcBatch(url, secondSlice, { timeout: 180000, retries: 0 });
          combinedMap = Object.assign({}, firstMap || {}, secondMap || {});
        } catch (twoErr) {
          try { console.warn('two-post attempt failed, falling back to split batches', twoErr); } catch (e) {}
          combinedMap = await sendBatchWithLimit(url, combinedBatch, 2000, { timeout: 120000, retries: 0 }).catch(e => { try { console.error('sendBatchWithLimit failed', e); } catch (ee) {} return {}; });
        }
      }
    } catch (err) {
      try { console.warn('combined batch (final) failed', err); } catch (e) {}
      combinedMap = await sendBatchWithLimit(url, combinedBatch, 2000, { timeout: 120000, retries: 0 }).catch(e => { try { console.error('sendBatchWithLimit failed', e); } catch (ee) {} return {}; });
    }

    for (let j = 0; j < primeNums.length; j++) {
      const primeNum = primeNums[j];
      const minerRaw = combinedMap[`${primeNum}_m`] || null;
      const bestRaw = combinedMap[`${primeNum}_b`] || null;
      const headerRaw = combinedMap[`${primeNum}_h`] || null;

      let dInstant = null;
      let dStar = null;
      let ratio = null;
      let deltaK = new Decimal(0);

      try {
        if (minerRaw) {
          const mBig = hexToBigInt(minerRaw);
          if (mBig && mBig > 0n) dInstant = toDecimalFromBigInt(mBig);
        }
      } catch (e) { dInstant = null; }

      try {
        if (bestRaw) {
          const bBig = hexToBigInt(bestRaw);
          if (bBig && bBig > 0n) dStar = toDecimalFromBigInt(bBig);
        }
      } catch (e) { dStar = null; }

      if (minerRaw && bestRaw) {
        const r = computeRatioAndDeltaKFromNormHex(bestRaw, minerRaw);
        ratio = r.ratio;
        deltaK = r.deltaK;
      } else {
        ratio = new Decimal(1);
        deltaK = new Decimal(0);
      }

      // Attach header and kQuai if available
      const header = headerRaw || null;
      const kQuai = header && header.exchangeRate ? header.exchangeRate : null;

      series.push({
        primeNum,
        header,
        dInstant,
        dStar,
        deltaK,
        ratio,
        convInfo: null,
        kQuai,
      });
    }

    if (!series.length) {
      throw new Error("No valid Prime samples in this window.");
    }

    // delegate UI update to helper that also fetches latest header/exchange rate
    currentSeries = series;
    await updateUIFromSeries(series, chunkSizePrime, url);
    // Display a concise, accurate connection pill label
    setConnStatus('Prime RPC connected', '');
  } catch (err) {
    console.error(err);
    connDot.classList.add("red");
    setConnStatus('RPC Error', (err && err.message) ? err.message : String(err));
    statusDot.classList.add("red");
    statusText.textContent = "Error querying node: " + err.message;
  } finally {
    refreshBtn.disabled = false;
    
  }
}

function renderChart(labels, dValues, dStarValues, dkValues) {
  const ctx = document.getElementById("ddstar-chart").getContext("2d");
  if (chart) {
    // update datasets in place for smoother UX
    chart.data.labels = labels;
    if (chart.data.datasets && chart.data.datasets.length >= 3) {
      chart.data.datasets[0].data = dValues;
      chart.data.datasets[1].data = dStarValues;
      chart.data.datasets[2].data = dkValues;
    }
    chart.update();
    return;
  }
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "d (normalized)",
          data: dValues,
          borderWidth: 1.8,
          tension: 0.25,
          pointRadius: 0,
          borderColor: "#ff253a",
        },
        {
          label: "d* (window average)",
          data: dStarValues,
          borderWidth: 1.8,
          borderDash: [4, 4],
          tension: 0.25,
          pointRadius: 0,
          borderColor: "#ff6b81",
        },
        {
          label: "ΔkQuai/kQuai (%)",
          data: dkValues,
          yAxisID: "y1",
          borderWidth: 1.5,
          tension: 0.25,
          pointRadius: 0,
          borderColor: "#ffb347",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const label = ctx.dataset.label || "";
              if (label.includes("%")) {
                return label + ": " + formatNumber(ctx.parsed.y, 4) + " %";
              }
              return label + ": " + formatNumber(ctx.parsed.y, 4);
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Prime block range (chunked)" },
          ticks: { maxTicksLimit: 8 },
        },
        y: {
          title: { display: true, text: "d, d* (Prime, chunk averages, nD)" },
          ticks: {
            maxTicksLimit: 6,
            callback: (value) => formatNormalizedDifficultyTick(value),
          },
          grid: { drawBorder: false },
        },
        y1: {
          position: "right",
          title: { display: true, text: "ΔkQuai/kQuai (%)" },
          ticks: { maxTicksLimit: 5 },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

refreshBtn.addEventListener("click", async () => {
  try {
    await fetchWindowData();
  } catch (e) {
    console.error('Refresh failed', e);
    try { statusText.textContent = 'RPC error: ' + (e && e.message ? e.message : String(e)); } catch (ee) {}
    try { connDot.classList.add('red'); } catch (ee) {}
  }
});

autoBtn.addEventListener("click", async () => {
  try {
    if (autoInterval) {
      clearInterval(autoInterval);
      autoInterval = null;
      autoBtn.textContent = "Auto (10s)";
      autoBtn.classList.add("secondary");
    } else {
      await fetchWindowData();
      // start incremental polling: check latest prime every 10s and append if new
      autoInterval = setInterval(fetchAndAppendLatest, 10000);
      autoBtn.textContent = "Auto: On";
      autoBtn.classList.remove("secondary");
    }
  } catch (e) {
    console.error('Auto toggle failed', e);
    try { statusText.textContent = 'RPC error: ' + (e && e.message ? e.message : String(e)); } catch (ee) {}
    try { connDot.classList.add('red'); } catch (ee) {}
  }
});

timeframeButtons.forEach(btn => {
  btn.addEventListener("click", async () => {
    try {
      const blocks = parseInt(btn.dataset.window, 10);
      windowInput.value = blocks;
      await fetchWindowData();
    } catch (e) {
      console.error('Timeframe button failed', e);
      try { statusText.textContent = 'RPC error: ' + (e && e.message ? e.message : String(e)); } catch (ee) {}
    }
  });
});

// Initial render after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchWindowData);
} else {
  fetchWindowData();
}

// Incremental polling: fetch latest prime and append if new
async function fetchAndAppendLatest() {
  try {
    const url = rpcUrlInput.value.trim();
    const latestHex = await rpcCall(url, 'quai_blockNumber', []);
    const latestPrimeBlock = parseInt(latestHex, 16);

    if (!currentSeries || currentSeries.length === 0) {
      // No existing data: do a full refresh
      await fetchWindowData();
      return;
    }

    const lastPrimeNum = currentSeries[currentSeries.length - 1].primeNum;
    if (latestPrimeBlock <= lastPrimeNum) return; // nothing new

    // For each new prime number, request miner & best normalized (batch)
    const newPrimes = [];
    for (let n = lastPrimeNum + 1; n <= latestPrimeBlock; n++) newPrimes.push(n);
    if (!newPrimes.length) return;

    setConnStatus('Fetching new primes', `${newPrimes.length} primes`);

    const batch = [];
    for (const n of newPrimes) {
      batch.push({ jsonrpc: '2.0', method: 'quai_getMinerDiffNormalized', params: ['0x' + n.toString(16)], id: `${n}_m` });
      batch.push({ jsonrpc: '2.0', method: 'quai_getBestDiffNormalized', params: ['0x' + n.toString(16)], id: `${n}_b` });
      batch.push({ jsonrpc: '2.0', method: 'quai_getHeaderByNumber', params: ['0x' + n.toString(16)], id: `${n}_h` });
    }

    let map = {};
    try {
      map = await rpcBatch(url, batch, { timeout: 120000, retries: 0 });
    } catch (err) {
      try { console.warn('incremental batch failed, splitting slices', err); } catch (e) {}
      map = await sendBatchWithLimit(url, batch, 2000, { timeout: 120000, retries: 0 }).catch(e => { try { console.error('sendBatchWithLimit failed (incremental)', e); } catch (ee) {} return {}; });
    }

    for (const n of newPrimes) {
      const minerRaw = map[`${n}_m`] || null;
      const bestRaw = map[`${n}_b`] || null;
      const headerRaw = map[`${n}_h`] || null;

      let dInstant = null;
      let dStar = null;
      try { if (minerRaw) { const mBig = hexToBigInt(minerRaw); if (mBig && mBig > 0n) dInstant = toDecimalFromBigInt(mBig); } } catch (e) { dInstant = null; }
      try { if (bestRaw) { const bBig = hexToBigInt(bestRaw); if (bBig && bBig > 0n) dStar = toDecimalFromBigInt(bBig); } } catch (e) { dStar = null; }

      let ratio, deltaK;
      if (minerRaw && bestRaw) {
        const r = computeRatioAndDeltaKFromNormHex(bestRaw, minerRaw);
        ratio = r.ratio;
        deltaK = r.deltaK;
      } else {
        ratio = new Decimal(1);
        deltaK = new Decimal(0);
      }

      const header = headerRaw || null;
      const kQuai = header && header.exchangeRate ? header.exchangeRate : null;

      currentSeries.push({ primeNum: n, header, dInstant, dStar, deltaK, ratio, convInfo: null, kQuai });
    }

    // Trim to window size
    const totalPrime = parseInt(windowInput.value, 10) || 4000;
    while (currentSeries.length > totalPrime) currentSeries.shift();

    // Update UI
    const chunkSizePrime = parseInt(chunkInput.value, 10) || 200;
    await updateUIFromSeries(currentSeries, chunkSizePrime, rpcUrlInput.value.trim());
  } catch (err) {
    try { console.error('fetchAndAppendLatest failed', err); } catch (e) {}
  }
}

 
