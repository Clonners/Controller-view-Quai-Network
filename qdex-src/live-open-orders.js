import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeOpenOrdersPanelFixture } from './open-orders-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const ORDER_SOURCE = 'mock-order-projection';
const ORDER_PROJECTION_TYPE = 'LocalOrderProjection';
const ORDER_CUSTODY = 'non-custodial-no-withdrawal-authority';
const STREAM_CUSTODY = 'non-custodial-no-withdrawal-authority';
const STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const OPEN_ORDERS_CHANNELS = ['open-orders'];

const CHANNEL_CONFIG = Object.freeze({
  'open-orders': Object.freeze({
    collection: 'orders',
    payload: 'open_orders_projection',
    projectionType: 'LocalOrderProjection',
  }),
});

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

const assertArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
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

const assertMockEvidenceIsNull = (envelope, label) => {
  for (const key of ['settlementTx', 'blockNumber', 'blockHash', 'eventIndex', 'explorerUrl']) {
    if (envelope[key] !== null) {
      throw new Error(`${label} ${key} must be null for local/mock open orders stream rows.`);
    }
  }
};

const assertOpenOrdersEnvelope = ({ channel, envelope }) => {
  const config = CHANNEL_CONFIG[channel];
  assertObject(envelope, `${channel} open orders stream envelope`);
  assertEqual(envelope.source, ORDER_SOURCE, `${channel} open orders source`);
  assertEqual(envelope.projectionType, config.projectionType, `${channel} open orders projectionType`);
  assertEqual(envelope.custody, ORDER_CUSTODY, `${channel} open orders custody`);
  assertSafePermissions(envelope.permissions, `${channel} open orders permissions`);
  assertEqual(envelope.matcherLocalOnly, true, `${channel} open orders matcherLocalOnly`);
  assertEqual(envelope.settlementMode, 'mock', `${channel} open orders settlementMode`);
  assertEqual(envelope.realQuaiTransactions, false, `${channel} open orders realQuaiTransactions`);
  assertEqual(envelope.walletRequired, false, `${channel} open orders walletRequired`);
  assertEqual(envelope.fundsMoved, false, `${channel} open orders fundsMoved`);
  assertEqual(envelope.tradingVaultMutation, false, `${channel} open orders tradingVaultMutation`);
  assertMockEvidenceIsNull(envelope, `${channel} open orders`);

  assertArray(envelope[config.collection], `${channel} open orders ${config.collection}`);

  if (!String(envelope.safetyNotice ?? '').includes('Mock open orders')) {
    throw new Error(`${channel} open orders safetyNotice must name the Mock open orders projection.`);
  }
};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

const orderCount = (openOrders) =>
  (openOrders.orders?.length ?? 0);

const sortedChannels = (channels) => OPEN_ORDERS_CHANNELS.filter((channel) => channels.includes(channel));

export const buildOpenOrdersStreamUrl = ({
  baseUrl = DEFAULT_API_BASE_URL,
  channel = 'open-orders',
} = {}) => {
  if (!OPEN_ORDERS_CHANNELS.includes(channel)) {
    throw new Error(`unsupported open orders stream channel: ${channel}`);
  }

  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

export const normalizeOpenOrdersStreamMessage = (message) => {
  assertObject(message, 'open orders stream message');
  assertEqual(message.type, 'snapshot', 'open orders stream message type');
  assertEqual(message.transport, 'websocket', 'open orders stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'open orders stream snapshot');

  const config = CHANNEL_CONFIG[snapshot.channel];
  if (config === undefined) {
    throw new Error(`unsupported open orders stream channel: ${snapshot.channel}`);
  }

  assertEqual(snapshot.visibility, 'private', `${snapshot.channel} stream visibility`);
  assertEqual(snapshot.payload, config.payload, `${snapshot.channel} stream payload`);
  assertEqual(snapshot.source, ORDER_SOURCE, `${snapshot.channel} stream source`);
  assertEqual(snapshot.custody, STREAM_CUSTODY, `${snapshot.channel} stream custody`);
  assertSafePermissions(snapshot.permissions, 'unsafe private open orders stream permissions');

  if (snapshot.safetyNotice !== STREAM_SAFETY_NOTICE) {
    throw new Error('open orders stream safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }

  assertOpenOrdersEnvelope({ channel: snapshot.channel, envelope: snapshot.data });

  return {
    channel: snapshot.channel,
    payload: snapshot.payload,
    source: snapshot.source,
    custody: snapshot.custody,
    permissions: clone(snapshot.permissions),
    safetyNotice: snapshot.safetyNotice,
    openOrdersEnvelope: clone(snapshot.data),
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveOpenOrdersFixture = ({
  baseFixture,
  openOrders,
  receivedChannels,
  streamEvents,
} = {}) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(openOrders, 'open orders fixture');

  const normalizedOpenOrders = normalizeOpenOrdersPanelFixture(openOrders);
  const channels = sortedChannels(receivedChannels ?? []);

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      openOrders: ORDER_SOURCE,
    },
    openOrders: clone(normalizedOpenOrders),
    openOrdersStream: {
      channels,
      source: ORDER_SOURCE,
      custody: STREAM_CUSTODY,
      permissions: [...SAFE_PERMISSIONS],
      safetyNotice: STREAM_SAFETY_NOTICE,
      projectionSafetyNotices: {
        orders: normalizedOpenOrders.safetyNotice,
      },
      matcherLocalOnly: true,
      settlementMode: 'mock',
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      orderCount: orderCount(normalizedOpenOrders),
      streamEvents: clone(streamEvents ?? []),
    },
    custody: {
      note: STREAM_CUSTODY,
      withdrawalAuthority: 'owner-wallet-only',
    },
  };
};

export const createOpenOrdersFromEnvelope = (envelope) => {
  assertObject(envelope, 'open orders envelope');
  return {
    orders: clone(envelope.orders ?? []),
    source: envelope.source,
    projectionType: envelope.projectionType ?? 'LocalOrderProjection',
    custody: envelope.custody ?? ORDER_CUSTODY,
    permissions: clone(envelope.permissions ?? SAFE_PERMISSIONS),
    matcherLocalOnly: envelope.matcherLocalOnly ?? true,
    settlementMode: envelope.settlementMode ?? 'mock',
    settlementTx: envelope.settlementTx ?? null,
    blockNumber: envelope.blockNumber ?? null,
    blockHash: envelope.blockHash ?? null,
    eventIndex: envelope.eventIndex ?? null,
    explorerUrl: envelope.explorerUrl ?? null,
    realQuaiTransactions: envelope.realQuaiTransactions ?? false,
    walletRequired: envelope.walletRequired ?? false,
    fundsMoved: envelope.fundsMoved ?? false,
    tradingVaultMutation: envelope.tradingVaultMutation ?? false,
    safetyNotice: envelope.safetyNotice ?? 'Mock open orders only: no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.',
  };
};

export const bindLiveOpenOrdersStreams = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveOpenOrdersStreams requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveOpenOrdersStreams requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveOpenOrdersStreams requires a WebSocket implementation.');
  }

  const currentOpenOrders = createOpenOrdersFromEnvelope(baseFixture.openOrders ?? {});
  const receivedChannels = [];
  const streamEvents = [];

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxFillOpenOrdersStreams', 'error');
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const updateFromStream = (normalized) => {
    if (!receivedChannels.includes(normalized.channel)) {
      receivedChannels.push(normalized.channel);
    }

    currentOpenOrders.orders = normalized.openOrdersEnvelope.orders;

    streamEvents.push({
      channel: normalized.channel,
      event: normalized.streamEvent,
    });

    const fixture = createLiveOpenOrdersFixture({
      baseFixture,
      openOrders: currentOpenOrders,
      receivedChannels,
      streamEvents,
    });

    setDatasetValue(mount, 'qdxFillOpenOrdersStreams', fixture.openOrdersStream.channels.join(','));
    setDatasetValue(mount, 'qdxFillOpenOrdersStreamSource', fixture.openOrdersStream.source);
    setDatasetValue(mount, 'qdxFillOpenOrdersStreamRows', String(fixture.openOrdersStream.orderCount));

    mount.innerHTML = render(fixture);
    onUpdate(fixture);
  };

  const bindings = OPEN_ORDERS_CHANNELS.map((channel) => {
    const ws = new WebSocketImpl(buildOpenOrdersStreamUrl({ baseUrl, channel }));

    const handleMessage = (event) => {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        updateFromStream(normalizeOpenOrdersStreamMessage(payload));
      } catch (error) {
        reportError(error);
      }
    };

    const handleError = () => reportError(new Error(`live open orders ${channel} WebSocket stream failed.`));

    ws.addEventListener('message', handleMessage);
    ws.addEventListener('error', handleError);

    return { ws, handleMessage, handleError };
  });

  return {
    urls: bindings.map(({ ws }) => ws.url),
    close() {
      for (const { ws, handleMessage, handleError } of bindings) {
        ws.removeEventListener('message', handleMessage);
        ws.removeEventListener('error', handleError);
        if (ws.readyState !== 3) {
          ws.close();
        }
      }
    },
  };
};
