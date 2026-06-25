import { bindLiveBalanceStream } from './live-balances.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const BALANCE_SOURCE = 'mock-vault-projection';
const BALANCE_CUSTODY = 'non-custodial-contract-vault';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const BALANCE_SAFETY_NOTICE = 'Mock vault projection only: no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.';

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

export const normalizeAccountBalancesSnapshot = (snapshot) => {
  assertObject(snapshot, 'account balance snapshot');
  assertEqual(snapshot.source, BALANCE_SOURCE, 'account balance source');
  assertEqual(snapshot.custody, BALANCE_CUSTODY, 'account balance custody');
  assertSafePermissions(snapshot.permissions, 'unsafe account balance permissions');
  assertEqual(snapshot.withdrawalAuthority, 'owner-wallet-only', 'account balance withdrawalAuthority');
  assertEqual(snapshot.settlementMode, 'mock', 'account balance settlementMode');
  assertEqual(snapshot.realQuaiTransactions, false, 'account balance realQuaiTransactions');
  assertEqual(snapshot.walletRequired, false, 'account balance walletRequired');

  if (!Array.isArray(snapshot.balances)) {
    throw new Error('account balance balances must be an array.');
  }

  if (snapshot.safetyNotice !== BALANCE_SAFETY_NOTICE) {
    throw new Error('account balance safety notice must state no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.');
  }

  return clone(snapshot);
};

const accountBalancesUrl = (baseUrl) => new URL('/v1/account/balances', baseUrl).toString();

export const fetchAccountBalancesSnapshot = async ({ baseUrl = DEFAULT_API_BASE_URL, fetchImpl = globalThis.fetch } = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchAccountBalancesSnapshot requires a fetch implementation.');
  }

  const response = await fetchImpl(accountBalancesUrl(baseUrl));
  if (!response.ok) {
    throw new Error(`GET /v1/account/balances failed with HTTP ${response.status}.`);
  }

  return normalizeAccountBalancesSnapshot(await response.json());
};

const assertStreamMatchesRestSnapshot = (fixture, restSnapshot) => {
  assertObject(fixture, 'balance stream fixture');
  assertObject(fixture.balanceProjection, 'balance stream projection');
  assertEqual(fixture.balanceProjection.source, restSnapshot.source, 'balance stream projection source');
  assertEqual(fixture.balanceProjection.safetyNotice, restSnapshot.safetyNotice, 'balance stream projection safety notice');
  assertEqual(fixture.balanceProjection.realQuaiTransactions, false, 'balance stream realQuaiTransactions');
  assertEqual(fixture.balanceProjection.walletRequired, false, 'balance stream walletRequired');
  assertSafePermissions(fixture.balanceProjection.permissions, 'unsafe balance stream projection permissions');
};

export const bindLiveBalanceStreamWithAccountSnapshot = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = globalThis.WebSocket,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onRestSnapshot = noop,
  onStreamUpdate = noop,
  onRestError = noop,
  onStreamError = noop,
} = {}) => {
  let restSnapshot;
  try {
    restSnapshot = await fetchAccountBalancesSnapshot({ baseUrl, fetchImpl });
    setDatasetValue(mount, 'qdxBalanceRestSnapshot', restSnapshot.source);
    onRestSnapshot(restSnapshot);
  } catch (error) {
    setDatasetValue(mount, 'qdxBalanceRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLiveBalanceStream({
    mount,
    baseUrl,
    baseFixture,
    render: (fixture) => {
      assertStreamMatchesRestSnapshot(fixture, restSnapshot);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxLiveBalancesStream', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxLiveBalancesStream', 'balances');
      onStreamUpdate(fixture, restSnapshot);
    },
  });

  return {
    restSnapshot: clone(restSnapshot),
    close() {
      streamBinding.close();
    },
  };
};
