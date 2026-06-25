import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { cloneKlineFixture, normalizeKlinePanelFixture } from './kline-panel.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const KLINE_SOURCE = 'mock-candle-projection';
const KLINE_PAYLOAD = 'kline_snapshot';
const STREAM_CUSTODY = 'public-read-only-no-custody';
const DEFAULT_MARKET_ID = 'WQUAI-WQI';
const DEFAULT_INTERVAL = '1m';
const STREAM_SAFETY_NOTICE =
  'Public kline/candle stream: read-only local/mock candle metadata only; no wallet loaded, no RPC URL, no signing, no broadcast, no transaction submission, and no funds moved.';

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

export const klineChannel = ({ marketId = DEFAULT_MARKET_ID, interval = DEFAULT_INTERVAL } = {}) => `market.${marketId}.klines.${interval}`;

export const buildKlineStreamUrl = ({
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
  interval = DEFAULT_INTERVAL,
} = {}) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', klineChannel({ marketId, interval }));
  return url.toString();
};

export const normalizeKlineStreamMessage = (message) => {
  assertObject(message, 'kline stream message');
  assertEqual(message.type, 'snapshot', 'kline stream message type');
  assertEqual(message.transport, 'websocket', 'kline stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'kline stream snapshot');
  assertEqual(snapshot.visibility, 'public', 'kline stream visibility');
  assertEqual(snapshot.payload, KLINE_PAYLOAD, 'kline stream payload');
  assertEqual(snapshot.source, KLINE_SOURCE, 'kline stream source');
  assertEqual(snapshot.custody, STREAM_CUSTODY, 'kline stream custody');

  if (!/^market\.[^.]+\.klines\.[^.]+$/.test(snapshot.channel ?? '')) {
    throw new Error('kline stream channel must be market.<MARKET>.klines.<interval>.');
  }

  const klines = normalizeKlinePanelFixture({
    ...(snapshot.data ?? {}),
    source: snapshot.data?.source ?? snapshot.source,
    payload: snapshot.payload,
    custody: snapshot.custody,
  });

  return {
    channel: snapshot.channel,
    payload: snapshot.payload,
    source: snapshot.source,
    custody: snapshot.custody,
    klines: cloneKlineFixture(klines),
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveKlineFixture = ({
  baseFixture,
  klines,
  channel,
  streamEvent,
} = {}) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(klines, 'kline fixture');

  const normalizedKlines = normalizeKlinePanelFixture(klines);
  const streamChannel = channel ?? klineChannel({
    marketId: normalizedKlines.marketId,
    interval: normalizedKlines.interval,
  });

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      klines: KLINE_SOURCE,
    },
    klines: cloneKlineFixture(normalizedKlines),
    klineStream: {
      channel: streamChannel,
      payload: KLINE_PAYLOAD,
      source: KLINE_SOURCE,
      custody: STREAM_CUSTODY,
      permissions: clone(normalizedKlines.permissions),
      safetyNotice: STREAM_SAFETY_NOTICE,
      projectionSafetyNotice: normalizedKlines.safety.notice,
      marketId: normalizedKlines.marketId,
      interval: normalizedKlines.interval,
      candleCount: normalizedKlines.candles.length,
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      streamEvent: streamEvent === undefined ? null : clone(streamEvent),
    },
  };
};

export const bindLiveKlineStream = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
  interval = DEFAULT_INTERVAL,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveKlineStream requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveKlineStream requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveKlineStream requires a WebSocket implementation.');
  }

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxKlineStream', 'error');
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const updateFromStream = (normalized) => {
    const fixture = createLiveKlineFixture({
      baseFixture,
      klines: normalized.klines,
      channel: normalized.channel,
      streamEvent: normalized.streamEvent,
    });

    setDatasetValue(mount, 'qdxKlineStream', fixture.klineStream.channel);
    setDatasetValue(mount, 'qdxKlineStreamSource', fixture.klineStream.source);
    setDatasetValue(mount, 'qdxKlineStreamCandles', String(fixture.klineStream.candleCount));

    mount.innerHTML = render(fixture);
    onUpdate(fixture);
  };

  const ws = new WebSocketImpl(buildKlineStreamUrl({ baseUrl, marketId, interval }));

  const handleMessage = (event) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      updateFromStream(normalizeKlineStreamMessage(payload));
    } catch (error) {
      reportError(error);
    }
  };

  const handleError = () => reportError(new Error('live public kline/candle WebSocket stream failed.'));

  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);

  return {
    url: ws.url,
    close() {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      if (ws.readyState !== 3) {
        ws.close();
      }
    },
  };
};
