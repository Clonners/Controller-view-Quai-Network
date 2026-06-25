const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const ORDER_STREAM_CHANNEL = 'orders';
const ORDER_SOURCE = 'mock-order-projection';
const CUSTODY_NOTE = 'non-custodial-no-withdrawal-authority';
const SAFE_PRIVATE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const SAFE_CANCELLATION_PERMISSIONS = ['NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const MOCK_STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';
const CANCELLATION_NONCE_NOTE = 'matcher-local-cancel-only-on-chain-nonce-unchanged';

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

const assertPermissions = ({ permissions, required, label }) => {
  if (!Array.isArray(permissions)) {
    throw new Error(`${label}: permissions must be an array.`);
  }

  const missing = required.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));

  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`${label}: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}`);
  }
};

const assertPrivateOrderPermissions = (permissions) => assertPermissions({
  permissions,
  required: SAFE_PRIVATE_PERMISSIONS,
  label: 'unsafe private order stream permissions',
});

const assertCancellationPermissions = (permissions, reason) => {
  const required = [reason === 'matcher_local_orders_cancelled' ? 'CANCEL_ALL' : 'CANCEL_ORDER', ...SAFE_CANCELLATION_PERMISSIONS];
  assertPermissions({
    permissions,
    required,
    label: 'unsafe order cancellation stream permissions',
  });
};

const requireOrderShape = (order) => {
  assertObject(order, 'order projection');

  for (const field of ['orderHash', 'marketId', 'side', 'price', 'amount', 'remainingAmount', 'status']) {
    if (order[field] === undefined || order[field] === null || order[field] === '') {
      throw new Error(`order projection is missing ${field}.`);
    }
  }

  if (Object.hasOwn(order, 'createdAt')) {
    throw new Error('order projection must not expose matcher-local createdAt.');
  }

  if (order.status === 'cancelled') {
    assertEqual(order.remainingAmount, '0', 'cancelled order remainingAmount');
    assertEqual(order.nonceCancellation, 'not-implied-matcher-local-only', 'cancelled order nonceCancellation');
  }
};

const isCancellationReason = (reason) => reason === 'matcher_local_order_cancelled' || reason === 'matcher_local_orders_cancelled';

const normalizeStreamEvent = (streamEvent) => {
  if (streamEvent === undefined) {
    return null;
  }

  assertObject(streamEvent, 'order stream event');
  if (!isCancellationReason(streamEvent.reason)) {
    return clone(streamEvent);
  }

  assertEqual(streamEvent.nonceManager, CANCELLATION_NONCE_NOTE, 'order cancellation stream nonceManager');
  assertCancellationPermissions(streamEvent.permissions, streamEvent.reason);

  if (!Array.isArray(streamEvent.cancelledOrderHashes) || streamEvent.cancelledOrderHashes.length === 0) {
    throw new Error('order cancellation stream must include cancelledOrderHashes.');
  }

  if (typeof streamEvent.message !== 'string' || !/does not cancel the on-chain nonce/i.test(streamEvent.message)) {
    throw new Error('order cancellation stream message must say it does not cancel the on-chain nonce.');
  }

  return clone(streamEvent);
};

export const buildOrderStreamUrl = ({ baseUrl = DEFAULT_API_BASE_URL, channel = ORDER_STREAM_CHANNEL } = {}) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

export const normalizeOrderStreamMessage = (message) => {
  assertObject(message, 'order stream message');
  assertEqual(message.type, 'snapshot', 'order stream message type');
  assertEqual(message.transport, 'websocket', 'order stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'order stream snapshot');
  assertEqual(snapshot.channel, ORDER_STREAM_CHANNEL, 'order stream channel');
  assertEqual(snapshot.visibility, 'private', 'order stream visibility');
  assertEqual(snapshot.payload, 'order_projection', 'order stream payload');
  assertEqual(snapshot.source, ORDER_SOURCE, 'order stream source');
  assertEqual(snapshot.custody, CUSTODY_NOTE, 'order stream custody');
  assertPrivateOrderPermissions(snapshot.permissions);

  if (snapshot.safetyNotice !== MOCK_STREAM_SAFETY_NOTICE) {
    throw new Error('order stream safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }

  assertObject(snapshot.data, 'order stream snapshot data');
  assertEqual(snapshot.data.source, ORDER_SOURCE, 'order stream data source');
  if (!Array.isArray(snapshot.data.orders)) {
    throw new Error('order stream data.orders must be an array.');
  }

  const orders = clone(snapshot.data.orders);
  for (const order of orders) {
    requireOrderShape(order);
  }

  const streamEvent = normalizeStreamEvent(message.streamEvent);

  return {
    channel: snapshot.channel,
    source: snapshot.source,
    custody: snapshot.custody,
    permissions: clone(snapshot.permissions),
    safetyNotice: snapshot.safetyNotice,
    orders,
    streamEvent,
  };
};

export const createLiveOrderStreamFixture = ({ baseFixture, normalizedOrderStream }) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(normalizedOrderStream, 'normalized order stream');

  const streamEvent = normalizedOrderStream.streamEvent;
  const cancellationPermissions = streamEvent?.permissions === undefined ? [] : clone(streamEvent.permissions);
  const cancelledOrderHashes = streamEvent?.cancelledOrderHashes === undefined ? [] : clone(streamEvent.cancelledOrderHashes);

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      orders: normalizedOrderStream.source,
    },
    orders: clone(normalizedOrderStream.orders),
    custody: {
      note: CUSTODY_NOTE,
      withdrawalAuthority: 'owner-wallet-only',
    },
    orderStream: {
      channel: normalizedOrderStream.channel,
      source: normalizedOrderStream.source,
      custody: normalizedOrderStream.custody,
      permissions: clone(normalizedOrderStream.permissions),
      cancellationPermissions,
      safetyNotice: normalizedOrderStream.safetyNotice,
      streamEvent,
      nonceManager: streamEvent?.nonceManager ?? null,
      cancelledOrderHashes,
      message: streamEvent?.message ?? null,
    },
  };
};

export const bindLiveOrderStream = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture,
  render,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveOrderStream requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveOrderStream requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveOrderStream requires a WebSocket implementation.');
  }

  const url = buildOrderStreamUrl({ baseUrl, channel: ORDER_STREAM_CHANNEL });
  const ws = new WebSocketImpl(url);

  const reportError = (error) => {
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const handleMessage = (event) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      const normalized = normalizeOrderStreamMessage(payload);
      const fixture = createLiveOrderStreamFixture({
        baseFixture,
        normalizedOrderStream: normalized,
      });

      mount.innerHTML = render(fixture);
      onUpdate(fixture);
    } catch (error) {
      reportError(error);
    }
  };

  const handleError = () => reportError(new Error('live order WebSocket stream failed.'));

  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);

  return {
    url,
    close() {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      if (ws.readyState !== 3) {
        ws.close();
      }
    },
  };
};
