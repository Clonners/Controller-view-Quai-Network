import { bindLiveNonceCancellationStreams } from './live-nonce-cancellations.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { fetchNonceCancellationHistoryApiEnvelope } from './nonce-cancellation-history-binding.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'nonce-manager-event-projection';
const STREAM_CUSTODY = 'non-custodial-no-withdrawal-authority';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];

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
      throw new Error(`${label} ${key} must stay null for local/mock NonceManager history stream smoke.`);
    }
  }
};

const assertCollectionMatchesRest = ({ streamEnvelope, restEnvelope, collection, label }) => {
  if (!Array.isArray(streamEnvelope[collection]) || !Array.isArray(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} must be arrays on both REST and WebSocket envelopes.`);
  }

  if (JSON.stringify(streamEnvelope[collection]) !== JSON.stringify(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} rows must match the REST NonceManager history snapshot before rendering.`);
  }
};

const assertHistoryEnvelopeMatchesRest = ({ streamEnvelope, restEnvelope }) => {
  assertObject(streamEnvelope, 'nonce-cancellations stream envelope');
  assertObject(restEnvelope, 'REST nonce-cancellations envelope');

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
    'nonceManagerMutation',
    'safetyNotice',
  ]) {
    assertEqual(streamEnvelope[key], restEnvelope[key], `nonce-cancellations ${key}`);
  }

  assertEqual(streamEnvelope.source, HISTORY_SOURCE, 'nonce-cancellations source');
  assertSafePermissions(streamEnvelope.permissions, 'nonce-cancellations stream permissions');
  assertSafePermissions(restEnvelope.permissions, 'nonce-cancellations REST permissions');

  if (JSON.stringify(streamEnvelope.permissions) !== JSON.stringify(restEnvelope.permissions)) {
    throw new Error('nonce-cancellations permissions must match the REST snapshot before rendering.');
  }

  assertMockEvidenceMatchesRest({ streamEnvelope, restEnvelope, label: 'nonce-cancellations' });
  assertCollectionMatchesRest({
    streamEnvelope,
    restEnvelope,
    collection: 'cancellations',
    label: 'nonce-cancellations',
  });
};

const assertStreamFixtureMatchesRestHistory = ({ fixture, restHistory }) => {
  assertObject(fixture, 'nonce cancellation history stream fixture');
  assertObject(fixture.nonceCancellationHistory, 'nonce cancellation history stream fixture history');
  assertObject(fixture.nonceCancellationHistoryStream, 'nonce cancellation history stream fixture metadata');

  assertEqual(fixture.nonceCancellationHistoryStream.source, HISTORY_SOURCE, 'nonce cancellation history stream source');
  assertEqual(fixture.nonceCancellationHistoryStream.custody, STREAM_CUSTODY, 'nonce cancellation history stream custody');
  assertSafePermissions(fixture.nonceCancellationHistoryStream.permissions, 'nonce cancellation history stream permissions');
  assertEqual(fixture.nonceCancellationHistoryStream.settlementMode, 'mock', 'nonce cancellation history stream settlementMode');
  assertEqual(fixture.nonceCancellationHistoryStream.realQuaiTransactions, false, 'nonce cancellation history stream realQuaiTransactions');
  assertEqual(fixture.nonceCancellationHistoryStream.walletRequired, false, 'nonce cancellation history stream walletRequired');
  assertEqual(fixture.nonceCancellationHistoryStream.fundsMoved, false, 'nonce cancellation history stream fundsMoved');
  assertEqual(fixture.nonceCancellationHistoryStream.tradingVaultMutation, false, 'nonce cancellation history stream tradingVaultMutation');
  assertEqual(fixture.nonceCancellationHistoryStream.nonceManagerMutation, false, 'nonce cancellation history stream nonceManagerMutation');

  assertHistoryEnvelopeMatchesRest({
    streamEnvelope: fixture.nonceCancellationHistory.cancellations,
    restEnvelope: restHistory.cancellations,
  });
};

export const bindLiveNonceCancellationStreamsWithRestHistory = async ({
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
    restHistory = await fetchNonceCancellationHistoryApiEnvelope({ baseUrl, fetchImpl });
    setDatasetValue(mount, 'qdxNonceCancellationRestSnapshot', restHistory.cancellations.source);
    onRestHistory(clone(restHistory));
  } catch (error) {
    setDatasetValue(mount, 'qdxNonceCancellationRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLiveNonceCancellationStreams({
    mount,
    baseUrl,
    baseFixture: {
      ...baseFixture,
      nonceCancellationHistory: clone(restHistory),
    },
    render: (fixture) => {
      assertStreamFixtureMatchesRestHistory({ fixture, restHistory });
      setDatasetValue(mount, 'qdxNonceCancellationStreamRestAgreement', HISTORY_SOURCE);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxNonceCancellationStreams', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxNonceCancellationStreamRestAgreement', HISTORY_SOURCE);
      onStreamUpdate(fixture, clone(restHistory));
    },
  });

  return {
    nonceHistory: clone(restHistory),
    close() {
      streamBinding.close();
    },
  };
};
