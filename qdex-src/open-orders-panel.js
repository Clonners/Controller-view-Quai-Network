const OPEN_ORDERS_SAFETY = Object.freeze({
  source: 'mock-order-projection',
  custody: 'non-custodial-no-withdrawal-authority',
  permissions: Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']),
  matcherLocalOnly: true,
  settlementMode: 'mock',
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
});

const OPEN_ORDERS_NOTICE = 'Mock open orders only: no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.';

const freezeRows = (rows = []) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

const normalizeOpenOrders = (orders = []) => freezeRows(orders);

export const createMockOpenOrdersFixture = () => Object.freeze({
  ...OPEN_ORDERS_SAFETY,
  orders: freezeRows([]),
  safetyNotice: OPEN_ORDERS_NOTICE,
});

export const normalizeOpenOrdersPanelFixture = (openOrders = createMockOpenOrdersFixture()) => Object.freeze({
  orders: normalizeOpenOrders(openOrders.orders ?? []),
  source: openOrders.source ?? OPEN_ORDERS_SAFETY.source,
  projectionType: openOrders.projectionType ?? 'LocalOrderProjection',
  custody: openOrders.custody ?? OPEN_ORDERS_SAFETY.custody,
  permissions: [...(openOrders.permissions ?? OPEN_ORDERS_SAFETY.permissions)],
  matcherLocalOnly: openOrders.matcherLocalOnly ?? OPEN_ORDERS_SAFETY.matcherLocalOnly,
  settlementMode: openOrders.settlementMode ?? OPEN_ORDERS_SAFETY.settlementMode,
  settlementTx: openOrders.settlementTx ?? null,
  blockNumber: openOrders.blockNumber ?? null,
  blockHash: openOrders.blockHash ?? null,
  eventIndex: openOrders.eventIndex ?? null,
  explorerUrl: openOrders.explorerUrl ?? null,
  realQuaiTransactions: openOrders.realQuaiTransactions ?? false,
  walletRequired: openOrders.walletRequired ?? false,
  fundsMoved: openOrders.fundsMoved ?? false,
  tradingVaultMutation: openOrders.tradingVaultMutation ?? false,
  safetyNotice: openOrders.safetyNotice ?? OPEN_ORDERS_NOTICE,
});
