import { normalizeAccountOverviewPanelFixture } from './account-overview-panel.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const ACCOUNT_SOURCE = 'mock-account-overview';
const ACCOUNT_PROJECTION = 'LocalAccountOverviewProjection';
const ACCOUNT_CUSTODY = 'non-custodial-contract-vault';
const BALANCE_SOURCE = 'mock-vault-projection';
const ORDER_SOURCE = 'mock-order-projection';
const FILL_SOURCE = 'in-memory-indexer-projection';
const FILL_PROJECTION = 'IndexedFillProjection';
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

const assertFalse = (actual, label) => {
  if (actual !== false) {
    throw new Error(`${label} must be false.`);
  }
};

const assertTrue = (actual, label) => {
  if (actual !== true) {
    throw new Error(`${label} must be true.`);
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

const assertSafetyNotice = (notice) => {
  if (!/Mock account overview only/i.test(notice ?? '')) {
    throw new Error('account overview safety notice must name the mock account overview boundary.');
  }

  if (!/no real Quai transaction/i.test(notice ?? '')) {
    throw new Error('account overview safety notice must preserve no-real-Quai wording.');
  }

  if (!/no wallet loaded/i.test(notice ?? '')) {
    throw new Error('account overview safety notice must preserve no-wallet wording.');
  }

  if (!/no funds moved/i.test(notice ?? '')) {
    throw new Error('account overview safety notice must preserve no-funds wording.');
  }

  if (!/no delegate withdrawal\/admin authority/i.test(notice ?? '')) {
    throw new Error('account overview safety notice must preserve no delegate withdrawal/admin authority wording.');
  }
};

const assertProjectionRows = (rows, label) => {
  if (!Array.isArray(rows)) {
    throw new Error(`${label} must be an array.`);
  }
};

const assertAccountOverviewSafety = (accountOverview) => {
  assertObject(accountOverview.safety, 'account overview safety');
  assertTrue(accountOverview.safety.noWalletLoading, 'account overview safety.noWalletLoading');
  assertTrue(accountOverview.safety.noRpcUrlAccess, 'account overview safety.noRpcUrlAccess');
  assertTrue(accountOverview.safety.noSigning, 'account overview safety.noSigning');
  assertTrue(accountOverview.safety.noBroadcast, 'account overview safety.noBroadcast');
  assertTrue(accountOverview.safety.noDeploys, 'account overview safety.noDeploys');
  assertTrue(accountOverview.safety.noTransactionSubmission, 'account overview safety.noTransactionSubmission');
  assertTrue(accountOverview.safety.noFundsMovement, 'account overview safety.noFundsMovement');
  assertFalse(accountOverview.safety.delegateCanWithdraw, 'account overview safety.delegateCanWithdraw');
  assertFalse(accountOverview.safety.delegateCanAdmin, 'account overview safety.delegateCanAdmin');
  assertSafetyNotice(accountOverview.safety.notice);
};

export const normalizeAccountOverviewApiEnvelope = (accountOverview) => {
  assertObject(accountOverview, 'account overview envelope');
  assertEqual(accountOverview.account, null, 'account overview account');
  assertEqual(accountOverview.source, ACCOUNT_SOURCE, 'account overview source');
  assertEqual(accountOverview.projectionType, ACCOUNT_PROJECTION, 'account overview projectionType');
  assertEqual(accountOverview.custody, ACCOUNT_CUSTODY, 'account overview custody');
  assertSafePermissions(accountOverview.permissions, 'account overview permissions');
  assertEqual(accountOverview.settlementMode, 'mock', 'account overview settlementMode');
  assertFalse(accountOverview.realQuaiTransactions, 'account overview realQuaiTransactions');
  assertFalse(accountOverview.walletRequired, 'account overview walletRequired');
  assertFalse(accountOverview.fundsMoved, 'account overview fundsMoved');
  assertFalse(accountOverview.tradingVaultMutation, 'account overview tradingVaultMutation');

  assertObject(accountOverview.session, 'account overview session');
  assertEqual(accountOverview.session.mode, 'mock-local-no-wallet-session', 'account overview session.mode');
  assertFalse(accountOverview.session.authenticated, 'account overview session.authenticated');
  assertFalse(accountOverview.session.walletRequired, 'account overview session.walletRequired');

  assertObject(accountOverview.balances, 'account overview balances');
  assertEqual(accountOverview.balances.source, BALANCE_SOURCE, 'account overview balances.source');
  assertSafePermissions(accountOverview.balances.permissions, 'account overview balances.permissions');
  assertEqual(accountOverview.balances.custody, ACCOUNT_CUSTODY, 'account overview balances.custody');
  assertEqual(accountOverview.balances.settlementMode, 'mock', 'account overview balances.settlementMode');
  assertFalse(accountOverview.balances.realQuaiTransactions, 'account overview balances.realQuaiTransactions');
  assertFalse(accountOverview.balances.walletRequired, 'account overview balances.walletRequired');
  assertProjectionRows(accountOverview.balances.balances, 'account overview balances.balances');

  assertObject(accountOverview.orders, 'account overview orders');
  assertEqual(accountOverview.orders.source, ORDER_SOURCE, 'account overview orders.source');
  assertEqual(accountOverview.orders.matcherLocalOnly, true, 'account overview orders.matcherLocalOnly');
  assertProjectionRows(accountOverview.orders.open, 'account overview orders.open');

  assertObject(accountOverview.fills, 'account overview fills');
  assertEqual(accountOverview.fills.source, FILL_SOURCE, 'account overview fills.source');
  assertEqual(accountOverview.fills.projectionType, FILL_PROJECTION, 'account overview fills.projectionType');
  assertEqual(accountOverview.fills.confirmedOnly, true, 'account overview fills.confirmedOnly');
  assertProjectionRows(accountOverview.fills.items, 'account overview fills.items');

  assertAccountOverviewSafety(accountOverview);

  return normalizeAccountOverviewPanelFixture(accountOverview);
};

export const fetchAccountOverviewApiEnvelope = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchAccountOverviewApiEnvelope requires a fetch implementation.');
  }

  const response = await fetchImpl(new URL('/v1/account', baseUrl).toString());
  if (!response.ok) {
    throw new Error(`GET /v1/account failed with HTTP ${response.status}.`);
  }

  return normalizeAccountOverviewApiEnvelope(await response.json());
};

const balanceRowCount = (accountOverview) => accountOverview.balances.balances.length;
const openOrderCount = (accountOverview) => accountOverview.orders.open.length;
const confirmedFillCount = (accountOverview) => accountOverview.fills.items.length;

export const bindAccountOverviewLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onAccountOverview = noop,
  onError = noop,
} = {}) => {
  try {
    const accountOverview = await fetchAccountOverviewApiEnvelope({ baseUrl, fetchImpl });
    const fixture = {
      ...baseFixture,
      accountOverview,
    };

    setDatasetValue(mount, 'qdxAccountOverviewSmoke', accountOverview.source);
    setDatasetValue(mount, 'qdxAccountOverviewProjection', accountOverview.projectionType);
    setDatasetValue(mount, 'qdxAccountOverviewBalances', String(balanceRowCount(accountOverview)));
    setDatasetValue(mount, 'qdxAccountOverviewOrders', String(openOrderCount(accountOverview)));
    setDatasetValue(mount, 'qdxAccountOverviewFills', String(confirmedFillCount(accountOverview)));

    if (mount !== undefined && mount !== null) {
      mount.innerHTML = render(fixture);
    }

    onAccountOverview(accountOverview, fixture);

    return {
      accountOverview: clone(accountOverview),
      close() {},
    };
  } catch (error) {
    setDatasetValue(mount, 'qdxAccountOverviewSmoke', 'error');
    onError(error);
    throw error;
  }
};
