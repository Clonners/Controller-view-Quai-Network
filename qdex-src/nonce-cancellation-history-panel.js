const NONCE_CANCELLATION_HISTORY_SAFETY = Object.freeze({
  source: 'nonce-manager-event-projection',
  custody: 'non-custodial',
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
  nonceManagerMutation: false,
});

const NONCE_CANCELLATION_HISTORY_CONFIG = Object.freeze({
  cancellation: Object.freeze({
    collection: 'cancellations',
    projectionType: 'NonceCancelledProjection',
    eventName: 'NonceCancelled',
  }),
  rangeCancellation: Object.freeze({
    collection: 'rangeCancellations',
    projectionType: 'NonceRangeCancelledProjection',
    eventName: 'NonceRangeCancelled',
  }),
});

const freezeRows = (rows = []) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

const safetyNoticeFor = (eventName) => (
  `Read-only NonceManager ${eventName} history projection: mock rows have no real Quai transaction, no wallet loaded, no live NonceManager mutation, no funds moved, and no delegate withdrawal/admin authority.`
);

const configFor = (operation) => {
  const config = NONCE_CANCELLATION_HISTORY_CONFIG[operation];
  if (config === undefined) {
    throw new Error(`Unsupported nonce cancellation history operation: ${operation}`);
  }
  return config;
};

const createHistoryEnvelope = (operation, rows = []) => {
  const config = configFor(operation);

  return Object.freeze({
    [config.collection]: freezeRows(rows),
    ...NONCE_CANCELLATION_HISTORY_SAFETY,
    permissions: [...NONCE_CANCELLATION_HISTORY_SAFETY.permissions],
    projectionType: config.projectionType,
    eventName: config.eventName,
    safetyNotice: safetyNoticeFor(config.eventName),
  });
};

const normalizeEnvelope = (operation, envelope = {}) => {
  const config = configFor(operation);
  const rows = envelope[config.collection] ?? [];

  return Object.freeze({
    [config.collection]: freezeRows(rows),
    source: envelope.source ?? NONCE_CANCELLATION_HISTORY_SAFETY.source,
    projectionType: envelope.projectionType ?? config.projectionType,
    eventName: envelope.eventName ?? config.eventName,
    custody: envelope.custody ?? NONCE_CANCELLATION_HISTORY_SAFETY.custody,
    permissions: [...(envelope.permissions ?? NONCE_CANCELLATION_HISTORY_SAFETY.permissions)],
    settlementMode: envelope.settlementMode ?? NONCE_CANCELLATION_HISTORY_SAFETY.settlementMode,
    settlementTx: envelope.settlementTx ?? null,
    blockNumber: envelope.blockNumber ?? null,
    blockHash: envelope.blockHash ?? null,
    eventIndex: envelope.eventIndex ?? null,
    explorerUrl: envelope.explorerUrl ?? null,
    realQuaiTransactions: envelope.realQuaiTransactions ?? false,
    walletRequired: envelope.walletRequired ?? false,
    fundsMoved: envelope.fundsMoved ?? false,
    tradingVaultMutation: envelope.tradingVaultMutation ?? false,
    nonceManagerMutation: envelope.nonceManagerMutation ?? false,
    safetyNotice: envelope.safetyNotice ?? safetyNoticeFor(config.eventName),
  });
};

export const createMockNonceCancellationHistoryFixture = () => Object.freeze({
  cancellations: createHistoryEnvelope('cancellation'),
  rangeCancellations: createHistoryEnvelope('rangeCancellation'),
});

export const normalizeNonceCancellationHistoryPanelFixture = (
  nonceCancellationHistory = createMockNonceCancellationHistoryFixture(),
) => Object.freeze({
  cancellations: normalizeEnvelope('cancellation', nonceCancellationHistory.cancellations),
  rangeCancellations: normalizeEnvelope('rangeCancellation', nonceCancellationHistory.rangeCancellations),
});
