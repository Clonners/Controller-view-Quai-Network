import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeDelegateKeyHistoryPanelFixture } from './delegate-key-history-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'delegatekeyregistry-event-projection';
const STREAM_CUSTODY = 'non-custodial-no-withdrawal-authority';
const HISTORY_CUSTODY = 'non-custodial-no-withdrawal-authority';
const STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const DELEGATE_KEY_HISTORY_CHANNELS = ['delegate-key-registrations', 'delegate-key-revocations'];

const CHANNEL_CONFIG = Object.freeze({
  'delegate-key-registrations': Object.freeze({
    collection: 'registrations',
    historyKey: 'registrations',
    payload: 'delegate_key_registration_projection',
    projectionType: 'DelegateKeyRegisteredProjection',
    eventName: 'DelegateKeyRegistered',
  }),
  'delegate-key-revocations': Object.freeze({
    collection: 'revocations',
    historyKey: 'revocations',
    payload: 'delegate_key_revocation_projection',
    projectionType: 'DelegateKeyRevokedProjection',
    eventName: 'DelegateKeyRevoked',
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
      throw new Error(`${label} ${key} must be null for local/mock DelegateKeyRegistry history stream rows.`);
    }
  }
};

const assertDelegateKeyHistoryEnvelope = ({ channel, envelope }) => {
  const config = CHANNEL_CONFIG[channel];
  assertObject(envelope, `${channel} DelegateKeyRegistry history stream envelope`);
  assertEqual(envelope.source, HISTORY_SOURCE, `${channel} history source`);
  assertEqual(envelope.projectionType, config.projectionType, `${channel} history projectionType`);
  assertEqual(envelope.eventName, config.eventName, `${channel} history eventName`);
  assertEqual(envelope.custody, HISTORY_CUSTODY, `${channel} history custody`);
  assertSafePermissions(envelope.permissions, `${channel} history permissions`);
  assertEqual(envelope.settlementMode, 'mock', `${channel} history settlementMode`);
  assertEqual(envelope.delegateCanWithdraw, false, `${channel} history delegateCanWithdraw`);
  assertEqual(envelope.delegateCanAdmin, false, `${channel} history delegateCanAdmin`);
  assertEqual(envelope.realQuaiTransactions, false, `${channel} history realQuaiTransactions`);
  assertEqual(envelope.walletRequired, false, `${channel} history walletRequired`);
  assertEqual(envelope.fundsMoved, false, `${channel} history fundsMoved`);
  assertEqual(envelope.tradingVaultMutation, false, `${channel} history tradingVaultMutation`);
  assertEqual(envelope.delegateKeyRegistryMutation, false, `${channel} history delegateKeyRegistryMutation`);
  assertMockEvidenceIsNull(envelope, `${channel} history`);

  if (!Array.isArray(envelope[config.collection])) {
    throw new Error(`${channel} history ${config.collection} must be an array.`);
  }

  if (!String(envelope.safetyNotice ?? '').includes(`Read-only DelegateKeyRegistry ${config.eventName} history projection`)) {
    throw new Error(`${channel} history safetyNotice must name the read-only DelegateKeyRegistry projection.`);
  }

  if (!/no real Quai transaction, no wallet loaded/i.test(envelope.safetyNotice)) {
    throw new Error(`${channel} history safetyNotice must preserve mock no-wallet wording.`);
  }

  if (!/no live DelegateKeyRegistry mutation, no funds moved/i.test(envelope.safetyNotice)) {
    throw new Error(`${channel} history safetyNotice must preserve no registry mutation/no-funds wording.`);
  }

  if (!/no delegate withdrawal\/admin authority/i.test(envelope.safetyNotice)) {
    throw new Error(`${channel} history safetyNotice must preserve no delegate withdrawal/admin authority wording.`);
  }
};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

const rowCount = (delegateKeyHistory) => (
  delegateKeyHistory.registrations.registrations.length + delegateKeyHistory.revocations.revocations.length
);

const sortedChannels = (channels) => DELEGATE_KEY_HISTORY_CHANNELS.filter((channel) => channels.includes(channel));

export const buildDelegateKeyHistoryStreamUrl = ({
  baseUrl = DEFAULT_API_BASE_URL,
  channel = 'delegate-key-registrations',
} = {}) => {
  if (!DELEGATE_KEY_HISTORY_CHANNELS.includes(channel)) {
    throw new Error(`unsupported DelegateKeyRegistry history stream channel: ${channel}`);
  }

  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

export const normalizeDelegateKeyHistoryStreamMessage = (message) => {
  assertObject(message, 'DelegateKeyRegistry history stream message');
  assertEqual(message.type, 'snapshot', 'DelegateKeyRegistry history stream message type');
  assertEqual(message.transport, 'websocket', 'DelegateKeyRegistry history stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'DelegateKeyRegistry history stream snapshot');

  const config = CHANNEL_CONFIG[snapshot.channel];
  if (config === undefined) {
    throw new Error(`unsupported DelegateKeyRegistry history stream channel: ${snapshot.channel}`);
  }

  assertEqual(snapshot.visibility, 'private', `${snapshot.channel} stream visibility`);
  assertEqual(snapshot.payload, config.payload, `${snapshot.channel} stream payload`);
  assertEqual(snapshot.source, HISTORY_SOURCE, `${snapshot.channel} stream source`);
  assertEqual(snapshot.custody, STREAM_CUSTODY, `${snapshot.channel} stream custody`);
  assertSafePermissions(snapshot.permissions, 'unsafe private DelegateKeyRegistry history stream permissions');

  if (snapshot.safetyNotice !== STREAM_SAFETY_NOTICE) {
    throw new Error('DelegateKeyRegistry history stream safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }

  assertDelegateKeyHistoryEnvelope({ channel: snapshot.channel, envelope: snapshot.data });

  return {
    channel: snapshot.channel,
    payload: snapshot.payload,
    source: snapshot.source,
    custody: snapshot.custody,
    permissions: clone(snapshot.permissions),
    safetyNotice: snapshot.safetyNotice,
    delegateKeyHistoryEnvelope: clone(snapshot.data),
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveDelegateKeyHistoryFixture = ({
  baseFixture,
  delegateKeyHistory,
  receivedChannels,
  streamEvents,
} = {}) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(delegateKeyHistory, 'DelegateKeyRegistry history fixture');

  const normalizedDelegateKeyHistory = normalizeDelegateKeyHistoryPanelFixture(delegateKeyHistory);
  const channels = sortedChannels(receivedChannels ?? []);

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      delegateKeyHistory: HISTORY_SOURCE,
    },
    delegateKeyHistory: clone(normalizedDelegateKeyHistory),
    delegateKeyHistoryStream: {
      channels,
      source: HISTORY_SOURCE,
      custody: STREAM_CUSTODY,
      permissions: [...SAFE_PERMISSIONS],
      safetyNotice: STREAM_SAFETY_NOTICE,
      projectionSafetyNotices: {
        registrations: normalizedDelegateKeyHistory.registrations.safetyNotice,
        revocations: normalizedDelegateKeyHistory.revocations.safetyNotice,
      },
      settlementMode: 'mock',
      delegateCanWithdraw: false,
      delegateCanAdmin: false,
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      delegateKeyRegistryMutation: false,
      rowCount: rowCount(normalizedDelegateKeyHistory),
      streamEvents: clone(streamEvents ?? []),
    },
    custody: {
      note: STREAM_CUSTODY,
      withdrawalAuthority: 'owner-wallet-only',
    },
  };
};

export const bindLiveDelegateKeyHistoryStreams = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveDelegateKeyHistoryStreams requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveDelegateKeyHistoryStreams requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveDelegateKeyHistoryStreams requires a WebSocket implementation.');
  }

  const currentDelegateKeyHistory = clone(normalizeDelegateKeyHistoryPanelFixture(baseFixture.delegateKeyHistory));
  const receivedChannels = [];
  const streamEvents = [];

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxDelegateKeyHistoryStreams', 'error');
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const updateFromStream = (normalized) => {
    if (!receivedChannels.includes(normalized.channel)) {
      receivedChannels.push(normalized.channel);
    }

    const config = CHANNEL_CONFIG[normalized.channel];
    currentDelegateKeyHistory[config.historyKey] = normalized.delegateKeyHistoryEnvelope;

    streamEvents.push({
      channel: normalized.channel,
      event: normalized.streamEvent,
    });

    const fixture = createLiveDelegateKeyHistoryFixture({
      baseFixture,
      delegateKeyHistory: currentDelegateKeyHistory,
      receivedChannels,
      streamEvents,
    });

    setDatasetValue(mount, 'qdxDelegateKeyHistoryStreams', fixture.delegateKeyHistoryStream.channels.join(','));
    setDatasetValue(mount, 'qdxDelegateKeyHistoryStreamSource', fixture.delegateKeyHistoryStream.source);
    setDatasetValue(mount, 'qdxDelegateKeyHistoryStreamRows', String(fixture.delegateKeyHistoryStream.rowCount));

    mount.innerHTML = render(fixture);
    onUpdate(fixture);
  };

  const bindings = DELEGATE_KEY_HISTORY_CHANNELS.map((channel) => {
    const ws = new WebSocketImpl(buildDelegateKeyHistoryStreamUrl({ baseUrl, channel }));

    const handleMessage = (event) => {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        updateFromStream(normalizeDelegateKeyHistoryStreamMessage(payload));
      } catch (error) {
        reportError(error);
      }
    };

    const handleError = () => reportError(new Error(`live DelegateKeyRegistry history ${channel} WebSocket stream failed.`));

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
