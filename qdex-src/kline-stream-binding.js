import { bindLiveKlineStream } from './live-klines.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { cloneKlineFixture, normalizeKlinePanelFixture } from './kline-panel.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_MARKET_ID = 'WQUAI-WQI';
const DEFAULT_INTERVAL = '1m';
const KLINE_SOURCE = 'mock-candle-projection';
const STREAM_CUSTODY = 'public-read-only-no-custody';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];

const noop = () => {};
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

const assertObject = (value, label) => {
  if (!isObject(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
};

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label} must be ${expected}.`);
  }
};

const assertSafePermissions = (permissions, label) => {
  if (!Array.isArray(permissions)) {
    throw new Error(`${label}: permissions must be an array.`);
  }

  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`${label}: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}`);
  }
};

const normalizeRestKlines = (payload) => cloneKlineFixture(normalizeKlinePanelFixture({
  ...payload,
  payload: payload?.payload ?? 'kline_snapshot',
  custody: payload?.custody ?? STREAM_CUSTODY,
  permissions: payload?.permissions ?? SAFE_PERMISSIONS,
}));

export const fetchKlineApiEnvelope = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
  interval = DEFAULT_INTERVAL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchKlineApiEnvelope requires a fetch implementation.');
  }

  const url = new URL(`/v1/klines/${encodeURIComponent(marketId)}`, baseUrl);
  url.searchParams.set('interval', interval);

  const response = await fetchImpl(url.toString(), { method: 'GET' });
  if (!response.ok) {
    throw new Error(`GET ${url.pathname} failed with HTTP ${response.status}.`);
  }

  return normalizeRestKlines(await response.json());
};

const assertKlineEnvelopeMatchesRest = ({ streamKlines, restKlines }) => {
  assertObject(streamKlines, 'kline stream panel envelope');
  assertObject(restKlines, 'REST kline panel envelope');

  for (const key of [
    'marketId',
    'interval',
    'source',
    'payload',
    'custody',
    'realQuaiTransactions',
    'walletRequired',
    'fundsMoved',
    'tradingVaultMutation',
  ]) {
    assertEqual(streamKlines[key], restKlines[key], `kline ${key}`);
  }

  assertEqual(streamKlines.source, KLINE_SOURCE, 'kline source');
  assertEqual(streamKlines.payload, 'kline_snapshot', 'kline payload');
  assertEqual(streamKlines.custody, STREAM_CUSTODY, 'kline custody');
  assertSafePermissions(streamKlines.permissions, 'kline stream permissions');
  assertSafePermissions(restKlines.permissions, 'REST kline permissions');

  if (JSON.stringify(streamKlines.permissions) !== JSON.stringify(restKlines.permissions)) {
    throw new Error('Kline stream permissions must match the REST snapshot before rendering.');
  }

  if (JSON.stringify(streamKlines.candles) !== JSON.stringify(restKlines.candles)) {
    throw new Error('Kline stream candle rows must match the REST snapshot before rendering.');
  }

  assertObject(streamKlines.safety, 'kline stream safety');
  assertObject(restKlines.safety, 'REST kline safety');
  for (const key of [
    'noWalletLoading',
    'noRpcUrlAccess',
    'noSigning',
    'noBroadcast',
    'noDeploys',
    'noTransactionSubmission',
    'noFundsMovement',
    'noCustodyAuthority',
    'notice',
  ]) {
    assertEqual(streamKlines.safety[key], restKlines.safety[key], `kline safety.${key}`);
  }
};

const assertStreamFixtureMatchesRestSnapshot = ({ fixture, restSnapshot }) => {
  assertObject(fixture, 'kline stream fixture');
  assertObject(fixture.klines, 'kline stream fixture panel');
  assertObject(fixture.klineStream, 'kline stream fixture metadata');

  assertKlineEnvelopeMatchesRest({ streamKlines: fixture.klines, restKlines: restSnapshot });
  assertEqual(fixture.klineStream.source, KLINE_SOURCE, 'kline stream source');
  assertEqual(fixture.klineStream.payload, 'kline_snapshot', 'kline stream payload');
  assertEqual(fixture.klineStream.custody, STREAM_CUSTODY, 'kline stream custody');
  assertSafePermissions(fixture.klineStream.permissions, 'kline stream metadata permissions');
  assertEqual(fixture.klineStream.marketId, restSnapshot.marketId, 'kline stream marketId');
  assertEqual(fixture.klineStream.interval, restSnapshot.interval, 'kline stream interval');
  assertEqual(fixture.klineStream.candleCount, restSnapshot.candles.length, 'kline stream candleCount');
  assertEqual(fixture.klineStream.realQuaiTransactions, false, 'kline stream realQuaiTransactions');
  assertEqual(fixture.klineStream.walletRequired, false, 'kline stream walletRequired');
  assertEqual(fixture.klineStream.fundsMoved, false, 'kline stream fundsMoved');
  assertEqual(fixture.klineStream.tradingVaultMutation, false, 'kline stream tradingVaultMutation');
};

export const bindLiveKlineStreamWithRestSnapshot = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
  interval = DEFAULT_INTERVAL,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = globalThis.WebSocket,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onRestSnapshot = noop,
  onStreamUpdate = noop,
  onRestError = noop,
  onStreamError = noop,
} = {}) => {
  let restSnapshot;

  try {
    restSnapshot = await fetchKlineApiEnvelope({ baseUrl, marketId, interval, fetchImpl });
    setDatasetValue(mount, 'qdxKlineRestSnapshot', restSnapshot.source);
    onRestSnapshot(clone(restSnapshot));
  } catch (error) {
    setDatasetValue(mount, 'qdxKlineRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLiveKlineStream({
    mount,
    baseUrl,
    marketId,
    interval,
    baseFixture: {
      ...baseFixture,
      klines: clone(restSnapshot),
    },
    render: (fixture) => {
      assertStreamFixtureMatchesRestSnapshot({ fixture, restSnapshot });
      setDatasetValue(mount, 'qdxKlineStreamRestAgreement', KLINE_SOURCE);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxKlineStream', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxKlineStreamRestAgreement', KLINE_SOURCE);
      onStreamUpdate(fixture, clone(restSnapshot));
    },
  });

  return {
    klines: clone(restSnapshot),
    close() {
      streamBinding.close();
    },
  };
};
