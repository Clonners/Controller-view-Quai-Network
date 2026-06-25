import { bindLiveDelegateKeyHistoryStreams } from './live-delegate-key-history.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { fetchDelegateKeyHistoryApiEnvelopes } from './delegate-key-history-binding.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'delegatekeyregistry-event-projection';
const STREAM_CUSTODY = 'non-custodial-no-withdrawal-authority';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];

const CHANNEL_CONFIG = Object.freeze({
  'delegate-key-registrations': Object.freeze({
    historyKey: 'registrations',
    collection: 'registrations',
    projectionType: 'DelegateKeyRegisteredProjection',
    eventName: 'DelegateKeyRegistered',
  }),
  'delegate-key-revocations': Object.freeze({
    historyKey: 'revocations',
    collection: 'revocations',
    projectionType: 'DelegateKeyRevokedProjection',
    eventName: 'DelegateKeyRevoked',
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
      throw new Error(`${label} ${key} must stay null for local/mock DelegateKeyRegistry history stream smoke.`);
    }
  }
};

const assertCollectionMatchesRest = ({ streamEnvelope, restEnvelope, collection, label }) => {
  if (!Array.isArray(streamEnvelope[collection]) || !Array.isArray(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} must be arrays on both REST and WebSocket envelopes.`);
  }

  if (JSON.stringify(streamEnvelope[collection]) !== JSON.stringify(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} rows must match the REST DelegateKeyRegistry history snapshot before rendering.`);
  }
};

const assertHistoryEnvelopeMatchesRest = ({ channel, streamEnvelope, restEnvelope }) => {
  const config = CHANNEL_CONFIG[channel];
  assertObject(streamEnvelope, `${channel} stream DelegateKeyRegistry history envelope`);
  assertObject(restEnvelope, `${channel} REST DelegateKeyRegistry history envelope`);

  for (const key of [
    'source',
    'projectionType',
    'eventName',
    'custody',
    'settlementMode',
    'delegateCanWithdraw',
    'delegateCanAdmin',
    'realQuaiTransactions',
    'walletRequired',
    'fundsMoved',
    'tradingVaultMutation',
    'delegateKeyRegistryMutation',
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
    throw new Error(`${channel} permissions must match the REST DelegateKeyRegistry history snapshot before rendering.`);
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
  assertObject(fixture, 'DelegateKeyRegistry history stream fixture');
  assertObject(fixture.delegateKeyHistory, 'DelegateKeyRegistry history stream fixture history');
  assertObject(fixture.delegateKeyHistoryStream, 'DelegateKeyRegistry history stream fixture metadata');

  assertEqual(fixture.delegateKeyHistoryStream.source, HISTORY_SOURCE, 'DelegateKeyRegistry history stream source');
  assertEqual(fixture.delegateKeyHistoryStream.custody, STREAM_CUSTODY, 'DelegateKeyRegistry history stream custody');
  assertSafePermissions(fixture.delegateKeyHistoryStream.permissions, 'DelegateKeyRegistry history stream permissions');
  assertEqual(fixture.delegateKeyHistoryStream.settlementMode, 'mock', 'DelegateKeyRegistry history stream settlementMode');
  assertEqual(fixture.delegateKeyHistoryStream.delegateCanWithdraw, false, 'DelegateKeyRegistry history stream delegateCanWithdraw');
  assertEqual(fixture.delegateKeyHistoryStream.delegateCanAdmin, false, 'DelegateKeyRegistry history stream delegateCanAdmin');
  assertEqual(fixture.delegateKeyHistoryStream.realQuaiTransactions, false, 'DelegateKeyRegistry history stream realQuaiTransactions');
  assertEqual(fixture.delegateKeyHistoryStream.walletRequired, false, 'DelegateKeyRegistry history stream walletRequired');
  assertEqual(fixture.delegateKeyHistoryStream.fundsMoved, false, 'DelegateKeyRegistry history stream fundsMoved');
  assertEqual(fixture.delegateKeyHistoryStream.tradingVaultMutation, false, 'DelegateKeyRegistry history stream tradingVaultMutation');
  assertEqual(fixture.delegateKeyHistoryStream.delegateKeyRegistryMutation, false, 'DelegateKeyRegistry history stream delegateKeyRegistryMutation');

  assertHistoryEnvelopeMatchesRest({
    channel: 'delegate-key-registrations',
    streamEnvelope: fixture.delegateKeyHistory.registrations,
    restEnvelope: restHistory.registrations,
  });
  assertHistoryEnvelopeMatchesRest({
    channel: 'delegate-key-revocations',
    streamEnvelope: fixture.delegateKeyHistory.revocations,
    restEnvelope: restHistory.revocations,
  });
};

export const bindLiveDelegateKeyHistoryStreamsWithRestHistory = async ({
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
    restHistory = await fetchDelegateKeyHistoryApiEnvelopes({ baseUrl, fetchImpl });
    setDatasetValue(mount, 'qdxDelegateKeyHistoryRestSnapshot', restHistory.registrations.source);
    onRestHistory(clone(restHistory));
  } catch (error) {
    setDatasetValue(mount, 'qdxDelegateKeyHistoryRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLiveDelegateKeyHistoryStreams({
    mount,
    baseUrl,
    baseFixture: {
      ...baseFixture,
      delegateKeyHistory: clone(restHistory),
    },
    render: (fixture) => {
      assertStreamFixtureMatchesRestHistory({ fixture, restHistory });
      setDatasetValue(mount, 'qdxDelegateKeyHistoryStreamRestAgreement', HISTORY_SOURCE);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxDelegateKeyHistoryStreams', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxDelegateKeyHistoryStreamRestAgreement', HISTORY_SOURCE);
      onStreamUpdate(fixture, clone(restHistory));
    },
  });

  return {
    delegateKeyHistory: clone(restHistory),
    close() {
      streamBinding.close();
    },
  };
};
