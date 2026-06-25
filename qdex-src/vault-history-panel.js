const VAULT_HISTORY_SAFETY = Object.freeze({
  source: 'tradingvault-event-projection',
  custody: 'non-custodial-contract-vault',
  permissions: Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']),
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

const VAULT_HISTORY_CONFIG = Object.freeze({
  deposit: Object.freeze({
    collection: 'deposits',
    projectionType: 'TradingVaultDepositProjection',
    eventName: 'Deposit',
  }),
  withdrawal: Object.freeze({
    collection: 'withdrawals',
    projectionType: 'TradingVaultWithdrawalProjection',
    eventName: 'Withdraw',
  }),
});

const freezeRows = (rows = []) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

const safetyNoticeFor = (eventName) => (
  `Read-only TradingVault ${eventName} history projection: mock rows have no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.`
);

const createHistoryEnvelope = (operation, rows = []) => {
  const config = VAULT_HISTORY_CONFIG[operation];
  if (config === undefined) {
    throw new Error(`Unsupported vault history operation: ${operation}`);
  }

  return Object.freeze({
    [config.collection]: freezeRows(rows),
    ...VAULT_HISTORY_SAFETY,
    permissions: [...VAULT_HISTORY_SAFETY.permissions],
    projectionType: config.projectionType,
    eventName: config.eventName,
    safetyNotice: safetyNoticeFor(config.eventName),
  });
};

const normalizeEnvelope = (operation, envelope = {}) => {
  const config = VAULT_HISTORY_CONFIG[operation];
  const rows = envelope[config.collection] ?? [];

  return Object.freeze({
    [config.collection]: freezeRows(rows),
    source: envelope.source ?? VAULT_HISTORY_SAFETY.source,
    projectionType: envelope.projectionType ?? config.projectionType,
    eventName: envelope.eventName ?? config.eventName,
    custody: envelope.custody ?? VAULT_HISTORY_SAFETY.custody,
    permissions: [...(envelope.permissions ?? VAULT_HISTORY_SAFETY.permissions)],
    settlementMode: envelope.settlementMode ?? VAULT_HISTORY_SAFETY.settlementMode,
    settlementTx: envelope.settlementTx ?? null,
    blockNumber: envelope.blockNumber ?? null,
    blockHash: envelope.blockHash ?? null,
    eventIndex: envelope.eventIndex ?? null,
    explorerUrl: envelope.explorerUrl ?? null,
    realQuaiTransactions: envelope.realQuaiTransactions ?? false,
    walletRequired: envelope.walletRequired ?? false,
    fundsMoved: envelope.fundsMoved ?? false,
    tradingVaultMutation: envelope.tradingVaultMutation ?? false,
    safetyNotice: envelope.safetyNotice ?? safetyNoticeFor(config.eventName),
  });
};

export const createMockVaultHistoryFixture = () => Object.freeze({
  deposits: createHistoryEnvelope('deposit'),
  withdrawals: createHistoryEnvelope('withdrawal'),
});

export const normalizeVaultHistoryPanelFixture = (vaultHistory = createMockVaultHistoryFixture()) => Object.freeze({
  deposits: normalizeEnvelope('deposit', vaultHistory.deposits),
  withdrawals: normalizeEnvelope('withdrawal', vaultHistory.withdrawals),
});
