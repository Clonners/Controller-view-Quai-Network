import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeNonceCancellationHistoryPanelFixture } from './nonce-cancellation-history-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'nonce-manager-event-projection';
const STREAM_CUSTODY = 'non-custodial-no-withdrawal-authority';
const HISTORY_CUSTODY = 'non-custodial-no-withdrawal-authority';
const STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const NONCE_CANCELLATION_CHANNELS = ['nonce-cancellations'];

const CHANNEL_CONFIG = Object.freeze({
  'nonce-cancellations': Object.freeze({
    collection: 'cancellations',
    payload: 'nonce_cancellation_projection',
    projectionType: 'NonceCancelledProjection',
    eventName: 'NonceCancelled',
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
      throw new Error(`${label} ${key} must be null for local/mock nonce cancellation stream rows.`);
    }
  }
};

const assertNonceCancellationEnvelope = ({ channel, envelope }) => {
  const config = CHANNEL_CONFIG[channel];
  assertObject(envelope, `${channel} NonceManager history stream envelope`);
  assertEqual(envelope.source, HISTORY_SOURCE, `${channel} history source`);
  assertEqual(envelope.projectionType, config.projectionType, `${channel} history projectionType`);
  assertEqual(envelope.eventName, config.eventName, `${channel} history eventName`);
  assertEqual(envelope.custody, HISTORY_CUSTODY, `${channel} history custody`);
  assertSafePermissions(envelope.permissions, `${channel} history permissions`);
  assertEqual(envelope.settlementMode, 'mock', `${channel} history settlementMode`);
  assertEqual(envelope.realQuaiTransactions, false, `${channel} history realQuaiTransactions`);
  assertEqual(envelope.walletRequired, false, `${channel} history walletRequired`);
  assertEqual(envelope.fundsMoved, false, `${channel} history fundsMoved`);
  assertEqual(envelope.tradingVaultMutation, false, `${channel} history tradingVaultMutation`);
  assertEqual(envelope.nonceManagerMutation, false, `${channel} history nonceManagerMutation`);
  assertMockEvidenceIsNull(envelope, `${channel} history`);

  if (!Array.isArray(envelope[config.collection])) {
    throw new Error(`${channel} history ${config.collection} must be an array.`);
  }

  if (!String(envelope.safetyNotice ?? '').includes('Read-only NonceManager')) {
    throw new Error(`${channel} history safetyNotice must name the read-only NonceManager projection.`);
  }

  if (!/nonce-manager-event-projection/i.test(envelope.safetyNotice)) {
    throw new Error(`${channel} history safetyNotice must preserve nonce-manager-event-projection source reference.`);
  }

  if (!/settlementMode[:\s]+mock/i.test(envelope.safetyNotice)) {
    throw new Error(`${channel} history safetyNotice must preserve mock settlementMode.`);
  }
};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

const rowCount = (nonceHistory) =>
  (nonceHistory.cancellations?.cancellations?.length ?? 0);

const sortedChannels = (channels) => NONCE_CANCELLATION_CHANNELS.filter((channel) => channels.includes(channel));

export const buildNonceCancellationStreamUrl = ({
  baseUrl = DEFAULT_API_BASE_URL,
  channel = 'nonce-cancellations',
} = {}) => {
  if (!NONCE_CANCELLATION_CHANNELS.includes(channel)) {
    throw new Error(`unsupported NonceManager history stream channel: ${channel}`);
  }

  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

export const normalizeNonceCancellationStreamMessage = (message) => {
  assertObject(message, 'NonceManager history stream message');
  assertEqual(message.type, 'snapshot', 'NonceManager history stream message type');
  assertEqual(message.transport, 'websocket', 'NonceManager history stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'NonceManager history stream snapshot');

  const config = CHANNEL_CONFIG[snapshot.channel];
  if (config === undefined) {
    throw new Error(`unsupported NonceManager history stream channel: ${snapshot.channel}`);
  }

  assertEqual(snapshot.visibility, 'private', `${snapshot.channel} stream visibility`);
  assertEqual(snapshot.payload, config.payload, `${snapshot.channel} stream payload`);
  assertEqual(snapshot.source, HISTORY_SOURCE, `${snapshot.channel} stream source`);
  assertEqual(snapshot.custody, STREAM_CUSTODY, `${snapshot.channel} stream custody`);
  assertSafePermissions(snapshot.permissions, 'unsafe private NonceManager history stream permissions');

  if (snapshot.safetyNotice !== STREAM_SAFETY_NOTICE) {
    throw new Error('NonceManager history stream safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }

  assertNonceCancellationEnvelope({ channel: snapshot.channel, envelope: snapshot.data });

  return {
    channel: snapshot.channel,
    payload: snapshot.payload,
    source: snapshot.source,
    custody: snapshot.custody,
    permissions: clone(snapshot.permissions),
    safetyNotice: snapshot.safetyNotice,
    nonceHistoryEnvelope: clone(snapshot.data),
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveNonceCancellationFixture = ({
  baseFixture,
  nonceHistory,
  receivedChannels,
  streamEvents,
} = {}) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(nonceHistory, 'NonceManager history fixture');

  const normalizedNonceHistory = normalizeNonceCancellationHistoryPanelFixture(nonceHistory);
  const channels = sortedChannels(receivedChannels ?? []);

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      nonceCancellationHistory: HISTORY_SOURCE,
    },
    nonceCancellationHistory: clone(normalizedNonceHistory),
    nonceCancellationHistoryStream: {
      channels,
      source: HISTORY_SOURCE,
      custody: STREAM_CUSTODY,
      permissions: [...SAFE_PERMISSIONS],
      safetyNotice: STREAM_SAFETY_NOTICE,
      projectionSafetyNotices: {
        cancellations: normalizedNonceHistory.cancellations.safetyNotice,
      },
      settlementMode: 'mock',
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      nonceManagerMutation: false,
      rowCount: rowCount(normalizedNonceHistory),
      streamEvents: clone(streamEvents ?? []),
    },
    custody: {
      note: STREAM_CUSTODY,
      withdrawalAuthority: 'owner-wallet-only',
    },
  };
};

export const createNonceCancellationHistoryFromEnvelope = (envelope) => {
  assertObject(envelope, 'NonceManager history envelope');
  return {
    cancellations: clone(envelope),
    rangeCancellations: clone(envelope),
  };
};

export const bindLiveNonceCancellationStreams = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveNonceCancellationStreams requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveNonceCancellationStreams requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveNonceCancellationStreams requires a WebSocket implementation.');
  }

  const currentNonceHistory = createNonceCancellationHistoryFromEnvelope(baseFixture.nonceCancellationHistory.cancellations);
  const receivedChannels = [];
  const streamEvents = [];

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxNonceCancellationStreams', 'error');
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const updateFromStream = (normalized) => {
    if (!receivedChannels.includes(normalized.channel)) {
      receivedChannels.push(normalized.channel);
    }

    currentNonceHistory.cancellations = normalized.nonceHistoryEnvelope;
    currentNonceHistory.rangeCancellations = normalized.nonceHistoryEnvelope;

    streamEvents.push({
      channel: normalized.channel,
      event: normalized.streamEvent,
    });

    const fixture = createLiveNonceCancellationFixture({
      baseFixture,
      nonceHistory: currentNonceHistory,
      receivedChannels,
      streamEvents,
    });

    setDatasetValue(mount, 'qdxNonceCancellationStreams', fixture.nonceCancellationHistoryStream.channels.join(','));
    setDatasetValue(mount, 'qdxNonceCancellationStreamSource', fixture.nonceCancellationHistoryStream.source);
    setDatasetValue(mount, 'qdxNonceCancellationStreamRows', String(fixture.nonceCancellationHistoryStream.rowCount));

    mount.innerHTML = render(fixture);
    onUpdate(fixture);
  };

  const bindings = NONCE_CANCELLATION_CHANNELS.map((channel) => {
    const ws = new WebSocketImpl(buildNonceCancellationStreamUrl({ baseUrl, channel }));

    const handleMessage = (event) => {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        updateFromStream(normalizeNonceCancellationStreamMessage(payload));
      } catch (error) {
        reportError(error);
      }
    };

    const handleError = () => reportError(new Error(`live NonceManager history ${channel} WebSocket stream failed.`));

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
