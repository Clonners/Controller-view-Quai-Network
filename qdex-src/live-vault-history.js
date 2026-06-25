import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeVaultHistoryPanelFixture } from './vault-history-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'tradingvault-event-projection';
const STREAM_CUSTODY = 'non-custodial-no-withdrawal-authority';
const HISTORY_CUSTODY = 'non-custodial-contract-vault';
const STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const VAULT_HISTORY_CHANNELS = ['deposits', 'withdrawals'];

const CHANNEL_CONFIG = Object.freeze({
  deposits: Object.freeze({
    collection: 'deposits',
    payload: 'deposit_projection',
    projectionType: 'TradingVaultDepositProjection',
    eventName: 'Deposit',
  }),
  withdrawals: Object.freeze({
    collection: 'withdrawals',
    payload: 'withdrawal_projection',
    projectionType: 'TradingVaultWithdrawalProjection',
    eventName: 'Withdraw',
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
      throw new Error(`${label} ${key} must be null for local/mock vault history stream rows.`);
    }
  }
};

const assertVaultHistoryEnvelope = ({ channel, envelope }) => {
  const config = CHANNEL_CONFIG[channel];
  assertObject(envelope, `${channel} vault history stream envelope`);
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
  assertMockEvidenceIsNull(envelope, `${channel} history`);

  if (!Array.isArray(envelope[config.collection])) {
    throw new Error(`${channel} history ${config.collection} must be an array.`);
  }

  if (!String(envelope.safetyNotice ?? '').includes(`Read-only TradingVault ${config.eventName} history projection`)) {
    throw new Error(`${channel} history safetyNotice must name the read-only TradingVault projection.`);
  }

  if (!/no real Quai transaction, no wallet loaded, no funds moved/i.test(envelope.safetyNotice)) {
    throw new Error(`${channel} history safetyNotice must preserve mock no-wallet/no-funds wording.`);
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

const rowCount = (vaultHistory) => (
  vaultHistory.deposits.deposits.length + vaultHistory.withdrawals.withdrawals.length
);

const sortedChannels = (channels) => VAULT_HISTORY_CHANNELS.filter((channel) => channels.includes(channel));

export const buildVaultHistoryStreamUrl = ({
  baseUrl = DEFAULT_API_BASE_URL,
  channel = 'deposits',
} = {}) => {
  if (!VAULT_HISTORY_CHANNELS.includes(channel)) {
    throw new Error(`unsupported vault history stream channel: ${channel}`);
  }

  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

export const normalizeVaultHistoryStreamMessage = (message) => {
  assertObject(message, 'vault history stream message');
  assertEqual(message.type, 'snapshot', 'vault history stream message type');
  assertEqual(message.transport, 'websocket', 'vault history stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'vault history stream snapshot');

  const config = CHANNEL_CONFIG[snapshot.channel];
  if (config === undefined) {
    throw new Error(`unsupported vault history stream channel: ${snapshot.channel}`);
  }

  assertEqual(snapshot.visibility, 'private', `${snapshot.channel} stream visibility`);
  assertEqual(snapshot.payload, config.payload, `${snapshot.channel} stream payload`);
  assertEqual(snapshot.source, HISTORY_SOURCE, `${snapshot.channel} stream source`);
  assertEqual(snapshot.custody, STREAM_CUSTODY, `${snapshot.channel} stream custody`);
  assertSafePermissions(snapshot.permissions, 'unsafe private vault history stream permissions');

  if (snapshot.safetyNotice !== STREAM_SAFETY_NOTICE) {
    throw new Error('vault history stream safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }

  assertVaultHistoryEnvelope({ channel: snapshot.channel, envelope: snapshot.data });

  return {
    channel: snapshot.channel,
    payload: snapshot.payload,
    source: snapshot.source,
    custody: snapshot.custody,
    permissions: clone(snapshot.permissions),
    safetyNotice: snapshot.safetyNotice,
    vaultHistoryEnvelope: clone(snapshot.data),
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveVaultHistoryFixture = ({
  baseFixture,
  vaultHistory,
  receivedChannels,
  streamEvents,
} = {}) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(vaultHistory, 'vault history fixture');

  const normalizedVaultHistory = normalizeVaultHistoryPanelFixture(vaultHistory);
  const channels = sortedChannels(receivedChannels ?? []);

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      vaultHistory: HISTORY_SOURCE,
    },
    vaultHistory: clone(normalizedVaultHistory),
    vaultHistoryStream: {
      channels,
      source: HISTORY_SOURCE,
      custody: STREAM_CUSTODY,
      permissions: [...SAFE_PERMISSIONS],
      safetyNotice: STREAM_SAFETY_NOTICE,
      projectionSafetyNotices: {
        deposits: normalizedVaultHistory.deposits.safetyNotice,
        withdrawals: normalizedVaultHistory.withdrawals.safetyNotice,
      },
      settlementMode: 'mock',
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      rowCount: rowCount(normalizedVaultHistory),
      streamEvents: clone(streamEvents ?? []),
    },
    custody: {
      note: STREAM_CUSTODY,
      withdrawalAuthority: 'owner-wallet-only',
    },
  };
};

export const bindLiveVaultHistoryStreams = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveVaultHistoryStreams requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveVaultHistoryStreams requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveVaultHistoryStreams requires a WebSocket implementation.');
  }

  const currentVaultHistory = clone(normalizeVaultHistoryPanelFixture(baseFixture.vaultHistory));
  const receivedChannels = [];
  const streamEvents = [];

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxVaultHistoryStreams', 'error');
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const updateFromStream = (normalized) => {
    if (!receivedChannels.includes(normalized.channel)) {
      receivedChannels.push(normalized.channel);
    }

    if (normalized.channel === 'deposits') {
      currentVaultHistory.deposits = normalized.vaultHistoryEnvelope;
    } else {
      currentVaultHistory.withdrawals = normalized.vaultHistoryEnvelope;
    }

    streamEvents.push({
      channel: normalized.channel,
      event: normalized.streamEvent,
    });

    const fixture = createLiveVaultHistoryFixture({
      baseFixture,
      vaultHistory: currentVaultHistory,
      receivedChannels,
      streamEvents,
    });

    setDatasetValue(mount, 'qdxVaultHistoryStreams', fixture.vaultHistoryStream.channels.join(','));
    setDatasetValue(mount, 'qdxVaultHistoryStreamSource', fixture.vaultHistoryStream.source);
    setDatasetValue(mount, 'qdxVaultHistoryStreamRows', String(fixture.vaultHistoryStream.rowCount));

    mount.innerHTML = render(fixture);
    onUpdate(fixture);
  };

  const bindings = VAULT_HISTORY_CHANNELS.map((channel) => {
    const ws = new WebSocketImpl(buildVaultHistoryStreamUrl({ baseUrl, channel }));

    const handleMessage = (event) => {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        updateFromStream(normalizeVaultHistoryStreamMessage(payload));
      } catch (error) {
        reportError(error);
      }
    };

    const handleError = () => reportError(new Error(`live vault history ${channel} WebSocket stream failed.`));

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
