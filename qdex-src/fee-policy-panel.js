const LOCAL_MAX_FEE_BPS = 1_000;

const FEE_POLICY_SAFETY = Object.freeze({
  source: 'feemanager-policy-projection',
  status: 'local-only-not-deployed',
  custody: 'non-custodial-fee-policy',
  permissions: Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']),
  hardMaxFeeBps: LOCAL_MAX_FEE_BPS,
  feeRecipient: null,
  feeManagerMutation: false,
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
});

const FEE_SCHEDULE_ROW = Object.freeze({
  marketId: 'WQUAI-WQI',
  projectionType: 'FeeScheduleProjection',
  eventName: 'FeesUpdated',
  makerFeeBps: 0,
  takerFeeBps: 0,
  maxFeeBps: LOCAL_MAX_FEE_BPS,
  feeRecipient: null,
  settlementMode: 'mock',
  settlementTx: null,
  blockNumber: null,
  blockHash: null,
  eventIndex: null,
  explorerUrl: null,
});

const DEFAULT_SAFETY = Object.freeze({
  noWalletLoading: true,
  noRpcUrlAccess: true,
  noSigning: true,
  noBroadcast: true,
  noDeploys: true,
  noTransactionSubmission: true,
  noFundsMovement: true,
  noFeeAuthorityRuntimeKeys: true,
  notice:
    'Read-only FeeManager schedule metadata: local/mock rows have no real Quai transaction, no wallet loaded, no fee-authority key, no TradingVault mutation, and no funds moved.',
});

const freezeScheduleRows = (rows = []) => Object.freeze(rows.map((row) => Object.freeze({
  ...FEE_SCHEDULE_ROW,
  ...row,
})));

const normalizeSafety = (safety = {}) => Object.freeze({
  ...DEFAULT_SAFETY,
  ...safety,
});

export const createMockFeePolicyFixture = () => Object.freeze({
  feeSchedules: freezeScheduleRows([FEE_SCHEDULE_ROW]),
  ...FEE_POLICY_SAFETY,
  permissions: [...FEE_POLICY_SAFETY.permissions],
  safety: normalizeSafety(),
});

export const normalizeFeePolicyPanelFixture = (feePolicy = createMockFeePolicyFixture()) => Object.freeze({
  feeSchedules: freezeScheduleRows(feePolicy.feeSchedules ?? [FEE_SCHEDULE_ROW]),
  source: feePolicy.source ?? FEE_POLICY_SAFETY.source,
  status: feePolicy.status ?? FEE_POLICY_SAFETY.status,
  custody: feePolicy.custody ?? FEE_POLICY_SAFETY.custody,
  permissions: [...(feePolicy.permissions ?? FEE_POLICY_SAFETY.permissions)],
  hardMaxFeeBps: feePolicy.hardMaxFeeBps ?? FEE_POLICY_SAFETY.hardMaxFeeBps,
  feeRecipient: feePolicy.feeRecipient ?? null,
  feeManagerMutation: feePolicy.feeManagerMutation ?? false,
  realQuaiTransactions: feePolicy.realQuaiTransactions ?? false,
  walletRequired: feePolicy.walletRequired ?? false,
  fundsMoved: feePolicy.fundsMoved ?? false,
  tradingVaultMutation: feePolicy.tradingVaultMutation ?? false,
  safety: normalizeSafety(feePolicy.safety),
});
