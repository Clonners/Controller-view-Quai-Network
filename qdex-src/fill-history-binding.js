import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeFillHistoryPanelFixture } from './fill-history-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const FILL_SOURCE = 'in-memory-indexer-projection';
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

export const normalizeFillHistoryApiEnvelope = ({ envelope }) => {
  assertObject(envelope, 'fill history envelope');
  assertEqual(envelope.source, FILL_SOURCE, 'fill history source');

  if (!Array.isArray(envelope.fills)) {
    throw new Error('fill history fills must be an array.');
  }

  return normalizeFillHistoryPanelFixture({
    ...envelope,
    projectionType: 'IndexedFillProjection',
    eventName: 'Fill',
    settlementMode: 'mock',
    settlementTx: null,
    blockNumber: null,
    blockHash: null,
    eventIndex: null,
    explorerUrl: null,
    realQuaiTransactions: false,
    walletRequired: false,
    fundsMoved: false,
    tradingVaultMutation: false,
  });
};

const requestEnvelope = async ({ baseUrl, path, fetchImpl }) => {
  const response = await fetchImpl(new URL(path, baseUrl).toString());
  if (!response.ok) {
    throw new Error(`GET ${path} failed with HTTP ${response.status}.`);
  }

  return response.json();
};

export const fetchFillHistoryApiEnvelope = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchFillHistoryApiEnvelope requires a fetch implementation.');
  }

  const envelope = await requestEnvelope({ baseUrl, path: '/v1/fills', fetchImpl });

  return normalizeFillHistoryApiEnvelope({ envelope });
};

export const bindFillHistoryLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onHistory = noop,
  onError = noop,
} = {}) => {
  try {
    const fillHistory = await fetchFillHistoryApiEnvelope({ baseUrl, fetchImpl });
    const fixture = {
      ...baseFixture,
      fillHistory,
    };

    setDatasetValue(mount, 'qdxFillHistorySmoke', fillHistory.source);
    setDatasetValue(mount, 'qdxFillHistoryProjection', fillHistory.projectionType);
    setDatasetValue(mount, 'qdxFillHistoryRows', String(fillHistory.fills?.length ?? 0));

    if (mount !== undefined && mount !== null) {
      mount.innerHTML = render(fixture);
    }

    onHistory(fillHistory, fixture);

    return {
      fillHistory: clone(fillHistory),
      close() {},
    };
  } catch (error) {
    setDatasetValue(mount, 'qdxFillHistorySmoke', 'error');
    onError(error);
    throw error;
  }
};
