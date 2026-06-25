import { bindLiveOpenOrdersStreams } from './live-open-orders.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { fetchOpenOrdersApiEnvelope } from './open-orders-binding.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const ORDER_SOURCE = 'mock-order-projection';
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
      throw new Error(`${label} ${key} must stay null for local/mock open orders stream smoke.`);
    }
  }
};

const assertCollectionMatchesRest = ({ streamEnvelope, restEnvelope, collection, label }) => {
  if (!Array.isArray(streamEnvelope[collection]) || !Array.isArray(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} must be arrays on both REST and WebSocket envelopes.`);
  }

  if (JSON.stringify(streamEnvelope[collection]) !== JSON.stringify(restEnvelope[collection])) {
    throw new Error(`${label} ${collection} rows must match the REST open orders snapshot before rendering.`);
  }
};

const assertOpenOrdersEnvelopeMatchesRest = ({ streamEnvelope, restEnvelope }) => {
  assertObject(streamEnvelope, 'open-orders stream envelope');
  assertObject(restEnvelope, 'REST open-orders envelope');

  for (const key of [
    'source',
    'projectionType',
    'custody',
    'matcherLocalOnly',
    'settlementMode',
    'realQuaiTransactions',
    'walletRequired',
    'fundsMoved',
    'tradingVaultMutation',
    'safetyNotice',
  ]) {
    assertEqual(streamEnvelope[key], restEnvelope[key], `open-orders ${key}`);
  }

  assertEqual(streamEnvelope.source, ORDER_SOURCE, 'open-orders source');
  assertSafePermissions(streamEnvelope.permissions, 'open-orders stream permissions');
  assertSafePermissions(restEnvelope.permissions, 'open-orders REST permissions');

  if (JSON.stringify(streamEnvelope.permissions) !== JSON.stringify(restEnvelope.permissions)) {
    throw new Error('open-orders permissions must match the REST snapshot before rendering.');
  }

  assertMockEvidenceMatchesRest({ streamEnvelope, restEnvelope, label: 'open-orders' });
  assertCollectionMatchesRest({
    streamEnvelope,
    restEnvelope,
    collection: 'orders',
    label: 'open-orders',
  });
};

const assertStreamFixtureMatchesRestOrders = ({ fixture, restOrders }) => {
  assertObject(fixture, 'open orders stream fixture');
  assertObject(fixture.openOrders, 'open orders stream fixture orders');
  assertObject(fixture.openOrdersStream, 'open orders stream fixture metadata');

  assertEqual(fixture.openOrdersStream.source, ORDER_SOURCE, 'open orders stream source');
  assertEqual(fixture.openOrdersStream.custody, STREAM_CUSTODY, 'open orders stream custody');
  assertSafePermissions(fixture.openOrdersStream.permissions, 'open orders stream permissions');
  assertEqual(fixture.openOrdersStream.settlementMode, 'mock', 'open orders stream settlementMode');
  assertEqual(fixture.openOrdersStream.realQuaiTransactions, false, 'open orders stream realQuaiTransactions');
  assertEqual(fixture.openOrdersStream.walletRequired, false, 'open orders stream walletRequired');
  assertEqual(fixture.openOrdersStream.fundsMoved, false, 'open orders stream fundsMoved');
  assertEqual(fixture.openOrdersStream.tradingVaultMutation, false, 'open orders stream tradingVaultMutation');

  assertOpenOrdersEnvelopeMatchesRest({
    streamEnvelope: fixture.openOrders,
    restEnvelope: restOrders,
  });
};

export const bindLiveOpenOrdersStreamsWithRestOrders = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = globalThis.WebSocket,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onRestOrders = noop,
  onStreamUpdate = noop,
  onRestError = noop,
  onStreamError = noop,
} = {}) => {
  let restOrders;

  try {
    restOrders = await fetchOpenOrdersApiEnvelope({ baseUrl, fetchImpl });
    setDatasetValue(mount, 'qdxFillOpenOrdersRestSnapshot', restOrders.source);
    onRestOrders(clone(restOrders));
  } catch (error) {
    setDatasetValue(mount, 'qdxFillOpenOrdersRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLiveOpenOrdersStreams({
    mount,
    baseUrl,
    baseFixture: {
      ...baseFixture,
      openOrders: clone(restOrders),
    },
    render: (fixture) => {
      assertStreamFixtureMatchesRestOrders({ fixture, restOrders });
      setDatasetValue(mount, 'qdxFillOpenOrdersStreamRestAgreement', ORDER_SOURCE);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxFillOpenOrdersStreams', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxFillOpenOrdersStreamRestAgreement', ORDER_SOURCE);
      onStreamUpdate(fixture, clone(restOrders));
    },
  });

  return {
    openOrders: clone(restOrders),
    close() {
      streamBinding.close();
    },
  };
};
