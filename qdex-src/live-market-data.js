import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_MARKET_ID = 'WQUAI-WQI';
const PUBLIC_CUSTODY = 'public-read-only-no-custody';
const SAFE_PERMISSIONS = Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']);
const FORBIDDEN_PERMISSIONS = Object.freeze(['WITHDRAW', 'ADMIN']);
const TICKER_SOURCE = 'mock-market-data';
const DEPTH_SOURCE = 'mock-orderbook';
const TRADES_SOURCE = 'in-memory-indexer-projection';
const TRADE_FINALITY = 'confirmed-settlement-only';
const STREAM_SAFETY_NOTICE =
  'Public market-data streams: read-only local/mock ticker, depth, and confirmed trade projection metadata only; no wallet loaded, no RPC URL, no signing, no broadcast, no transaction submission, and no funds moved.';

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const CHANNEL_ORDER = Object.freeze(['tickers', 'depth', 'trades']);

const publicChannels = ({ marketId = DEFAULT_MARKET_ID } = {}) => Object.freeze({
  tickers: 'global.tickers',
  depth: `market.${marketId}.depth`,
  trades: `market.${marketId}.trades`,
});

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

const assertArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

const streamUrl = ({ baseUrl, channel }) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

const marketFromChannel = (channel, suffix) => {
  const prefix = 'market.';
  if (!channel.startsWith(prefix) || !channel.endsWith(suffix)) {
    return null;
  }

  const marketId = channel.slice(prefix.length, -suffix.length);
  return marketId.length > 0 ? marketId : null;
};

export const buildPublicMarketDataStreamUrls = ({
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
} = {}) => {
  const channels = publicChannels({ marketId });
  return Object.freeze({
    tickers: streamUrl({ baseUrl, channel: channels.tickers }),
    depth: streamUrl({ baseUrl, channel: channels.depth }),
    trades: streamUrl({ baseUrl, channel: channels.trades }),
  });
};

const normalizeTickerData = (data) => {
  assertObject(data, 'ticker stream data');
  assertArray(data.tickers, 'ticker stream rows');

  return {
    source: TICKER_SOURCE,
    tickers: data.tickers.map((ticker) => {
      assertObject(ticker, 'ticker stream row');
      assertEqual(ticker.source ?? TICKER_SOURCE, TICKER_SOURCE, 'ticker row source');
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

const normalizeDepthData = ({ data, marketId }) => {
  assertObject(data, 'depth stream data');
  assertArray(data.bids ?? [], 'depth bids');
  assertArray(data.asks ?? [], 'depth asks');
  assertEqual(data.source ?? DEPTH_SOURCE, DEPTH_SOURCE, 'depth data source');

  return {
    marketId: data.marketId ?? marketId,
    sequence: data.sequence ?? 0,
    bids: clone(data.bids ?? []),
    asks: clone(data.asks ?? []),
    source: DEPTH_SOURCE,
  };
};

const normalizeTradesData = ({ data, marketId }) => {
  assertObject(data, 'trades stream data');
  assertArray(data.trades ?? [], 'trades rows');
  assertEqual(data.source ?? TRADES_SOURCE, TRADES_SOURCE, 'trades data source');

  return {
    marketId: data.marketId ?? marketId,
    trades: clone(data.trades ?? []),
    source: TRADES_SOURCE,
  };
};

export const normalizePublicMarketDataStreamMessage = (message) => {
  assertObject(message, 'public market-data stream message');
  assertEqual(message.type, 'snapshot', 'public market-data stream message type');
  assertEqual(message.transport, 'websocket', 'public market-data stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'public market-data stream snapshot');
  assertEqual(snapshot.visibility, 'public', 'public market-data stream visibility');
  assertEqual(snapshot.custody, PUBLIC_CUSTODY, 'public market-data stream custody');

  if (snapshot.channel === 'global.tickers') {
    assertEqual(snapshot.payload, 'ticker_snapshot', 'ticker stream payload');
    assertEqual(snapshot.source, TICKER_SOURCE, 'ticker stream source');
    return {
      kind: 'tickers',
      channel: snapshot.channel,
      payload: snapshot.payload,
      source: snapshot.source,
      custody: snapshot.custody,
      data: normalizeTickerData(snapshot.data ?? { tickers: [] }),
      streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
    };
  }

  const depthMarket = marketFromChannel(snapshot.channel ?? '', '.depth');
  if (depthMarket !== null) {
    assertEqual(snapshot.payload, 'orderbook_depth', 'depth stream payload');
    assertEqual(snapshot.source, DEPTH_SOURCE, 'depth stream source');
    return {
      kind: 'depth',
      channel: snapshot.channel,
      marketId: depthMarket,
      payload: snapshot.payload,
      source: snapshot.source,
      custody: snapshot.custody,
      data: normalizeDepthData({ data: snapshot.data ?? {}, marketId: depthMarket }),
      streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
    };
  }

  const tradesMarket = marketFromChannel(snapshot.channel ?? '', '.trades');
  if (tradesMarket !== null) {
    assertEqual(snapshot.payload, 'trade_projection', 'trades stream payload');
    assertEqual(snapshot.source, TRADES_SOURCE, 'trades stream source');
    return {
      kind: 'trades',
      channel: snapshot.channel,
      marketId: tradesMarket,
      payload: snapshot.payload,
      source: snapshot.source,
      custody: snapshot.custody,
      finality: snapshot.finality ?? snapshot.data?.finality ?? TRADE_FINALITY,
      data: normalizeTradesData({ data: snapshot.data ?? {}, marketId: tradesMarket }),
      streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
    };
  }

  throw new Error('public market-data stream channel must be global.tickers, market.<MARKET>.depth, or market.<MARKET>.trades.');
};

const safePermissions = () => [...SAFE_PERMISSIONS];

const assertSafePermissions = (permissions) => {
  assertArray(permissions, 'public market-data stream permissions');
  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`public market-data stream permissions are unsafe: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}.`);
  }
};

export const createLivePublicMarketDataFixture = ({
  baseFixture,
  snapshots,
  marketId = DEFAULT_MARKET_ID,
} = {}) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(snapshots, 'public market-data snapshots');

  const orderedSnapshots = CHANNEL_ORDER
    .map((kind) => snapshots[kind])
    .filter((snapshot) => snapshot !== undefined && snapshot !== null);

  const tickers = snapshots.tickers?.data ?? { tickers: [] };
  const orderbook = snapshots.depth?.data ?? {
    marketId,
    sequence: baseFixture.orderbook?.sequence ?? 0,
    bids: baseFixture.orderbook?.bids ?? [],
    asks: baseFixture.orderbook?.asks ?? [],
    source: DEPTH_SOURCE,
  };
  const trades = snapshots.trades?.data ?? {
    marketId,
    trades: [],
    source: TRADES_SOURCE,
  };

  const channels = orderedSnapshots.map((snapshot) => snapshot.channel);
  const payloads = orderedSnapshots.map((snapshot) => snapshot.payload);
  const sources = orderedSnapshots.map((snapshot) => snapshot.source);
  const streamEvents = orderedSnapshots.map((snapshot) => ({
    channel: snapshot.channel,
    event: snapshot.streamEvent,
  }));
  const permissions = safePermissions();
  assertSafePermissions(permissions);

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      publicMarketData: sources,
    },
    publicMarketData: {
      marketId,
      tickers: clone(tickers),
      orderbook: clone(orderbook),
      trades: clone(trades),
      custody: PUBLIC_CUSTODY,
      permissions,
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
    },
    publicMarketDataStream: {
      channels,
      payloads,
      sources,
      custody: PUBLIC_CUSTODY,
      permissions: safePermissions(),
      safetyNotice: STREAM_SAFETY_NOTICE,
      marketId,
      tickerCount: tickers.tickers.length,
      bidCount: orderbook.bids.length,
      askCount: orderbook.asks.length,
      tradeCount: trades.trades.length,
      finality: snapshots.trades?.finality ?? TRADE_FINALITY,
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      streamEvents,
    },
  };
};

export const bindLivePublicMarketDataStreams = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  marketId = DEFAULT_MARKET_ID,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLivePublicMarketDataStreams requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLivePublicMarketDataStreams requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLivePublicMarketDataStreams requires a WebSocket implementation.');
  }

  const snapshots = {};
  const urls = buildPublicMarketDataStreamUrls({ baseUrl, marketId });
  const sockets = CHANNEL_ORDER.map((kind) => new WebSocketImpl(urls[kind]));

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxPublicMarketDataStreams', 'error');
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const updateFromStream = (normalized) => {
    snapshots[normalized.kind] = normalized;
    const fixture = createLivePublicMarketDataFixture({ baseFixture, snapshots, marketId });

    setDatasetValue(mount, 'qdxPublicMarketDataStreams', fixture.publicMarketDataStream.channels.join(','));
    setDatasetValue(mount, 'qdxPublicMarketDataStreamSources', fixture.publicMarketDataStream.sources.join(','));
    setDatasetValue(mount, 'qdxPublicMarketDataTickerCount', String(fixture.publicMarketDataStream.tickerCount));
    setDatasetValue(mount, 'qdxPublicMarketDataTradeCount', String(fixture.publicMarketDataStream.tradeCount));

    mount.innerHTML = render(fixture);
    onUpdate(fixture);
  };

  const handleMessage = (event) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      updateFromStream(normalizePublicMarketDataStreamMessage(payload));
    } catch (error) {
      reportError(error);
    }
  };

  const handleError = () => reportError(new Error('live public market-data WebSocket stream failed.'));

  for (const socket of sockets) {
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('error', handleError);
  }

  return {
    urls: sockets.map((socket) => socket.url),
    close() {
      for (const socket of sockets) {
        socket.removeEventListener('message', handleMessage);
        socket.removeEventListener('error', handleError);
        if (socket.readyState !== 3) {
          socket.close();
        }
      }
    },
  };
};
