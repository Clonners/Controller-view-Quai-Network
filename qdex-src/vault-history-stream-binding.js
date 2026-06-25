import { bindLiveVaultHistoryStreams } from './live-vault-history.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { fetchVaultHistoryApiEnvelopes } from './vault-history-binding.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'tradingvault-event-projection';
const STREAM_CUSTODY = 'non-custodial-no-withdrawal-authority';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];

const CHANNEL_CONFIG = Object.freeze({
  deposits: Object.freeze({
    collection: 'deposits',
    projectionType: 'TradingVaultDepositProjection',
    eventName: 'Deposit',
  }),
  withdrawals: Object.freeze({
    collection: 'withdrawals',
    projectionType: 'TradingVaultWithdrawalProjection',
    eventName: 'Withdraw',
  }),
});

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

const assertMockEvidenceMatchesRest = ({ streamEnvelope, restEnvelope, label }) => {
  for (const key of ['settlementTx', 'blockNumber', 'blockHash', 'eventIndex', 'explorerUrl']) {
    assertEqual(streamEnvelope[key], restEnvelope[key], `${label} ${key}`);
    if (streamEnvelope[key] !== null) {
      throw new Error(`${label} ${key} must stay null for local/mock TradingVault history stream smoke.`);
    }
  }
};

const assertCollectionMatchesRest = ({ streamEnvelope, restEnvelope, collection, label }) => {
  if (!Array.isArray(streamEnvelope[collection]) || !Array.isArray(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} must be arrays on both REST and WebSocket envelopes.`);
  }

  if (JSON.stringify(streamEnvelope[collection]) !== JSON.stringify(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} rows must match the REST TradingVault history snapshot before rendering.`);
  }
};

const assertHistoryEnvelopeMatchesRest = ({ channel, streamEnvelope, restEnvelope }) => {
  const config = CHANNEL_CONFIG[channel];
  assertObject(streamEnvelope, `${channel} stream vault history envelope`);
  assertObject(restEnvelope, `${channel} REST vault history envelope`);

  for (const key of [
    'source',
    'projectionType',
    'eventName',
    'custody',
    'settlementMode',
    'realQuaiTransactions',
    'walletRequired',
    'fundsMoved',
    'tradingVaultMutation',
    'safetyNotice',
  ]) {
    assertEqual(streamEnvelope[key], restEnvelope[key], `${channel} ${key}`);
  }

  assertEqual(streamEnvelope.source, HISTORY_SOURCE, `${channel} source`);
  assertEqual(streamEnvelope.projectionType, config.projectionType, `${channel} projectionType`);
  assertEqual(streamEnvelope.eventName, config.eventName, `${channel} eventName`);
  assertSafePermissions(streamEnvelope.permissions, `${channel} stream permissions`);
  assertSafePermissions(restEnvelope.permissions, `${channel} REST permissions`);

  if (JSON.stringify(streamEnvelope.permissions) !== JSON.stringify(restEnvelope.permissions)) {
    throw new Error(`${channel} permissions must match the REST TradingVault history snapshot before rendering.`);
  }

  assertMockEvidenceMatchesRest({ streamEnvelope, restEnvelope, label: channel });
  assertCollectionMatchesRest({
    streamEnvelope,
    restEnvelope,
    collection: config.collection,
    label: channel,
  });
};

const assertStreamFixtureMatchesRestHistory = ({ fixture, restHistory }) => {
  assertObject(fixture, 'vault history stream fixture');
  assertObject(fixture.vaultHistory, 'vault history stream fixture history');
  assertObject(fixture.vaultHistoryStream, 'vault history stream fixture metadata');

  assertEqual(fixture.vaultHistoryStream.source, HISTORY_SOURCE, 'vault history stream source');
  assertEqual(fixture.vaultHistoryStream.custody, STREAM_CUSTODY, 'vault history stream custody');
  assertSafePermissions(fixture.vaultHistoryStream.permissions, 'vault history stream permissions');
  assertEqual(fixture.vaultHistoryStream.settlementMode, 'mock', 'vault history stream settlementMode');
  assertEqual(fixture.vaultHistoryStream.realQuaiTransactions, false, 'vault history stream realQuaiTransactions');
  assertEqual(fixture.vaultHistoryStream.walletRequired, false, 'vault history stream walletRequired');
  assertEqual(fixture.vaultHistoryStream.fundsMoved, false, 'vault history stream fundsMoved');
  assertEqual(fixture.vaultHistoryStream.tradingVaultMutation, false, 'vault history stream tradingVaultMutation');

  assertHistoryEnvelopeMatchesRest({
    channel: 'deposits',
    streamEnvelope: fixture.vaultHistory.deposits,
    restEnvelope: restHistory.deposits,
  });
  assertHistoryEnvelopeMatchesRest({
    channel: 'withdrawals',
    streamEnvelope: fixture.vaultHistory.withdrawals,
    restEnvelope: restHistory.withdrawals,
  });
};

export const bindLiveVaultHistoryStreamsWithRestHistory = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = globalThis.WebSocket,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onRestHistory = noop,
  onStreamUpdate = noop,
  onRestError = noop,
  onStreamError = noop,
} = {}) => {
  let restHistory;

  try {
    restHistory = await fetchVaultHistoryApiEnvelopes({ baseUrl, fetchImpl });
    setDatasetValue(mount, 'qdxVaultHistoryRestSnapshot', restHistory.deposits.source);
    onRestHistory(clone(restHistory));
  } catch (error) {
    setDatasetValue(mount, 'qdxVaultHistoryRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLiveVaultHistoryStreams({
    mount,
    baseUrl,
    baseFixture: {
      ...baseFixture,
      vaultHistory: clone(restHistory),
    },
    render: (fixture) => {
      assertStreamFixtureMatchesRestHistory({ fixture, restHistory });
      setDatasetValue(mount, 'qdxVaultHistoryStreamRestAgreement', HISTORY_SOURCE);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxVaultHistoryStreams', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxVaultHistoryStreamRestAgreement', HISTORY_SOURCE);
      onStreamUpdate(fixture, clone(restHistory));
    },
  });

  return {
    vaultHistory: clone(restHistory),
    close() {
      streamBinding.close();
    },
  };
};
