import { bindLivePublicMarketDataStreams } from './live-market-data.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_MARKET_ID = 'WQUAI-WQI';
const TICKER_SOURCE = 'mock-market-data';
const DEPTH_SOURCE = 'mock-orderbook';
const TRADES_SOURCE = 'in-memory-indexer-projection';
const STREAM_CUSTODY = 'public-read-only-no-custody';
const TRADE_FINALITY = 'confirmed-settlement-only';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const SOURCE_JOIN = `${TICKER_SOURCE},${DEPTH_SOURCE},${TRADES_SOURCE}`;

const noop = () => {};
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requiredChannels = (marketId) => [
  'global.tickers',
  `market.${marketId}.depth`,
  `market.${marketId}.trades`,
];

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

const assertArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
};

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label} must be ${expected}.`);
  }
};

const assertSafePermissions = (permissions, label) => {
  assertArray(permissions, `${label} permissions`);
  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`${label} permissions are unsafe: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}.`);
  }
};

const fetchJson = async ({ url, fetchImpl }) => {
  const response = await fetchImpl(url.toString(), { method: 'GET' });
  if (!response.ok) {
    throw new Error(`GET ${url.pathname} failed with HTTP ${response.status}.`);
  }
  return response.json();
};

const normalizeTickerRestEnvelope = (payload) => {
  assertObject(payload, 'REST ticker snapshot');
  assertArray(payload.tickers, 'REST ticker rows');

  return {
    source: TICKER_SOURCE,
    tickers: payload.tickers.map((ticker) => {
      assertObject(ticker, 'REST ticker row');
      assertEqual(ticker.source ?? TICKER_SOURCE, TICKER_SOURCE, 'REST ticker source');
      return {
        marketId: ticker.marketId ?? DEFAULT_MARKET_ID,
        lastPrice: ticker.lastPrice ?? null,
        bestBid: ticker.bestBid ?? null,
        bestAsk: ticker.bestAsk ?? null,
        volume24h: ticker.volume24h ?? '0',
        source: TICKER_SOURCE,
      };
    }),
  };
};

const normalizeOrderbookRestEnvelope = ({ payload, marketId }) => {
  assertObject(payload, 'REST orderbook snapshot');
  assertArray(payload.bids ?? [], 'REST orderbook bids');
  assertArray(payload.asks ?? [], 'REST orderbook asks');
  assertEqual(payload.source ?? DEPTH_SOURCE, DEPTH_SOURCE, 'REST orderbook source');

  return {
    marketId: payload.marketId ?? marketId,
    sequence: payload.sequence ?? 0,
    bids: clone(payload.bids ?? []),
    asks: clone(payload.asks ?? []),
    source: DEPTH_SOURCE,
  };
};

const normalizeTradesRestEnvelope = ({ payload, marketId }) => {
  assertObject(payload, 'REST trades snapshot');
  assertArray(payload.trades ?? [], 'REST trade rows');
  assertEqual(payload.source ?? TRADES_SOURCE, TRADES_SOURCE, 'REST trades source');

  return {
    marketId: payload.marketId ?? marketId,
    trades: clone(payload.trades ?? []),
    source: TRADES_SOURCE,
  };
};

export const fetchPublicMarketDataRestSnapshots = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchPublicMarketDataRestSnapshots requires a fetch implementation.');
  }

  const tickerUrl = new URL('/v1/tickers', baseUrl);
  const orderbookUrl = new URL(`/v1/orderbook/${encodeURIComponent(marketId)}`, baseUrl);
  const tradesUrl = new URL(`/v1/trades/${encodeURIComponent(marketId)}`, baseUrl);

  const [tickers, orderbook, trades] = await Promise.all([
    fetchJson({ url: tickerUrl, fetchImpl }).then(normalizeTickerRestEnvelope),
    fetchJson({ url: orderbookUrl, fetchImpl }).then((payload) => normalizeOrderbookRestEnvelope({ payload, marketId })),
    fetchJson({ url: tradesUrl, fetchImpl }).then((payload) => normalizeTradesRestEnvelope({ payload, marketId })),
  ]);

  return {
    tickers,
    orderbook,
    trades,
  };
};

const hasAllPublicMarketDataChannels = ({ fixture, marketId }) => {
  const channels = fixture?.publicMarketDataStream?.channels ?? [];
  return requiredChannels(marketId).every((channel) => channels.includes(channel));
};

const assertStreamFixtureMatchesRestSnapshots = ({ fixture, restSnapshots, marketId }) => {
  assertObject(fixture, 'public market-data stream fixture');
  assertObject(fixture.publicMarketData, 'public market-data stream panel fixture');
  assertObject(fixture.publicMarketDataStream, 'public market-data stream metadata fixture');

  const expectedChannels = requiredChannels(marketId);
  assertEqual(fixture.publicMarketData.marketId, marketId, 'public market-data marketId');
  assertEqual(fixture.publicMarketData.custody, STREAM_CUSTODY, 'public market-data custody');
  assertSafePermissions(fixture.publicMarketData.permissions, 'public market-data panel');
  assertSafePermissions(fixture.publicMarketDataStream.permissions, 'public market-data stream');

  if (JSON.stringify(fixture.publicMarketDataStream.channels) !== JSON.stringify(expectedChannels)) {
    throw new Error('Public market-data stream channels must include ticker, depth, and trades before rendering.');
  }
  if (JSON.stringify(fixture.publicMarketDataStream.sources) !== JSON.stringify([TICKER_SOURCE, DEPTH_SOURCE, TRADES_SOURCE])) {
    throw new Error('Public market-data stream sources must match REST ticker/depth/trades snapshots before rendering.');
  }
  if (JSON.stringify(fixture.publicMarketData.tickers) !== JSON.stringify(restSnapshots.tickers)) {
    throw new Error('Public ticker stream rows must match the REST ticker snapshot before rendering.');
  }
  if (JSON.stringify(fixture.publicMarketData.orderbook) !== JSON.stringify(restSnapshots.orderbook)) {
    throw new Error('Public orderbook stream rows must match the REST orderbook snapshot before rendering.');
  }
  if (JSON.stringify(fixture.publicMarketData.trades) !== JSON.stringify(restSnapshots.trades)) {
    throw new Error('Public trades stream rows must match the REST trades snapshot before rendering.');
  }

  for (const [key, expected] of Object.entries({
    custody: STREAM_CUSTODY,
    finality: TRADE_FINALITY,
    tickerCount: restSnapshots.tickers.tickers.length,
    bidCount: restSnapshots.orderbook.bids.length,
    askCount: restSnapshots.orderbook.asks.length,
    tradeCount: restSnapshots.trades.trades.length,
    realQuaiTransactions: false,
    walletRequired: false,
    fundsMoved: false,
    tradingVaultMutation: false,
  })) {
    assertEqual(fixture.publicMarketDataStream[key], expected, `public market-data stream ${key}`);
  }
};

export const bindLivePublicMarketDataStreamsWithRestSnapshots = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = globalThis.WebSocket,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onRestSnapshots = noop,
  onStreamUpdate = noop,
  onRestError = noop,
  onStreamError = noop,
} = {}) => {
  let restSnapshots;

  try {
    restSnapshots = await fetchPublicMarketDataRestSnapshots({ baseUrl, marketId, fetchImpl });
    setDatasetValue(mount, 'qdxPublicMarketDataRestSnapshots', SOURCE_JOIN);
    onRestSnapshots(clone(restSnapshots));
  } catch (error) {
    setDatasetValue(mount, 'qdxPublicMarketDataRestSnapshots', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLivePublicMarketDataStreams({
    mount,
    baseUrl,
    marketId,
    baseFixture: {
      ...baseFixture,
      publicMarketData: {
        marketId,
        ...clone(restSnapshots),
        custody: STREAM_CUSTODY,
        permissions: [...SAFE_PERMISSIONS],
        realQuaiTransactions: false,
        walletRequired: false,
        fundsMoved: false,
        tradingVaultMutation: false,
      },
    },
    render: (fixture) => {
      if (!hasAllPublicMarketDataChannels({ fixture, marketId })) {
        return mount?.innerHTML ?? '';
      }

      assertStreamFixtureMatchesRestSnapshots({ fixture, restSnapshots, marketId });
      setDatasetValue(mount, 'qdxPublicMarketDataStreamRestAgreement', SOURCE_JOIN);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxPublicMarketDataStreams', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      if (!hasAllPublicMarketDataChannels({ fixture, marketId })) {
        return;
      }

      setDatasetValue(mount, 'qdxPublicMarketDataStreamRestAgreement', SOURCE_JOIN);
      onStreamUpdate(fixture, clone(restSnapshots));
    },
  });

  return {
    restSnapshots: clone(restSnapshots),
    close() {
      streamBinding.close();
    },
  };
};
