import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeNonceCancellationHistoryPanelFixture } from './nonce-cancellation-history-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'nonce-manager-event-projection';
const HISTORY_CUSTODY = 'non-custodial';
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

const assertMockEvidenceIsNull = (envelope, label) => {
  for (const key of ['settlementTx', 'blockNumber', 'blockHash', 'eventIndex', 'explorerUrl']) {
    if (envelope[key] !== null) {
      throw new Error(`${label} ${key} must be null for local/mock nonce cancellation history rows.`);
    }
  }
};

const assertHistoryEnvelope = ({ envelope, projectionType, eventName }) => {
  assertObject(envelope, `${eventName} history envelope`);
  assertEqual(envelope.source, HISTORY_SOURCE, `${eventName} history source`);
  assertEqual(envelope.projectionType, projectionType, `${eventName} history projectionType`);
  assertEqual(envelope.eventName, eventName, `${eventName} history eventName`);
  assertSafePermissions(envelope.permissions, `${eventName} history permissions`);
  assertEqual(envelope.settlementMode, 'mock', `${eventName} history settlementMode`);
  assertEqual(envelope.realQuaiTransactions, false, `${eventName} history realQuaiTransactions`);
  assertEqual(envelope.walletRequired, false, `${eventName} history walletRequired`);
  assertEqual(envelope.fundsMoved, false, `${eventName} history fundsMoved`);
  assertEqual(envelope.tradingVaultMutation, false, `${eventName} history tradingVaultMutation`);
  assertEqual(envelope.nonceManagerMutation, false, `${eventName} history nonceManagerMutation`);
  assertMockEvidenceIsNull(envelope, `${eventName} history`);

  const notice = String(envelope.safetyNotice ?? '');
  if (!notice.includes('Read-only NonceManager')) {
    throw new Error(`${eventName} history safetyNotice must name the read-only NonceManager projection.`);
  }
  if (!notice.includes('nonce-manager-event-projection')) {
    throw new Error(`${eventName} history safetyNotice must preserve nonce-manager-event-projection source reference.`);
  }
  if (!notice.includes('settlementMode: mock')) {
    throw new Error(`${eventName} history safetyNotice must preserve mock settlementMode.`);
  }
};

export const normalizeNonceCancellationHistoryApiEnvelope = ({ envelope }) => {
  assertHistoryEnvelope({
    envelope,
    projectionType: 'NonceCancelledProjection',
    eventName: 'NonceCancelled',
  });

  return normalizeNonceCancellationHistoryPanelFixture({
    cancellations: envelope,
    rangeCancellations: { ...envelope, projectionType: 'NonceRangeCancelledProjection', eventName: 'NonceRangeCancelled' },
  });
};

const requestHistoryEnvelope = async ({ baseUrl, path, fetchImpl }) => {
  const response = await fetchImpl(new URL(path, baseUrl).toString());
  if (!response.ok) {
    throw new Error(`GET ${path} failed with HTTP ${response.status}.`);
  }

  return response.json();
};

export const fetchNonceCancellationHistoryApiEnvelope = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchNonceCancellationHistoryApiEnvelope requires a fetch implementation.');
  }

  const envelope = await requestHistoryEnvelope({ baseUrl, path: '/v1/nonces/cancellations', fetchImpl });

  return normalizeNonceCancellationHistoryApiEnvelope({ envelope });
};

const historyRowCount = (nonceHistory) => (
  (nonceHistory.cancellations?.cancellations?.length ?? 0) +
  (nonceHistory.rangeCancellations?.rangeCancellations?.length ?? 0)
);

export const bindNonceCancellationHistoryLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onHistory = noop,
  onError = noop,
} = {}) => {
  try {
    const nonceHistory = await fetchNonceCancellationHistoryApiEnvelope({ baseUrl, fetchImpl });
    const fixture = {
      ...baseFixture,
      nonceCancellationHistory: nonceHistory,
    };

    setDatasetValue(mount, 'qdxNonceCancellationSmoke', nonceHistory.cancellations.source);
    setDatasetValue(mount, 'qdxNonceCancellationProjection', nonceHistory.cancellations.projectionType);
    setDatasetValue(mount, 'qdxNonceCancellationRangeProjection', nonceHistory.rangeCancellations.projectionType);
    setDatasetValue(mount, 'qdxNonceCancellationRows', String(historyRowCount(nonceHistory)));

    if (mount !== undefined && mount !== null) {
      mount.innerHTML = render(fixture);
    }

    onHistory(nonceHistory, fixture);

    return {
      nonceHistory: clone(nonceHistory),
      close() {},
    };
  } catch (error) {
    setDatasetValue(mount, 'qdxNonceCancellationSmoke', 'error');
    onError(error);
    throw error;
  }
};
