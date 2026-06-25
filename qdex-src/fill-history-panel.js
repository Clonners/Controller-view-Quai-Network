const FILL_HISTORY_SAFETY = Object.freeze({
  source: 'in-memory-indexer-projection',
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
});

const FILL_HISTORY_NOTICE = 'Read-only IndexedFillProjection fill history: mock rows have no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.';

const freezeRows = (rows = []) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

const normalizeFills = (fills = []) => freezeRows(fills);

export const createMockFillHistoryFixture = () => Object.freeze({
  ...FILL_HISTORY_SAFETY,
  fills: freezeRows([]),
  projectionType: 'IndexedFillProjection',
  eventName: 'Fill',
  safetyNotice: FILL_HISTORY_NOTICE,
});

export const normalizeFillHistoryPanelFixture = (fillHistory = createMockFillHistoryFixture()) => Object.freeze({
  fills: normalizeFills(fillHistory.fills ?? []),
  source: fillHistory.source ?? FILL_HISTORY_SAFETY.source,
  custody: fillHistory.custody ?? FILL_HISTORY_SAFETY.custody,
  permissions: [...(fillHistory.permissions ?? FILL_HISTORY_SAFETY.permissions)],
  projectionType: fillHistory.projectionType ?? 'IndexedFillProjection',
  eventName: fillHistory.eventName ?? 'Fill',
  settlementMode: fillHistory.settlementMode ?? FILL_HISTORY_SAFETY.settlementMode,
  settlementTx: fillHistory.settlementTx ?? null,
  blockNumber: fillHistory.blockNumber ?? null,
  blockHash: fillHistory.blockHash ?? null,
  eventIndex: fillHistory.eventIndex ?? null,
  explorerUrl: fillHistory.explorerUrl ?? null,
  realQuaiTransactions: fillHistory.realQuaiTransactions ?? false,
  walletRequired: fillHistory.walletRequired ?? false,
  fundsMoved: fillHistory.fundsMoved ?? false,
  tradingVaultMutation: fillHistory.tradingVaultMutation ?? false,
  safetyNotice: fillHistory.safetyNotice ?? FILL_HISTORY_NOTICE,
});
