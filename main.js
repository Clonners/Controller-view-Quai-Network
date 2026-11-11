// main.js — extracted from index.html
const alphaCtrl = 0.001; // controller alpha for kQuai

const rpcUrlInput   = document.getElementById("rpc-url") || { value: 'https://prime.kataribe.org' };
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

const metricRatio      = document.getElementById("metric-ratio");
const metricRatioBadge = document.getElementById("metric-ratio-badge");
const metricRatioText  = document.getElementById("metric-ratio-text");

const metricExrate     = document.getElementById("metric-exrate");
const metricConversionFlow = document.getElementById('metric-conversionflow');
const metricKQuai = document.getElementById('metric-kquai');
const metricKQuaiDirection = document.getElementById('metric-kquai-direction');
const cubicAmount = document.getElementById('cubic-amount');
const cubicIsQi = document.getElementById('cubic-isqi');
const cubicResult = document.getElementById('cubic-result');
const cubicDiscount = document.getElementById('cubic-discount');
const metricExrateHex  = document.getElementById("metric-exrate-hex");

const metricDk         = document.getElementById("metric-dk");
const metricDkText     = document.getElementById("metric-dk-text");

const chartSpinner     = document.getElementById("chart-loading-overlay");

const timeframeButtons = document.querySelectorAll(".tf-btn");
const donationPill     = document.getElementById("donation-pill");
const donationAddress  = "0x0042843bC5C3fcAFda51d2c6BB17d47370567C9a";

let autoRunning = false; // controls sequential auto loop
let autoDetectedPrimes = 0; // cumulative count since Auto was activated
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
    metricDkText.textContent = 'Controller alpha = 0.001 (per spec), estimated from d*/d (per Prime block).';

    statusDot.classList.remove('red', 'idle');
    const okMark = document.createElement('span');
    okMark.className = 'em';
    okMark.textContent = 'OK';
    statusText.replaceChildren(okMark, document.createTextNode(' · ' + labels.length + ' points (' + series.length + ' Prime blocks). Last d*/d = ' + formatNumber(lastRatio, 4)));
  }
}

// Cache prime headers by hash (persist in session for current tab)
// No persistent prime header cache: always resolve headers from RPC on demand.

// Global error handlers
window.addEventListener('error', (ev) => {
  try {
    try { connDot.classList.remove('fetching'); } catch (e) {}
    const msg = ev.error?.message || ev.message || String(ev.error || ev);
    console.error('Unhandled error:', ev.error || ev);
    if (connLabel) connLabel.textContent = 'JS error';
    if (statusText) statusText.textContent = 'Runtime error: ' + msg;
    if (statusDot) { statusDot.classList.remove('idle'); statusDot.classList.add('red'); }
  } catch (e) { /* noop */ }
});
window.addEventListener('unhandledrejection', (ev) => {
  try {
    const reason = ev && ev.reason ? ev.reason : ev;
    console.error('Unhandled promise rejection:', reason);
    if (connLabel) connLabel.textContent = 'JS error';
    if (statusText) statusText.textContent = 'Unhandled rejection: ' + (reason && reason.message ? reason.message : String(reason));
    if (statusDot) { statusDot.classList.remove('idle'); statusDot.classList.add('red'); }
  } catch (e) { /* noop */ }
});

function hexToInt(hex) { if (!hex) return 0; return parseInt(hex, 16); }
function hexToBigInt(hex) { 
  if (!hex) return 0n; 
  try { 
    if (typeof hex === 'string') {
      const clean = hex.startsWith('0x') ? hex : '0x' + hex;
      return BigInt(clean);
    }
    return BigInt(hex); 
  } catch (e) { 
    console.error('hexToBigInt parse error:', hex, e);
    return 0n; 
  } 
}

// Decimal helpers
const DECIMAL_PREC = 40;
Decimal.set({ precision: DECIMAL_PREC, rounding: Decimal.ROUND_HALF_UP });
function toDecimalFromBigInt(bi) { return new Decimal(bi.toString()); }

// LogBig implementation matching go-quai common.LogBig
// Returns log2(x) * 2^64 as BigInt (fixed-point representation)
const MANT_BITS = 64n;
const SCALE_2E64 = 1n << 64n;
function logBigInt(x) {
  if (x <= 0n) return 0n;
  // Find c = floor(log2(x)) by counting bits
  let c = 0n;
  let temp = x;
  while (temp > 1n) {
    temp = temp >> 1n;
    c++;
  }
  // Calculate mantissa: we want the fractional part of log2(x)
  // m = (x * 2^64) / (2^c) - 2^64, but we need high precision
  // Actually mathutil.BinaryLog returns (c, m) where result = c * 2^64 + m
  // m represents the fractional bits scaled by 2^64
  // m = floor((x - 2^c) * 2^64 / 2^c)
  const twoPowC = 1n << c;
  const remainder = x - twoPowC;
  const m = (remainder * SCALE_2E64) / twoPowC;
  // result = c * 2^64 + m
  return c * SCALE_2E64 + m;
}

// Compute ratio and deltaK using the EXACT formula from go-quai CalculateKQuai
// This matches consensus/misc/rewards.go CalculateKQuai function
const ONE_OVER_ALPHA_BI = 1000n; // matches node OneOverAlpha (1000)
const SCALE_BI = 1n << 64n; // 2^64 scaling to mirror node fixed-point behavior

// New function that uses raw minerDifficulty (not normalized) like the node does
function computeExactDeltaK(bestDiffNormHex, minerDiffHex) {
  try {
    const xbStar = hexToBigInt(bestDiffNormHex); // bestDiff * 2^64 / log(bestDiff) - already normalized
    const minerDiff = hexToBigInt(minerDiffHex); // raw miner difficulty from header
    
    if (!xbStar || !minerDiff || minerDiff <= 0n) {
      return { ratio: new Decimal(1), deltaK: new Decimal(0), kQuaiIncrease: false };
    }
    
    // Node formula from CalculateKQuai:
    // d1 = 2^64 * minerDifficulty
    // d2 = LogBig(minerDifficulty)
    // num = xbStar * d2 - d1
    // deltaK direction = (num > 0)
    
    const d1 = SCALE_BI * minerDiff;
    const d2 = logBigInt(minerDiff);
    
    // num = xbStar * d2 - d1
    const xbStarTimesD2 = xbStar * d2;
    const num = xbStarTimesD2 - d1;
    
    const kQuaiIncrease = num > 0n;
    
    // For display: deltaK/k = num / (d1 * OneOverAlpha)
    // denum = d1 * OneOverAlpha
    const denum = d1 * ONE_OVER_ALPHA_BI;
    
    // deltaK as Decimal (can be negative)
    const deltaKDec = new Decimal(num.toString()).div(new Decimal(denum.toString()));
    
    // ratio = xbStar / minerDiffNormalized where minerDiffNormalized = d1/d2
    // ratio = xbStar * d2 / d1
    const ratioDec = new Decimal(xbStarTimesD2.toString()).div(new Decimal(d1.toString()));
    
    return { ratio: ratioDec, deltaK: deltaKDec, kQuaiIncrease };
  } catch (e) {
    console.error('computeExactDeltaK error:', e);
    return { ratio: new Decimal(1), deltaK: new Decimal(0), kQuaiIncrease: false };
  }
}

// Legacy function kept for compatibility - uses normalized values (approximate)
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
function setConnStatus(step, details = '', opts = {}) {
  try {
    // opts: { force: true } will force update even when auto is running
    const force = opts && opts.force;
    // When Auto is running, keep the pill reserved for the auto message
    if (autoRunning && !force) {
      // Allow only the incremental auto status to update the label
      if (step !== 'Fetching new primes') return;
    }
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

// Generic formatter for RPC big values (hex strings, BigInt, numeric)
function formatBig(x) {
  try {
    if (x === null || typeof x === 'undefined') return '–';
    // If RPC returned an object with hex string inside, try toString
    if (typeof x === 'object' && typeof x.toString === 'function') {
      const s = x.toString();
      if (s && s.startsWith('0x')) return formatBig(s);
    }
    if (typeof x === 'string') {
      if (x.startsWith('0x')) {
        const bi = hexToBigInt(x);
        if (bi === 0n) return '0';
        if (bi >= 10n ** 18n) return formatWeiToQuai(bi, 6);
        if (bi >= 10n ** 3n) return (bi / 10n ** 3n).toString() + ' Qi';
        return bi.toString();
      }
      // plain decimal string
      if (!isNaN(Number(x))) return Number(x).toLocaleString('en-US');
      return x;
    }
    if (typeof x === 'bigint') {
      if (x === 0n) return '0';
      if (x >= 10n ** 18n) return formatWeiToQuai(x, 6);
      if (x >= 10n ** 3n) return (x / 10n ** 3n).toString() + ' Qi';
      return x.toString();
    }
    if (typeof x === 'number') return formatNumber(x, 6);
    return String(x);
  } catch (e) {
    try { console.error('formatBig error', e, x); } catch (ee) {}
    return String(x);
  }
}

// Format qits (integer, 1 Qi = 1e3 qits) to Qi string with decimals
function formatQitsToQi(qitsBigInt, decimals = 6) {
  try {
    let bi = qitsBigInt;
    if (typeof bi === 'string' && bi.startsWith('0x')) bi = hexToBigInt(bi);
    if (typeof bi === 'string') bi = BigInt(bi);
    if (typeof bi === 'number') bi = BigInt(Math.floor(bi));
    if (typeof bi !== 'bigint') return String(qitsBigInt);
    const WHOLE = bi / 1000n;
    const REM = bi % 1000n;
    const scale = 10n ** BigInt(decimals);
    const frac = (REM * scale) / 1000n;
    let fracStr = frac.toString().padStart(decimals, '0');
    // trim trailing zeros
    fracStr = fracStr.replace(/0+$/, '');
    return fracStr.length ? `${WHOLE.toString()}.${fracStr} Qi` : `${WHOLE.toString()} Qi`;
  } catch (e) {
    return String(qitsBigInt);
  }
}

// Fetch conversionFlow and kQuai metrics and update UI
async function fetchConversionAndKQuai() {
  const url = rpcUrlInput.value.trim();
  try { console.debug('fetchConversionAndKQuai start', { url }); } catch (e) {}
    try {
    const conv = await rpcCall(url, 'quai_conversionFlow', ['latest']);
    if (conv && metricConversionFlow) {
      metricConversionFlow.textContent = formatBig(conv);
      try { console.debug('quai_conversionFlow raw', conv); } catch (e) {}
      try { console.info('conversionFlow displayed', { raw: conv, display: metricConversionFlow.textContent }); } catch (e) {}
    } else console.error('quai_conversionFlow returned empty or invalid result', conv);
  } catch (e) { console.warn('conversionFlow rpc', e); }
  try {
    const kq = await rpcCall(url, 'quai_kQuaiDiscount', ['latest']);
    if (kq) {
      // kQuaiDiscount is returned as hex big; convert to percent using protocol multiplier
      try {
        const raw = kq.kQuaiDiscount || kq.discount || kq;
        // expose raw hex in console for debugging
        try { console.debug('quai_kQuaiDiscount raw', raw); } catch (e) {}
        let pct = null;
        const KQUAI_MULT = new Decimal('100000'); // from params.KQuaiDiscountMultiplier
        if (typeof raw === 'string' && raw.startsWith('0x')) {
          const bi = hexToBigInt(raw);
          pct = new Decimal(bi.toString()).mul(100).div(KQUAI_MULT);
        } else if (typeof raw === 'number' || typeof raw === 'bigint') {
          pct = new Decimal(raw.toString()).mul(100).div(KQUAI_MULT);
        }
        if (metricKQuai) {
            if (pct) {
            const pctDec = new Decimal(pct.toString());
            // Restore previous UX: show '<0.0001 %' for very small non-zero values
            // and fixed 4-decimal percent otherwise. If value is exactly zero,
            // it remains '0.0000 %' (RPC raw hex visible in tooltip).
            let display;
            if (pctDec.gt(0) && pctDec.lt(new Decimal('0.0001'))) {
              display = '<0.0001 %';
            } else {
              display = pctDec.toFixed(4) + ' %';
            }
            metricKQuai.textContent = display;
            try { metricKQuai.title = String(raw); } catch (e) {}
            if (pctDec.gt(0)) {
              try { console.info('kQuai percent computed', { raw, percent: display }); } catch (e) {}
            } else {
              try { console.warn('kQuai percent is zero (or below display threshold)', { raw, percent: pctDec.toString() }); } catch (e) {}
            }
          } else {
            metricKQuai.textContent = String(raw);
            try { metricKQuai.title = String(raw); } catch (e) {}
          }
        }
      } catch (e) {
        if (metricKQuai) metricKQuai.textContent = (kq.kQuaiDiscount || kq.discount || kq).toString();
      }
      if (metricKQuaiDirection && kq.direction) {
        try {
          const dir = String(kq.direction);
          if (dir === 'QuaiToQi') metricKQuaiDirection.textContent = 'direction: Quai → Qi';
          else if (dir === 'QiToQuai') metricKQuaiDirection.textContent = 'direction: Qi → Quai';
          else metricKQuaiDirection.textContent = 'direction: ' + dir;
        } catch (e) {
          metricKQuaiDirection.textContent = 'direction: ' + kq.direction;
        }
      }
    } else {
      console.error('quai_kQuaiDiscount returned empty or invalid result', kq);
    }
  } catch (e) { console.warn('kQuai rpc', e); }
}

// cubic preview: debounce input and call cubic RPC
function debounce(fn, wait) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
}

const callCubicPreview = debounce(async () => {
  const url = rpcUrlInput.value.trim();
  if (!cubicAmount) return;
  let val = cubicAmount.value.trim();
  if (!val) {
    cubicResult.textContent = '–';
    cubicDiscount.textContent = '–';
    return;
  }
  const isQi = (cubicIsQi && cubicIsQi.value === 'true');
  try {
    // convert decimal input to ledger-native smallest units and send as hex (0x...)
    let paramsAmount;
    try {
      if (isQi) {
        const amountQits = new Decimal(val).mul(new Decimal('1e3')); // Qi -> qits
        const bi = BigInt(amountQits.toFixed(0));
        paramsAmount = '0x' + bi.toString(16);
      } else {
        const amountWei = new Decimal(val).mul(new Decimal('1e18')); // Quai -> wei
        const bi = BigInt(amountWei.toFixed(0));
        paramsAmount = '0x' + bi.toString(16);
      }
    } catch (e) {
      console.error('invalid cubic input value', val, e);
      cubicResult.textContent = '–';
      cubicDiscount.textContent = '–';
      return;
    }
    try { console.debug('calling quai_cubicConversionDiscount', { paramsAmount, isQi, block: 'latest', url }); } catch (e) {}
    const res = await rpcCall(url, 'quai_cubicConversionDiscount', [paramsAmount, isQi, 'latest']);
    if (!res) {
      console.error('quai_cubicConversionDiscount returned empty result', { paramsAmount, isQi, res });
      return;
    }
    try { console.debug('quai_cubicConversionDiscount result', res); } catch (e) {}
    
    // Compute percent discount (discountQuai / inputQuaiValue * 100)
    let pctDisplay = null;
    try {
      if (res.inputQuaiValue && res.discountQuai) {
        const inBI = hexToBigInt(res.inputQuaiValue);
        const discBI = hexToBigInt(res.discountQuai);
        if (inBI > 0n) {
          pctDisplay = new Decimal(discBI.toString()).mul(100).div(new Decimal(inBI.toString())).toFixed(4) + ' %';
        }
      }
    } catch (e) { /* noop */ }
    cubicDiscount.textContent = pctDisplay || '–';

    if (isQi) {
      // Qi → Quai conversion: valueAfterCubic is already in Quai (wei)
      // Show the result directly as Quai
      if (res.valueAfterCubic) {
        cubicResult.textContent = formatBig(res.valueAfterCubic) + ' Quai';
      } else {
        cubicResult.textContent = '–';
      }
    } else {
      // Quai → Qi conversion: valueAfterCubic is in Quai (wei) after discount
      // Convert to Qi to show what user would receive
      if (res.valueAfterCubic) {
        try {
          const afterQi = await rpcCall(url, 'quai_quaiToQi', [res.valueAfterCubic, 'latest']);
          if (afterQi) {
            cubicResult.textContent = formatQitsToQi(afterQi);
          } else {
            cubicResult.textContent = formatBig(res.valueAfterCubic) + ' Quai';
          }
        } catch (e) {
          console.error('quai_quaiToQi failed', e);
          cubicResult.textContent = formatBig(res.valueAfterCubic) + ' Quai';
        }
      } else {
        cubicResult.textContent = '–';
      }
    }
  } catch (e) {
    console.error('cubic rpc failed', e, { amount: val, isQi });
  }
}, 400);

if (cubicAmount) cubicAmount.addEventListener('input', callCubicPreview);
if (cubicIsQi) cubicIsQi.addEventListener('change', callCubicPreview);


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
      try { console.debug('rpcCall success', { method, params, result: data.result }); } catch (e) {}
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
  if (chartSpinner) chartSpinner.hidden = false;

  const url = rpcUrlInput.value.trim();

  const totalPrimeRaw = parseInt(windowInput.value, 10) || 4000;
  const totalPrime = totalPrimeRaw || 4000;
  windowInput.value = totalPrime;

  const chunkSizePrimeRaw = parseInt(chunkInput.value, 10) || 200;
  const chunkSizePrime = chunkSizePrimeRaw || 200;
  chunkInput.value = chunkSizePrime;

  const windowDstar = parseInt(alphaSelect.value, 10);

  try { connDot.classList.remove('red'); connDot.classList.add('fetching'); } catch (e) {}
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

      // Attach header and kQuai if available
      const header = headerRaw || null;
      const kQuai = header && header.exchangeRate ? header.exchangeRate : null;

      // Use EXACT formula from go-quai CalculateKQuai with raw minerDifficulty
      if (bestRaw && header && header.minerDifficulty) {
        const r = computeExactDeltaK(bestRaw, header.minerDifficulty);
        ratio = r.ratio;
        deltaK = r.deltaK;
      } else if (minerRaw && bestRaw) {
        // Fallback to approximate formula if header.minerDifficulty not available
        const r = computeRatioAndDeltaKFromNormHex(bestRaw, minerRaw);
        ratio = r.ratio;
        deltaK = r.deltaK;
      } else {
        ratio = new Decimal(1);
        deltaK = new Decimal(0);
      }

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
    try { await fetchConversionAndKQuai(); } catch (e) { /* best-effort */ }
    // Display a concise, accurate connection pill label
    setConnStatus('Prime RPC connected', '');
  } catch (err) {
    console.error(err);
    connDot.classList.add("red");
    setConnStatus('RPC Error', (err && err.message) ? err.message : String(err));
    statusDot.classList.remove("idle"); statusDot.classList.add("red");
    statusText.textContent = "Error querying node: " + err.message;
  } finally {
    if (chartSpinner) chartSpinner.hidden = true;
    refreshBtn.disabled = false;
    try {
      // Only clear the persistent auto spinner if auto isn't running.
      if (!autoRunning) {
        connDot.classList.remove('fetching');
        connDot.classList.remove('red');
      }
    } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// Text chart. Same call as before (labels + three series), drawn with
// characters of the page font instead of a canvas:
//   panel A: d (●) and d* (○); ◆ where both fall on the same cell
//   panel B: ∆kQuai/kQuai in % (■), on its own scale
// The drawing is hidden from screen readers: the readout under it and the
// data table say the same in words and numbers.
// ---------------------------------------------------------------------------
const CHART_GUTTER = 10; // columns kept for the y labels and the axis
let chartState = null;   // what is drawn now (kept to redraw on resize)

function chartEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

// How many characters fit across the chart element.
function chartColumns(host) {
  const probe = chartEl('span', 'chart-probe', '0000000000');
  host.appendChild(probe);
  const chW = probe.getBoundingClientRect().width / 10;
  host.removeChild(probe);
  const total = host.clientWidth;
  if (!chW || !total) return 36;
  return Math.max(24, Math.floor(total / chW + 0.05));
}

function chartScale(values, rows) {
  const finite = values.filter((v) => typeof v === 'number' && isFinite(v));
  let min = finite.length ? Math.min.apply(null, finite) : 0;
  let max = finite.length ? Math.max.apply(null, finite) : 1;
  if (min === max) { const pad = Math.abs(min) * 0.01 || 1; min -= pad; max += pad; }
  return {
    min,
    max,
    rowOf: (v) => Math.max(0, Math.min(rows - 1, Math.round((max - v) / (max - min) * (rows - 1)))),
    valueAt: (r) => max - (r / (rows - 1)) * (max - min),
  };
}

// One panel as a grid of { ch, layer } cells. Later writes win: a marker
// replaces the cursor line, and the cursor line replaces the zero line.
function chartPanel(opts) {
  const { rows, plotW, colOf, series, scale, tickLabel, cursor, zeroLine } = opts;
  const width = CHART_GUTTER + plotW;
  const grid = [];
  for (let r = 0; r <= rows; r++) {
    const line = [];
    for (let c = 0; c < width; c++) line.push({ ch: ' ', layer: 'frame' });
    grid.push(line);
  }
  const put = (r, c, ch, layer) => { if (grid[r] && grid[r][c]) grid[r][c] = { ch, layer }; };

  // y labels and axis
  const ticks = rows >= 9 ? 4 : 3;
  const tickRows = new Set();
  for (let k = 0; k < ticks; k++) tickRows.add(Math.round(k * (rows - 1) / (ticks - 1)));
  for (let r = 0; r < rows; r++) {
    if (tickRows.has(r)) {
      const label = String(tickLabel(scale.valueAt(r))).slice(0, CHART_GUTTER - 2).padStart(CHART_GUTTER - 2);
      for (let i = 0; i < label.length; i++) put(r, i, label[i], 'frame');
      put(r, CHART_GUTTER - 1, '┤', 'frame');
    } else {
      put(r, CHART_GUTTER - 1, '│', 'frame');
    }
  }
  put(rows, CHART_GUTTER - 1, '╰', 'frame');
  for (let c = 0; c < plotW; c++) put(rows, CHART_GUTTER + c, '─', 'frame');

  // zero line, only when zero is inside the scale
  if (zeroLine && scale.min < 0 && scale.max > 0) {
    const zr = scale.rowOf(0);
    for (let c = 0; c < plotW; c++) put(zr, CHART_GUTTER + c, '╌', 'frame');
  }

  // column of the point being read
  if (cursor >= 0) {
    const cc = CHART_GUTTER + colOf(cursor);
    for (let r = 0; r < rows; r++) put(r, cc, '╎', 'cursor');
    put(rows, cc, '┴', 'cursor');
  }

  // markers
  series.forEach((s) => {
    s.values.forEach((v, i) => {
      if (typeof v !== 'number' || !isFinite(v)) return;
      const r = scale.rowOf(v);
      const c = CHART_GUTTER + colOf(i);
      const there = grid[r][c].marker;
      if (there && there !== s.glyph) {
        put(r, c, '◆', 'amber');
        grid[r][c].marker = '◆';
      } else {
        put(r, c, s.glyph, s.layer);
        grid[r][c].marker = s.glyph;
      }
    });
  });
  return grid;
}

function chartLayerText(grid, layer) {
  return grid.map((line) => line.map((cell) => (cell.layer === layer ? cell.ch : ' ')).join('')).join('\n');
}

function chartPctTick(v) {
  const text = formatNumber(v, 4);
  return text.length > CHART_GUTTER - 2 ? formatNumber(v, 2) : text;
}

// First and last Prime block of the window, under the ends of the axis.
function chartAxisText(labels, plotW) {
  const first = String(labels[0]).split('–')[0];
  const lastParts = String(labels[labels.length - 1]).split('–');
  const last = lastParts[lastParts.length - 1];
  const pad = ' '.repeat(CHART_GUTTER);
  if (first.length + last.length + 2 <= plotW) {
    return pad + first + ' '.repeat(plotW - first.length - last.length) + last;
  }
  return pad + last.padStart(plotW);
}

// All the points as a table (the chart in numbers).
function chartTable(st, open) {
  const details = chartEl('details', 'chart-data');
  details.open = open;
  details.appendChild(chartEl('summary', '', 'data table (' + st.labels.length + ' points)'));
  const table = chartEl('table', 'tbl chart-table');
  table.setAttribute('role', 'table');
  const columns = [
    ['Prime block range', 'blocks', ''],
    ['d (normalized)', 'd', 'r'],
    ['d* (window average)', 'd*', 'r'],
    ['∆kQuai/kQuai (%)', '∆kQuai/kQuai %', 'r'],
  ];
  const thead = chartEl('thead');
  thead.setAttribute('role', 'rowgroup');
  const headRow = chartEl('tr');
  headRow.setAttribute('role', 'row');
  columns.forEach((col) => {
    const th = chartEl('th', col[2], col[0]);
    th.setAttribute('role', 'columnheader');
    th.setAttribute('scope', 'col');
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  const tbody = chartEl('tbody');
  tbody.setAttribute('role', 'rowgroup');
  st.labels.forEach((label, i) => {
    const tr = chartEl('tr');
    tr.setAttribute('role', 'row');
    const values = [label, formatNumber(st.d[i], 4), formatNumber(st.dStar[i], 4), formatNumber(st.dk[i], 4) + ' %'];
    values.forEach((value, k) => {
      const td = chartEl('td', columns[k][2]);
      td.setAttribute('role', 'cell');
      td.setAttribute('data-label', columns[k][1]);
      td.appendChild(chartEl('span', 'v', value));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  details.appendChild(table);
  return details;
}

// Fill the layers and the readout for the current cursor.
function chartPaint() {
  const st = chartState;
  if (!st || !st.dom) return;
  const lay = st.layout;
  const a = chartPanel({
    rows: st.rowsA, plotW: lay.plotW, colOf: lay.colOf, cursor: st.cursor,
    scale: chartScale(st.d.concat(st.dStar), st.rowsA),
    tickLabel: (v) => formatNormalizedDifficultyTick(v).trim(),
    series: [
      { values: st.d, glyph: '●', layer: 'ink' },
      { values: st.dStar, glyph: '○', layer: 'amber' },
    ],
  });
  const b = chartPanel({
    rows: st.rowsB, plotW: lay.plotW, colOf: lay.colOf, cursor: st.cursor, zeroLine: true,
    scale: chartScale(st.dk, st.rowsB),
    tickLabel: chartPctTick,
    series: [{ values: st.dk, glyph: '■', layer: 'amber' }],
  });
  ['frame', 'cursor', 'ink', 'amber'].forEach((layer) => {
    st.dom.a[layer].textContent = chartLayerText(a, layer);
    st.dom.b[layer].textContent = chartLayerText(b, layer);
  });

  // Same text the old tooltip gave, for the point under the cursor.
  const i = st.cursor;
  const lines = [
    ['point ' + (i + 1) + ' of ' + st.labels.length, 'blocks ' + st.labels[i]],
    ['d (normalized)', formatNumber(st.d[i], 4)],
    ['d* (window average)', formatNumber(st.dStar[i], 4)],
    ['∆kQuai/kQuai (%)', formatNumber(st.dk[i], 4) + ' %'],
  ];
  st.dom.readout.replaceChildren(...lines.map((pair) => {
    const item = chartEl('div');
    item.appendChild(chartEl('dt', '', pair[0]));
    item.appendChild(chartEl('dd', '', pair[1]));
    return item;
  }));
}

function chartSetCursor(index, announce) {
  const st = chartState;
  if (!st || !st.dom || !st.labels.length) return;
  const i = Math.max(0, Math.min(st.labels.length - 1, index));
  if (i === st.cursor && !announce) return;
  st.cursor = i;
  chartPaint();
  if (announce) {
    st.dom.live.textContent = 'blocks ' + st.labels[i] + ': d ' + formatNumber(st.d[i], 4) +
      ', d star ' + formatNumber(st.dStar[i], 4) + ', delta kQuai over kQuai ' + formatNumber(st.dk[i], 4) + ' percent';
  }
}

// Build the chart for the width available now.
function chartBuild(host) {
  const st = chartState;
  if (!st) return;
  const n = st.labels.length;
  const oldTable = host.querySelector('details');
  const wasOpen = oldTable ? oldTable.open : false;
  if (n === 0) {
    st.dom = null;
    host.replaceChildren(chartEl('p', 'chart-cap', 'No data yet.'));
    return;
  }

  const cols = chartColumns(host);
  const plotMax = Math.max(8, cols - CHART_GUTTER);
  const step = Math.max(1, Math.min(3, Math.floor(plotMax / n)));
  const spread = n * step <= plotMax; // false: more points than columns
  const plotW = spread ? n * step : plotMax;
  st.layout = {
    cols,
    plotW,
    colOf: (i) => (spread ? i * step + Math.floor(step / 2) : Math.min(plotW - 1, Math.floor(i * plotW / n))),
    indexAt: (col) => Math.max(0, Math.min(n - 1, spread ? Math.floor(col / step) : Math.floor(col * n / plotW))),
  };
  st.rowsA = cols >= 60 ? 10 : 8;
  st.rowsB = 5;

  const makePlot = () => {
    const pre = chartEl('pre', 'art chart-plot');
    pre.setAttribute('aria-hidden', 'true');
    const layers = {};
    [['frame', 'l l-dust'], ['cursor', 'l l-cursor'], ['ink', 'l'], ['amber', 'l l-amber']].forEach((pair) => {
      layers[pair[0]] = chartEl('span', pair[1]);
      pre.appendChild(layers[pair[0]]);
    });
    return { pre, layers };
  };
  const a = makePlot();
  const b = makePlot();
  const axis = chartEl('pre', 'art chart-axis', chartAxisText(st.labels, plotW));
  axis.setAttribute('aria-hidden', 'true');
  const readout = chartEl('dl', 'kv chart-readout');
  const live = chartEl('span', 'sr');
  live.setAttribute('aria-live', 'polite');

  host.replaceChildren(
    chartEl('p', 'chart-cap', 'd, d* (Prime, chunk averages, nD)'),
    a.pre,
    chartEl('p', 'chart-cap', '∆kQuai/kQuai (%)'),
    b.pre,
    axis,
    chartEl('p', 'chart-cap chart-cap-x', 'Prime block range (chunked)'),
    readout,
    live,
    chartTable(st, wasOpen)
  );
  st.dom = { a: a.layers, b: b.layers, readout, live };
  chartPaint();
}

// Mouse or finger over the drawing: read the point of that column.
function chartPointer(ev) {
  const st = chartState;
  if (!st || !st.dom || !st.layout) return;
  if (ev.type === 'pointermove' && ev.pointerType !== 'mouse') return;
  const pre = ev.target && ev.target.closest ? ev.target.closest('.chart-plot') : null;
  if (!pre) return;
  const rect = pre.getBoundingClientRect();
  const chW = rect.width / st.layout.cols;
  if (!chW) return;
  const col = Math.floor((ev.clientX - rect.left) / chW) - CHART_GUTTER;
  if (col < 0 || col >= st.layout.plotW) return;
  chartSetCursor(st.layout.indexAt(col), false);
}

// Left/right arrows walk the points, Home/End jump to the ends.
function chartKey(ev) {
  const st = chartState;
  if (ev.target !== ev.currentTarget || !st || !st.labels.length) return;
  let i = st.cursor;
  if (ev.key === 'ArrowLeft') i -= 1;
  else if (ev.key === 'ArrowRight') i += 1;
  else if (ev.key === 'Home') i = 0;
  else if (ev.key === 'End') i = st.labels.length - 1;
  else return;
  ev.preventDefault();
  chartSetCursor(i, true);
}

function renderChart(labels, dValues, dStarValues, dkValues) {
  const host = document.getElementById("ddstar-chart");
  if (!host) return;
  if (!host.dataset.wired) {
    host.dataset.wired = '1';
    host.addEventListener('pointermove', chartPointer);
    host.addEventListener('click', chartPointer);
    host.addEventListener('keydown', chartKey);
  }
  // Follow the newest point unless the reader left the cursor on an older one.
  const prev = chartState;
  const n = labels.length;
  let cursor = n - 1;
  if (prev && prev.labels.length && prev.cursor >= 0 && prev.cursor < prev.labels.length - 1) {
    cursor = Math.min(prev.cursor, n - 1);
  }
  chartState = { labels, d: dValues, dStar: dStarValues, dk: dkValues, cursor, layout: null, dom: null };
  chartBuild(host);
}

// The grid changes with the width (40 or 100 columns): redraw when it does.
let chartResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    const host = document.getElementById('ddstar-chart');
    if (!host || !chartState || !chartState.layout) return;
    if (chartColumns(host) !== chartState.layout.cols) chartBuild(host);
  }, 150);
});

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
    // Prevent repeated clicks while toggling state
    if (autoBtn.disabled) return;
    autoBtn.disabled = true;

    if (autoRunning) {
      // turning auto off
      stopAutoLoop();
      autoBtn.textContent = "auto (10s)";
      autoBtn.classList.add("secondary");
      autoBtn.setAttribute('aria-pressed', 'false');
      autoBtn.disabled = false;
      return;
    }

    // turning auto on: fetch initial window then start sequential loop
    try {
      await fetchWindowData();
      // Keep spinner active while Auto is running and hide connLabel text
      try { connDot.classList.add('fetching'); } catch (e) {}
      try { autoDetectedPrimes = 0; setConnStatus('Fetching new primes', '0 primes'); } catch (e) {}
      startAutoLoop();
      autoBtn.textContent = "auto: on";
      autoBtn.classList.remove("secondary");
      autoBtn.setAttribute('aria-pressed', 'true');
    } finally {
      // re-enable button regardless of fetch result so user can retry/stop
      autoBtn.disabled = false;
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
    try { connDot.classList.remove('red'); connDot.classList.add('fetching'); } catch (e) {}
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

    // Show current cumulative count (will be incremented per-successful-prime below)
    try { setConnStatus('Fetching new primes', `${autoDetectedPrimes} primes`); } catch (e) {}

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

      const header = headerRaw || null;
      const kQuai = header && header.exchangeRate ? header.exchangeRate : null;

      // Use EXACT formula from go-quai CalculateKQuai with raw minerDifficulty
      let ratio, deltaK;
      if (bestRaw && header && header.minerDifficulty) {
        const r = computeExactDeltaK(bestRaw, header.minerDifficulty);
        ratio = r.ratio;
        deltaK = r.deltaK;
      } else if (minerRaw && bestRaw) {
        // Fallback to approximate formula if header.minerDifficulty not available
        const r = computeRatioAndDeltaKFromNormHex(bestRaw, minerRaw);
        ratio = r.ratio;
        deltaK = r.deltaK;
      } else {
        ratio = new Decimal(1);
        deltaK = new Decimal(0);
      }

      currentSeries.push({ primeNum: n, header, dInstant, dStar, deltaK, ratio, convInfo: null, kQuai });
      try {
        // Count only primes with complete basic info (miner, best, header)
        // and with parsed difficulty values (dInstant, dStar) since the
        // window rendering relies on those.
        if (minerRaw && bestRaw && headerRaw && dInstant !== null && dStar !== null) {
          autoDetectedPrimes += 1;
          setConnStatus('Fetching new primes', `${autoDetectedPrimes} primes`);
        }
      } catch (e) {}
    }

    // Trim to window size
    const totalPrime = parseInt(windowInput.value, 10) || 4000;
    while (currentSeries.length > totalPrime) currentSeries.shift();

    // Update UI
    const chunkSizePrime = parseInt(chunkInput.value, 10) || 200;
    await updateUIFromSeries(currentSeries, chunkSizePrime, rpcUrlInput.value.trim());
    try { await fetchConversionAndKQuai(); } catch (e) { /* best-effort */ }
  } catch (err) {
    try { console.error('fetchAndAppendLatest failed', err); } catch (e) {}
  }
  finally {
    try {
      // If Auto is running, keep spinner active persistently; only remove when Auto stopped
      if (!autoRunning) connDot.classList.remove('fetching');
    } catch (e) {}
  }
}

// Sequential auto loop: waits for each fetch to finish before scheduling next
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function startAutoLoop() {
  if (autoRunning) return;
  autoRunning = true;
  // Ensure spinner stays active while auto loop runs
  try { connDot.classList.add('fetching'); } catch (e) {}
  (async () => {
    while (autoRunning) {
      try {
        await fetchAndAppendLatest();
      } catch (e) {
        try { console.error('auto loop fetch error', e); } catch (ee) {}
      }
      // wait fixed interval after each completed fetch
      for (let waited = 0; waited < 10000 && autoRunning; waited += 500) {
        await sleep(500);
      }
    }
  })();
}

function stopAutoLoop() {
  autoRunning = false;
  // When stopping auto, remove persistent spinner and restore green dot
  try { connDot.classList.remove('fetching'); } catch (e) {}
  try { setConnStatus('Prime RPC connected', ''); } catch (e) {}
}

// ========== Conversion Calculator ==========
let isQiToQuai = true; // Default direction

const swapBtn = document.getElementById('swap-direction-btn');
const fromCurrency = document.getElementById('from-currency');
const toCurrency = document.getElementById('to-currency');
const conversionAmount = document.getElementById('conversion-amount');
const conversionResult = document.getElementById('conversion-result');
const conversionDetails = document.getElementById('conversion-details');
const calculateBtn = document.getElementById('calculate-btn');

// Swap direction
swapBtn.addEventListener('click', () => {
  isQiToQuai = !isQiToQuai;
  fromCurrency.textContent = isQiToQuai ? 'Qi' : 'Quai';
  toCurrency.textContent = isQiToQuai ? 'Quai' : 'Qi';
  conversionResult.textContent = '–';
  conversionDetails.textContent = '';
});

// Calculate conversion
calculateBtn.addEventListener('click', async () => {
  const amount = conversionAmount.value.trim();
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    conversionResult.textContent = 'Invalid amount';
    conversionResult.dataset.state = 'bad';
    conversionDetails.textContent = '';
    return;
  }

  conversionResult.textContent = 'Calculating...';
  conversionResult.dataset.state = 'pending';
  conversionDetails.textContent = '';

  try {
    const url = rpcUrlInput.value.trim();

    // Use Decimal.js for maximum precision throughout
    const inputAmount = new Decimal(amount);

    // Build tx.value in ledger-native smallest units:
    // - If converting Qi -> Quai: RPC expects Qi amount in "qits" (1 Qi = 1e3 qits)
    // - If converting Quai -> Qi: RPC expects Quai amount in "wei" (1 Quai = 1e18 wei)
    const QITS_MULTIPLIER = new Decimal('1e3');
    const WEI_MULTIPLIER = new Decimal('1e18');

    // Convert to integer BigInt according to direction
    let valueBigInt;
    if (isQiToQuai) {
      // input is Qi, convert to qits (integer)
      const amountQits = inputAmount.mul(QITS_MULTIPLIER);
      valueBigInt = BigInt(amountQits.toFixed(0));
    } else {
      // input is Quai, convert to wei
      const amountWeiDecimal = inputAmount.mul(WEI_MULTIPLIER);
      valueBigInt = BigInt(amountWeiDecimal.toFixed(0));
    }

    // Use proper Cyprus-1 Zone-0-0 addresses with correct ledger scope
    const quaiAddress = '0x00629D04C9ce8cDC83052F8CbC0dC01fEE026329';
    const qiAddress = '0x1a9C8182C09F50C8318d769245beA52c32BE35BC';

    const tx = {
      from: isQiToQuai ? qiAddress : quaiAddress,
      to: isQiToQuai ? quaiAddress : qiAddress,
      value: '0x' + valueBigInt.toString(16)
    };

    // Batch: ask node for canonical base conversion + calculated (discounted) amount
    const methodBase = isQiToQuai ? 'quai_qiToQuai' : 'quai_quaiToQi';
    const valueHex = '0x' + valueBigInt.toString(16);
    const batchReq = [
      { jsonrpc: '2.0', method: 'quai_calculateConversionAmount', params: [tx], id: 'calc' },
      { jsonrpc: '2.0', method: methodBase, params: [valueHex, 'latest'], id: 'base' }
    ];

    const batchMap = await rpcBatch(url, batchReq, { timeout: 20000, retries: 0 });
    const calcRes = batchMap['calc'];
    const baseRes = batchMap['base'];

    if (!calcRes) throw new Error('Calculation RPC failed');

    // Parse both results
    const calcBig = hexToBigInt(calcRes);
    const baseBig = hexToBigInt(baseRes);

    if (!calcBig || calcBig === 0n) throw new Error('Result is zero');

    // Convert to human amounts based on direction
    const calcDec = new Decimal(calcBig.toString());
    let resultAmount;
    if (isQiToQuai) {
      resultAmount = calcDec.div(new Decimal('1e18')); // Quai
    } else {
      resultAmount = calcDec.div(new Decimal('1e3')); // Qi
    }

    // Display the conversion result
    conversionResult.textContent = resultAmount.toFixed(6) + ' ' + toCurrency.textContent;
    conversionResult.dataset.state = 'ok';

    // Require canonical base conversion result (no fallbacks)
    if (!baseBig || baseBig === 0n) {
      throw new Error('Base conversion RPC failed or returned zero (no fallback allowed)');
    }

    // Compute canonical baseReceived from baseBig and the discount percentage
    const baseDec = new Decimal(baseBig.toString());
    const baseReceived = isQiToQuai ? baseDec.div(new Decimal('1e18')) : baseDec.div(new Decimal('1e3'));
    let discountPercent = new Decimal(0);
    if (!baseReceived.isZero()) {
      discountPercent = baseReceived.sub(resultAmount).div(baseReceived).mul(100);
      if (discountPercent.isNegative()) discountPercent = new Decimal(0);
      if (discountPercent.gt(100)) discountPercent = new Decimal(100);
    }
    // Show higher precision like cubic discount: use 4 decimals
    let discountDisplay;
    try {
      const pctDec = new Decimal(discountPercent.toString());
      if (pctDec.gt(0) && pctDec.lt(new Decimal('0.0001'))) {
        discountDisplay = '<0.0001 %';
      } else {
        discountDisplay = pctDec.toFixed(4) + ' %';
      }
    } catch (e) {
      discountDisplay = discountPercent.toFixed(4) + '%';
    }
    conversionDetails.textContent = `Total discount: ${discountDisplay}`;
  } catch (err) {
    console.info('Conversion calculation error:', err);
    conversionResult.textContent = 'Error';
    conversionResult.dataset.state = 'bad';
    conversionDetails.textContent = err.message || 'Unknown error';
  }
});

 
// Donation pill: copy address to clipboard when clicked
if (donationPill) {
  donationPill.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const addr = donationAddress || (donationPill.querySelector('.donate-address') && donationPill.querySelector('.donate-address').textContent.trim());
    if (!addr) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(addr);
      } else {
        const ta = document.createElement('textarea');
        ta.value = addr;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const labelEl = donationPill.querySelector('.donate-label');
      const orig = labelEl ? labelEl.textContent : null;
      if (labelEl) labelEl.textContent = 'Copied';
      donationPill.classList.add('copied');
      setTimeout(() => {
        if (labelEl && orig) labelEl.textContent = orig;
        donationPill.classList.remove('copied');
      }, 1800);
    } catch (e) {
      try { console.error('copy donation address failed', e); } catch (ee) {}
    }
  });
}


