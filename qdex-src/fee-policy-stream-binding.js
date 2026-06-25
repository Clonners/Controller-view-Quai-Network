import { bindLiveFeePolicyStream } from './live-fee-policy.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { fetchFeePolicyApiEnvelope } from './fee-policy-binding.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const FEE_POLICY_SOURCE = 'feemanager-policy-projection';
const STREAM_CUSTODY = 'public-read-only-no-custody';
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

const assertScheduleMatchesRest = ({ streamSchedule, restSchedule, index }) => {
  assertObject(streamSchedule, `fees stream schedule[${index}]`);
  assertObject(restSchedule, `REST fee schedule[${index}]`);

  for (const key of [
    'marketId',
    'projectionType',
    'eventName',
    'makerFeeBps',
    'takerFeeBps',
    'maxFeeBps',
    'feeRecipient',
    'settlementMode',
    'settlementTx',
    'blockNumber',
    'blockHash',
    'eventIndex',
    'explorerUrl',
  ]) {
    assertEqual(streamSchedule[key], restSchedule[key], `feeSchedules[${index}].${key}`);
  }

  for (const key of ['settlementTx', 'blockNumber', 'blockHash', 'eventIndex', 'explorerUrl']) {
    if (streamSchedule[key] !== null) {
      throw new Error(`feeSchedules[${index}].${key} must stay null for local/mock FeeManager fee schedule stream smoke.`);
    }
  }
};

const assertFeePolicyMatchesRest = ({ streamPolicy, restPolicy }) => {
  assertObject(streamPolicy, 'FeeManager stream policy envelope');
  assertObject(restPolicy, 'FeeManager REST policy envelope');

  for (const key of [
    'source',
    'status',
    'custody',
    'hardMaxFeeBps',
    'feeRecipient',
    'feeManagerMutation',
    'realQuaiTransactions',
    'walletRequired',
    'fundsMoved',
    'tradingVaultMutation',
  ]) {
    assertEqual(streamPolicy[key], restPolicy[key], `fee policy ${key}`);
  }

  assertEqual(streamPolicy.source, FEE_POLICY_SOURCE, 'fee policy source');
  assertSafePermissions(streamPolicy.permissions, 'FeeManager stream permissions');
  assertSafePermissions(restPolicy.permissions, 'FeeManager REST permissions');

  if (JSON.stringify(streamPolicy.permissions) !== JSON.stringify(restPolicy.permissions)) {
    throw new Error('FeeManager stream permissions must match the REST fee schedule snapshot before rendering.');
  }

  assertObject(streamPolicy.safety, 'FeeManager stream safety');
  assertObject(restPolicy.safety, 'FeeManager REST safety');
  for (const key of [
    'noWalletLoading',
    'noRpcUrlAccess',
    'noSigning',
    'noBroadcast',
    'noDeploys',
    'noTransactionSubmission',
    'noFundsMovement',
    'noFeeAuthorityRuntimeKeys',
    'notice',
  ]) {
    assertEqual(streamPolicy.safety[key], restPolicy.safety[key], `fee policy safety.${key}`);
  }

  if (!Array.isArray(streamPolicy.feeSchedules) || !Array.isArray(restPolicy.feeSchedules)) {
    throw new Error('FeeManager REST and WebSocket fee schedules must both be arrays before rendering.');
  }
  if (streamPolicy.feeSchedules.length !== restPolicy.feeSchedules.length) {
    throw new Error('FeeManager stream fee schedule row count must match REST before rendering.');
  }

  streamPolicy.feeSchedules.forEach((streamSchedule, index) => {
    assertScheduleMatchesRest({ streamSchedule, restSchedule: restPolicy.feeSchedules[index], index });
  });
};

const assertStreamFixtureMatchesRestSnapshot = ({ fixture, restSnapshot }) => {
  assertObject(fixture, 'FeeManager fee schedule stream fixture');
  assertObject(fixture.feePolicy, 'FeeManager fee schedule stream fixture policy');
  assertObject(fixture.feePolicyStream, 'FeeManager fee schedule stream metadata');

  assertFeePolicyMatchesRest({ streamPolicy: fixture.feePolicy, restPolicy: restSnapshot });
  assertEqual(fixture.feePolicyStream.source, FEE_POLICY_SOURCE, 'FeeManager stream source');
  assertEqual(fixture.feePolicyStream.custody, STREAM_CUSTODY, 'FeeManager stream custody');
  assertSafePermissions(fixture.feePolicyStream.permissions, 'FeeManager stream metadata permissions');
  assertEqual(fixture.feePolicyStream.projectionType, 'FeeScheduleProjection', 'FeeManager stream projectionType');
  assertEqual(fixture.feePolicyStream.eventName, 'FeesUpdated', 'FeeManager stream eventName');
  assertEqual(fixture.feePolicyStream.settlementMode, 'mock', 'FeeManager stream settlementMode');
  assertEqual(fixture.feePolicyStream.hardMaxFeeBps, restSnapshot.hardMaxFeeBps, 'FeeManager stream hardMaxFeeBps');
  assertEqual(fixture.feePolicyStream.feeRecipient, restSnapshot.feeRecipient, 'FeeManager stream feeRecipient');
  assertEqual(fixture.feePolicyStream.rowCount, restSnapshot.feeSchedules.length, 'FeeManager stream rowCount');
  assertEqual(fixture.feePolicyStream.feeManagerMutation, false, 'FeeManager stream feeManagerMutation');
  assertEqual(fixture.feePolicyStream.tradingVaultMutation, false, 'FeeManager stream tradingVaultMutation');
  assertEqual(fixture.feePolicyStream.realQuaiTransactions, false, 'FeeManager stream realQuaiTransactions');
  assertEqual(fixture.feePolicyStream.walletRequired, false, 'FeeManager stream walletRequired');
  assertEqual(fixture.feePolicyStream.fundsMoved, false, 'FeeManager stream fundsMoved');
  assertEqual(fixture.feePolicyStream.noFeeAuthorityRuntimeKeys, true, 'FeeManager stream noFeeAuthorityRuntimeKeys');
};

export const bindLiveFeePolicyStreamWithRestSnapshot = async ({
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
    restSnapshot = await fetchFeePolicyApiEnvelope({ baseUrl, fetchImpl });
    setDatasetValue(mount, 'qdxFeePolicyRestSnapshot', restSnapshot.source);
    onRestSnapshot(clone(restSnapshot));
  } catch (error) {
    setDatasetValue(mount, 'qdxFeePolicyRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const streamBinding = bindLiveFeePolicyStream({
    mount,
    baseUrl,
    baseFixture: {
      ...baseFixture,
      feePolicy: clone(restSnapshot),
    },
    render: (fixture) => {
      assertStreamFixtureMatchesRestSnapshot({ fixture, restSnapshot });
      setDatasetValue(mount, 'qdxFeePolicyStreamRestAgreement', FEE_POLICY_SOURCE);
      return render(fixture);
    },
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxFeePolicyStream', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxFeePolicyStreamRestAgreement', FEE_POLICY_SOURCE);
      onStreamUpdate(fixture, clone(restSnapshot));
    },
  });

  return {
    feePolicy: clone(restSnapshot),
    close() {
      streamBinding.close();
    },
  };
};
