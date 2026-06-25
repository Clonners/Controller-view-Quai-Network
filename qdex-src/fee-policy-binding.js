import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { normalizeFeePolicyPanelFixture } from './fee-policy-panel.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const FEE_POLICY_SOURCE = 'feemanager-policy-projection';
const FEE_POLICY_CUSTODY = 'non-custodial-fee-policy';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const LOCAL_MAX_FEE_BPS = 1_000;

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

const assertMockEvidenceIsNull = (schedule, label) => {
  for (const key of ['settlementTx', 'blockNumber', 'blockHash', 'eventIndex', 'explorerUrl']) {
    if (schedule[key] !== null) {
      throw new Error(`${label} ${key} must be null for local/mock FeeManager fee schedule rows.`);
    }
  }
};

const assertBooleanFalse = (value, label) => {
  if (value !== false) {
    throw new Error(`${label} must be false.`);
  }
};

const assertFeeScheduleProjection = (schedule, index) => {
  assertObject(schedule, `feeSchedules[${index}]`);
  assertEqual(schedule.projectionType, 'FeeScheduleProjection', `feeSchedules[${index}].projectionType`);
  assertEqual(schedule.eventName, 'FeesUpdated', `feeSchedules[${index}].eventName`);
  assertEqual(schedule.maxFeeBps, LOCAL_MAX_FEE_BPS, `feeSchedules[${index}].maxFeeBps`);
  assertEqual(schedule.feeRecipient, null, `feeSchedules[${index}].feeRecipient`);
  assertEqual(schedule.settlementMode, 'mock', `feeSchedules[${index}].settlementMode`);
  assertMockEvidenceIsNull(schedule, `feeSchedules[${index}]`);

  if (!Number.isInteger(schedule.makerFeeBps) || schedule.makerFeeBps < 0) {
    throw new Error(`feeSchedules[${index}].makerFeeBps must be a non-negative integer.`);
  }

  if (!Number.isInteger(schedule.takerFeeBps) || schedule.takerFeeBps < 0) {
    throw new Error(`feeSchedules[${index}].takerFeeBps must be a non-negative integer.`);
  }
};

const assertFeePolicySafety = (safety) => {
  assertObject(safety, 'fee policy safety');
  assertEqual(safety.noWalletLoading, true, 'fee policy safety.noWalletLoading');
  assertEqual(safety.noRpcUrlAccess, true, 'fee policy safety.noRpcUrlAccess');
  assertEqual(safety.noSigning, true, 'fee policy safety.noSigning');
  assertEqual(safety.noBroadcast, true, 'fee policy safety.noBroadcast');
  assertEqual(safety.noDeploys, true, 'fee policy safety.noDeploys');
  assertEqual(safety.noTransactionSubmission, true, 'fee policy safety.noTransactionSubmission');
  assertEqual(safety.noFundsMovement, true, 'fee policy safety.noFundsMovement');
  assertEqual(safety.noFeeAuthorityRuntimeKeys, true, 'fee policy safety.noFeeAuthorityRuntimeKeys');

  if (!/Read-only FeeManager schedule metadata/i.test(safety.notice ?? '')) {
    throw new Error('fee policy safety.notice must name read-only FeeManager schedule metadata.');
  }

  if (!/no fee-authority key/i.test(safety.notice ?? '')) {
    throw new Error('fee policy safety.notice must preserve no fee-authority key wording.');
  }

  if (!/no TradingVault mutation/i.test(safety.notice ?? '')) {
    throw new Error('fee policy safety.notice must preserve no TradingVault mutation wording.');
  }
};

export const normalizeFeePolicyApiEnvelope = (feePolicy) => {
  assertObject(feePolicy, 'fee policy envelope');
  assertEqual(feePolicy.source, FEE_POLICY_SOURCE, 'fee policy source');
  assertEqual(feePolicy.status, 'local-only-not-deployed', 'fee policy status');
  assertEqual(feePolicy.custody, FEE_POLICY_CUSTODY, 'fee policy custody');
  assertSafePermissions(feePolicy.permissions, 'fee policy permissions');
  assertEqual(feePolicy.hardMaxFeeBps, LOCAL_MAX_FEE_BPS, 'fee policy hardMaxFeeBps');
  assertEqual(feePolicy.feeRecipient, null, 'fee policy feeRecipient');
  assertBooleanFalse(feePolicy.feeManagerMutation, 'fee policy feeManagerMutation');
  assertBooleanFalse(feePolicy.realQuaiTransactions, 'fee policy realQuaiTransactions');
  assertBooleanFalse(feePolicy.walletRequired, 'fee policy walletRequired');
  assertBooleanFalse(feePolicy.fundsMoved, 'fee policy fundsMoved');
  assertBooleanFalse(feePolicy.tradingVaultMutation, 'fee policy tradingVaultMutation');

  if (!Array.isArray(feePolicy.feeSchedules) || feePolicy.feeSchedules.length === 0) {
    throw new Error('fee policy feeSchedules must be a non-empty array.');
  }

  feePolicy.feeSchedules.forEach(assertFeeScheduleProjection);
  assertFeePolicySafety(feePolicy.safety);

  return normalizeFeePolicyPanelFixture(feePolicy);
};

export const fetchFeePolicyApiEnvelope = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchFeePolicyApiEnvelope requires a fetch implementation.');
  }

  const response = await fetchImpl(new URL('/v1/fees', baseUrl).toString());
  if (!response.ok) {
    throw new Error(`GET /v1/fees failed with HTTP ${response.status}.`);
  }

  return normalizeFeePolicyApiEnvelope(await response.json());
};

const feeScheduleRowCount = (feePolicy) => feePolicy.feeSchedules.length;

export const bindFeePolicyLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onFeePolicy = noop,
  onError = noop,
} = {}) => {
  try {
    const feePolicy = await fetchFeePolicyApiEnvelope({ baseUrl, fetchImpl });
    const fixture = {
      ...baseFixture,
      feePolicy,
    };

    setDatasetValue(mount, 'qdxFeePolicySmoke', feePolicy.source);
    setDatasetValue(mount, 'qdxFeePolicyProjection', feePolicy.feeSchedules[0]?.projectionType ?? 'FeeScheduleProjection');
    setDatasetValue(mount, 'qdxFeePolicyRows', String(feeScheduleRowCount(feePolicy)));

    if (mount !== undefined && mount !== null) {
      mount.innerHTML = render(fixture);
    }

    onFeePolicy(feePolicy, fixture);

    return {
      feePolicy: clone(feePolicy),
      close() {},
    };
  } catch (error) {
    setDatasetValue(mount, 'qdxFeePolicySmoke', 'error');
    onError(error);
    throw error;
  }
};
