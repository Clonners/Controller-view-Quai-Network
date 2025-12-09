// main.js — extracted from index.html
const alphaCtrl = 0.001; // controller α for kQuai

const rpcUrlInput   = document.getElementById("rpc-url");
const windowInput   = document.getElementById("window");
const chunkInput    = document.getElementById("chunk");
const alphaSelect   = document.getElementById("alpha");
const refreshBtn    = document.getElementById("refresh-btn");
const autoBtn       = document.getElementById("auto-btn");
const connDot       = document.getElementById("conn-dot");
const connLabel     = document.getElementById("conn-label");
const connSpinner   = document.getElementById("conn-spinner");
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

// Copy donation address on click
if (donationPill) {
  donationPill.addEventListener("click", async () => {
    const labelEl = donationPill.querySelector(".donate-label");
    const originalText = labelEl.textContent;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(donationAddress);
        labelEl.textContent = "Copied!";
      } else {
        const dummy = document.createElement("input");
        dummy.value = donationAddress;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        labelEl.textContent = "Copied!";
      }
    } catch (e) {
      labelEl.textContent = "Copy failed";
    }
    setTimeout(() => {
      labelEl.textContent = originalText;
    }, 1600);
  });
}

// Cache prime headers by hash (persist in session for current tab)
let primeHeaderCache = {};
try {
  const raw = sessionStorage.getItem('primeHeaderCache');
  if (raw) primeHeaderCache = JSON.parse(raw);
} catch (e) {
  primeHeaderCache = {};
}

function hexToInt(hex) {
  if (!hex) return 0;
  return parseInt(hex, 16);
}

function hexToBigInt(hex) {
  if (!hex) return 0n;
  try {
    if (typeof hex === 'string' && hex.startsWith('0x')) return BigInt(hex);
    return BigInt(hex);
  } catch (e) {
    return 0n;
  }
}

function bigIntToNumberApprox(bi) {
  if (bi === 0n) return 0;
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  if (bi <= MAX_SAFE) return Number(bi);
  // approximate by taking top 53 bits
  const bin = bi.toString(2);
  const bitLength = bin.length;
  const shift = bitLength - 53;
  const topBits = bin.slice(0, 53);
  const mantissa = parseInt(topBits, 2);
  return mantissa * Math.pow(2, shift);
}

function formatNumber(x, decimals = 2) {
  if (x === null || x === undefined || isNaN(x)) return "–";
  return x.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatWeiToQuai(amountWeiBigInt, outDecimals = 6) {
  const WEI = 10n ** 18n;
  const whole = amountWeiBigInt / WEI;
  const rem = amountWeiBigInt % WEI;
  const frac = (rem * (10n ** BigInt(outDecimals))) / WEI;
  return `${whole.toString()}.${frac.toString().padStart(outDecimals, '0')}`;
}

async function rpcCall(url, method, params = [], opts = {}) {
  const { timeout = 10000, retries = 1 } = opts;
  const body = { jsonrpc: "2.0", method, params, id: Date.now() };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} (${method})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "RPC error");
      return data.result;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }
}

async function fetchZoneHeadersRange(url, startBlock, endBlock, batchSize = 200) {
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
      connLabel.textContent = `Fetching zone headers ${Math.min(batchEnd, endBlock)} / ${endBlock}`;
      if (connSpinner) connSpinner.style.display = 'inline-block';
    } catch (e) {}

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchReq),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} (zone headers)`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid batch response (zone)");
    for (const item of data) {
      if (item.error || !item.result) continue;
      headersMap[item.id] = item.result;
      fetched++;
    }
  }
  try { connLabel.textContent = `Fetched ${fetched} zone headers`; } catch (e) {}
  return headersMap;
}

async function fetchPrimeHeadersByHash(url, hashes, batchSize = 200) {
  const normalized = hashes
    .filter(Boolean)
    .map(h => h.toLowerCase())
    .filter(h => h !== "0x0000000000000000000000000000000000000000000000000000000000000000");

  const unique = Array.from(new Set(normalized));
  const need = unique.filter(h => !primeHeaderCache[h]);

  let fetched = 0;
  for (let i = 0; i < need.length; i += batchSize) {
    const slice = need.slice(i, i + batchSize);
    const batchReq = slice.map(h => ({
      jsonrpc: "2.0",
      method: "quai_getHeaderByHash",
      params: [h],
      id: h,
    }));
    try { connLabel.textContent = `Fetching prime headers ${Math.min(i+batchSize, need.length)} / ${need.length}`; } catch (e) {}
    if (connSpinner) connSpinner.style.display = 'inline-block';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchReq),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} (prime headers)`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid batch response (prime)");
    for (const item of data) {
      if (!item.result || item.error) continue;
      const hash = (item.id || "").toLowerCase();
      primeHeaderCache[hash] = item.result;
      fetched++;
    }
  }
  try { connLabel.textContent = `Fetched ${fetched} prime headers`; } catch (e) {}

  // persist cache for this session
  try {
    sessionStorage.setItem('primeHeaderCache', JSON.stringify(primeHeaderCache));
  } catch (e) {}

  const out = {};
  for (const h of unique) {
    if (primeHeaderCache[h]) out[h] = primeHeaderCache[h];
  }
  return out;
}

async function fetchWindowData() {
  if (connSpinner) connSpinner.style.display = 'inline-block';

  const url = rpcUrlInput.value.trim();

  const totalPrimeRaw = parseInt(windowInput.value, 10) || 4000;
  const totalPrime = Math.min(Math.max(totalPrimeRaw, 200), 400000);
  windowInput.value = totalPrime;

  const chunkSizePrimeRaw = parseInt(chunkInput.value, 10) || 200;
  const chunkSizePrime = Math.min(Math.max(chunkSizePrimeRaw, 10), totalPrime);
  chunkInput.value = chunkSizePrime;

  const windowDstar = parseInt(alphaSelect.value, 10);

  connDot.classList.remove("red");
  connLabel.textContent = "Querying RPC...";
  refreshBtn.disabled = true;

  try {
    // latest zone block
    const latestHex = await rpcCall(url, "quai_blockNumber", []);
    const latestZoneBlock = parseInt(latestHex, 16);

    // scan more zone blocks than prime blocks to be safe
    const zoneWindow = Math.min(totalPrime * 5, 400000);
    const startZoneBlock = Math.max(0, latestZoneBlock - zoneWindow + 1);

    // 1) zone headers
    const zoneHeaders = await fetchZoneHeadersRange(
      url,
      startZoneBlock,
      latestZoneBlock,
      200
    );

    // 2) collect prime hashes
    const primeHashSet = new Set();
    for (let b = startZoneBlock; b <= latestZoneBlock; b++) {
      const zh = zoneHeaders[b];
      if (!zh) continue;
      const pHash = zh.primeTerminusHash;
      if (pHash) primeHashSet.add(pHash.toLowerCase());
    }
    const primeHashes = Array.from(primeHashSet);

    // 3) prime headers by hash
    const primeHeadersByHash = await fetchPrimeHeadersByHash(url, primeHashes, 200);

    // 4) map primeNumber -> {header, minerDiff}
    const primeByNum = new Map();

    for (let b = startZoneBlock; b <= latestZoneBlock; b++) {
      const zoneHeader = zoneHeaders[b];
      if (!zoneHeader) continue;

      const woZone = zoneHeader.woHeader || zoneHeader;

      // Número real del bloque Prime desde el header de zona
      const primeNumHex = woZone.primeTerminusNumber;
      const primeNum = primeNumHex ? hexToInt(primeNumHex) : null;
      if (!primeNum) continue;

      // Necesitamos sí o sí un primeTerminusHash válido para buscar el header Prime
      const pHashRaw = zoneHeader.primeTerminusHash;
      const pHash = pHashRaw ? pHashRaw.toLowerCase() : null;
      if (!pHash) continue;

      const primeHeader = primeHeadersByHash[pHash];
      if (!primeHeader) continue;

      const minerDiffHex =
        primeHeader.minerDifficulty ||
        (primeHeader.woHeader && primeHeader.woHeader.difficulty) ||
        zoneHeader.minerDifficulty ||
        (zoneHeader.woHeader && zoneHeader.woHeader.difficulty);

      if (!minerDiffHex) continue;

      // use BigInt-aware conversion and approximate to Number when needed
      const minerDiffBig = hexToBigInt(minerDiffHex);
      const minerDiff = bigIntToNumberApprox(minerDiffBig);
      if (minerDiff <= 0) continue;

      if (!primeByNum.has(primeNum)) {
        primeByNum.set(primeNum, { header: primeHeader, minerDiff });
      }
    }

    const allPrimeNums = Array
      .from(primeByNum.keys())
      .sort((a, b) => a - b);

    if (!allPrimeNums.length) {
      throw new Error("No Prime blocks found in this window.");
    }

    const startIndex = Math.max(0, allPrimeNums.length - totalPrime);
    const primeNums = allPrimeNums.slice(startIndex);

    // 5) build series (per Prime block)
    const series = [];
    let dWindow = [];

    const avg = (arr) => arr.reduce((acc, v) => acc + v, 0) / (arr.length || 1);

    for (const primeNum of primeNums) {
      const { header: pHeader, minerDiff } = primeByNum.get(primeNum);

      const adjDiff = minerDiff; // fast mode
      const dInstant = minerDiff / Math.log2(minerDiff);
      const dAdj = adjDiff / Math.log2(adjDiff);

      dWindow.push(dAdj);
      if (dWindow.length > windowDstar) dWindow.shift();
      const dStar = avg(dWindow);

      const ratio = dInstant !== 0 ? dStar / dInstant : 1;
      const deltaK = alphaCtrl * (ratio - 1) * 100;

      series.push({
        primeNum,
        header: pHeader,
        dInstant,
        dStar,
        deltaK,
        ratio,
      });
    }

    if (!series.length) {
      throw new Error("No valid Prime samples in this window.");
    }

    // 6) chunk series into points
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

      dValues.push(avg(chunk.map(x => x.dInstant)));
      dStarValues.push(avg(chunk.map(x => x.dStar)));
      dkValues.push(avg(chunk.map(x => x.deltaK)));
    }

    renderChart(labels, dValues, dStarValues, dkValues);

    // 7) latest Prime metrics
    const lastEntry = series[series.length - 1];
    const lastPrimeNum = lastEntry.primeNum;
    const lastPrimeHeader = lastEntry.header;
    const lastRatio = lastEntry.ratio;
    const lastDeltaK = lastEntry.deltaK;

    metricBlock.textContent = lastPrimeNum.toLocaleString("en-US");

    const tsHex =
      (lastPrimeHeader.woHeader && lastPrimeHeader.woHeader.timestamp) ||
      lastPrimeHeader.timestamp;
    const ts = tsHex ? new Date(hexToInt(tsHex) * 1000) : null;
    metricTs.textContent = ts
      ? "timestamp: " + ts.toLocaleString("en-US")
      : "timestamp: –";

    metricRatio.textContent = formatNumber(lastRatio, 4);
    metricRatioBadge.textContent =
      lastRatio > 1 ? "pro-Qi" : lastRatio < 1 ? "pro-Quai" : "neutral";

    metricRatioText.textContent =
      lastRatio > 1
        ? "FX zone favors Qi (d* > d)."
        : lastRatio < 1
        ? "FX zone favors Quai (d* < d)."
        : "FX is basically neutral (d* ≈ d).";

    metricRatioDot.style.background =
      lastRatio >= 1 ? "#4ade80" : "#f97373";
    metricRatioSide.textContent =
      lastRatio > 1
        ? "FX zone pro-Qi"
        : lastRatio < 1
        ? "FX zone pro-Quai"
        : "Approximate equilibrium";

    // ===== Exchange rate: 1 Qi = X Quai (match conversions.quai.network) =====
    const exHexPrime = lastPrimeHeader.exchangeRate;
    metricExrateHex.textContent = exHexPrime || "–";

    let rate = null;

    try {
      // 1 Qi = 1000 qits = 0x3e8 (según docs / quAI)
      const oneQiInQits = "0x3e8";

      // conversions.quai.network llama a quai_qiToQuai con el tag "latest"
      // para obtener el FX actual canónico.
      const qiToQuaiHex = await rpcCall(
        url,
        "quai_qiToQuai",
        [oneQiInQits, "latest"],
        { timeout: 10000, retries: 1 }
      );

      if (qiToQuaiHex) {
        const amountWei = hexToBigInt(qiToQuaiHex); // QUAI en wei (BigInt)
        if (amountWei > 0n) {
          // format safely using BigInt arithmetic to avoid Number overflow
          rate = formatWeiToQuai(amountWei, amountWei < 10n ** 18n ? 8 : 6);
        }
      }
    } catch (err) {
      console.warn("quai_qiToQuai RPC failed:", err);
    }

    // Sin estimaciones ni fallbacks: o tenemos valor exacto, o mostramos "–"
    if (rate !== null) {
      // rate may be a preformatted string from formatWeiToQuai
      metricExrate.textContent = String(rate);
    } else {
      metricExrate.textContent = "–";
    }

    // ===== ΔkQuai/kQuai =====
    metricDk.textContent = formatNumber(lastDeltaK, 4);
    metricDkText.textContent =
      "Controller α = 0.001 (per spec), estimated from d*/d (per Prime block).";
    metricDkDot.style.background =
      lastDeltaK >= 0 ? "#4ade80" : "#f97373";
    metricDkSide.textContent =
      lastDeltaK >= 0
        ? "kQuai tends to increase ⇒ more Quai per 1 Qi"
        : "kQuai tends to decrease ⇒ less Quai per 1 Qi";

    metricSideDot.style.background =
      lastRatio >= 1 ? "#4ade80" : "#f97373";
    metricSide.textContent =
      lastRatio > 1
        ? "d* > d ⇒ pro-Qi (more Quai per 1 Qi)."
        : lastRatio < 1
        ? "d* < d ⇒ pro-Quai (less Quai per 1 Qi)."
        : "Almost neutral (d* ≈ d).";

    statusDot.classList.remove("red");
    statusText.innerHTML =
      '<span class="em">OK</span> · ' +
      labels.length +
      " points (" +
      series.length +
      " Prime blocks). Last d*/d = " +
      formatNumber(lastRatio, 4);

    connLabel.textContent = "Connected (zone RPC → Prime)";
  } catch (err) {
    console.error(err);
    connDot.classList.add("red");
    connLabel.textContent = "RPC error";
    statusDot.classList.add("red");
    statusText.textContent = "Error querying node: " + err.message;
  } finally {
    refreshBtn.disabled = false;
    if (connSpinner) connSpinner.style.display = 'none';
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
          title: { display: true, text: "d, d* (Prime, chunk averages)" },
          ticks: { maxTicksLimit: 6 },
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

refreshBtn.addEventListener("click", () => { fetchWindowData(); });

autoBtn.addEventListener("click", () => {
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
    autoBtn.textContent = "Auto (10s)";
    autoBtn.classList.add("secondary");
  } else {
    fetchWindowData();
    autoInterval = setInterval(fetchWindowData, 10000);
    autoBtn.textContent = "Auto: ON";
    autoBtn.classList.remove("secondary");
  }
});

timeframeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const blocks = parseInt(btn.dataset.window, 10);
    windowInput.value = blocks;
    fetchWindowData();
  });
});

// Initial render after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchWindowData);
} else {
  fetchWindowData();
}

