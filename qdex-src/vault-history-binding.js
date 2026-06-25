import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeVaultHistoryPanelFixture } from './vault-history-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const HISTORY_SOURCE = 'tradingvault-event-projection';
const HISTORY_CUSTODY = 'non-custodial-contract-vault';
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
      throw new Error(`${label} ${key} must be null for local/mock vault history rows.`);
    }
  }
};

const assertHistoryEnvelope = ({ envelope, collection, projectionType, eventName }) => {
  assertObject(envelope, `${eventName} history envelope`);
  assertEqual(envelope.source, HISTORY_SOURCE, `${eventName} history source`);
  assertEqual(envelope.projectionType, projectionType, `${eventName} history projectionType`);
  assertEqual(envelope.eventName, eventName, `${eventName} history eventName`);
  assertEqual(envelope.custody, HISTORY_CUSTODY, `${eventName} history custody`);
  assertSafePermissions(envelope.permissions, `${eventName} history permissions`);
  assertEqual(envelope.settlementMode, 'mock', `${eventName} history settlementMode`);
  assertEqual(envelope.realQuaiTransactions, false, `${eventName} history realQuaiTransactions`);
  assertEqual(envelope.walletRequired, false, `${eventName} history walletRequired`);
  assertEqual(envelope.fundsMoved, false, `${eventName} history fundsMoved`);
  assertEqual(envelope.tradingVaultMutation, false, `${eventName} history tradingVaultMutation`);
  assertMockEvidenceIsNull(envelope, `${eventName} history`);

  if (!Array.isArray(envelope[collection])) {
    throw new Error(`${eventName} history ${collection} must be an array.`);
  }

  if (!String(envelope.safetyNotice ?? '').includes(`Read-only TradingVault ${eventName} history projection`)) {
    throw new Error(`${eventName} history safetyNotice must name the read-only TradingVault projection.`);
  }

  if (!/no real Quai transaction, no wallet loaded, no funds moved/i.test(envelope.safetyNotice)) {
    throw new Error(`${eventName} history safetyNotice must preserve mock no-wallet/no-funds wording.`);
  }

  if (!/no delegate withdrawal\/admin authority/i.test(envelope.safetyNotice)) {
    throw new Error(`${eventName} history safetyNotice must preserve no delegate withdrawal/admin authority wording.`);
  }
};

export const normalizeVaultHistoryApiEnvelopes = ({ deposits, withdrawals }) => {
  assertHistoryEnvelope({
    envelope: deposits,
    collection: 'deposits',
    projectionType: 'TradingVaultDepositProjection',
    eventName: 'Deposit',
  });
  assertHistoryEnvelope({
    envelope: withdrawals,
    collection: 'withdrawals',
    projectionType: 'TradingVaultWithdrawalProjection',
    eventName: 'Withdraw',
  });

  return normalizeVaultHistoryPanelFixture({ deposits, withdrawals });
};

const requestHistoryEnvelope = async ({ baseUrl, path, fetchImpl }) => {
  const response = await fetchImpl(new URL(path, baseUrl).toString());
  if (!response.ok) {
    throw new Error(`GET ${path} failed with HTTP ${response.status}.`);
  }

  return response.json();
};

export const fetchVaultHistoryApiEnvelopes = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchVaultHistoryApiEnvelopes requires a fetch implementation.');
  }

  const [deposits, withdrawals] = await Promise.all([
    requestHistoryEnvelope({ baseUrl, path: '/v1/vault/deposits', fetchImpl }),
    requestHistoryEnvelope({ baseUrl, path: '/v1/vault/withdrawals', fetchImpl }),
  ]);

  return normalizeVaultHistoryApiEnvelopes({ deposits, withdrawals });
};

const historyRowCount = (vaultHistory) => (
  vaultHistory.deposits.deposits.length + vaultHistory.withdrawals.withdrawals.length
);

export const bindVaultHistoryLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onHistory = noop,
  onError = noop,
} = {}) => {
  try {
    const vaultHistory = await fetchVaultHistoryApiEnvelopes({ baseUrl, fetchImpl });
    const fixture = {
      ...baseFixture,
      vaultHistory,
    };

    setDatasetValue(mount, 'qdxVaultHistorySmoke', vaultHistory.deposits.source);
    setDatasetValue(mount, 'qdxVaultHistoryDepositProjection', vaultHistory.deposits.projectionType);
    setDatasetValue(mount, 'qdxVaultHistoryWithdrawalProjection', vaultHistory.withdrawals.projectionType);
    setDatasetValue(mount, 'qdxVaultHistoryRows', String(historyRowCount(vaultHistory)));

    if (mount !== undefined && mount !== null) {
      mount.innerHTML = render(fixture);
    }

    onHistory(vaultHistory, fixture);

    return {
      vaultHistory: clone(vaultHistory),
      close() {},
    };
  } catch (error) {
    setDatasetValue(mount, 'qdxVaultHistorySmoke', 'error');
    onError(error);
    throw error;
  }
};
