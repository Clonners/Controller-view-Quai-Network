const ACCOUNT_OVERVIEW_SAFETY = Object.freeze({
  account: null,
  source: 'mock-account-overview',
  projectionType: 'LocalAccountOverviewProjection',
  custody: 'non-custodial-contract-vault',
  session: Object.freeze({
    mode: 'mock-local-no-wallet-session',
    authenticated: false,
    walletRequired: false,
  }),
  permissions: Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']),
  settlementMode: 'mock',
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
});

const ACCOUNT_OVERVIEW_NOTICE = 'Mock account overview only: no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.';
const BALANCE_NOTICE = 'Mock vault projection only: no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.';

const DEFAULT_BALANCES = Object.freeze({
  balances: Object.freeze([]),
  source: 'mock-vault-projection',
  custody: 'non-custodial-contract-vault',
  permissions: Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']),
  withdrawalAuthority: 'owner-wallet-only',
  settlementMode: 'mock',
  realQuaiTransactions: false,
  walletRequired: false,
  safetyNotice: BALANCE_NOTICE,
});

const DEFAULT_ORDERS = Object.freeze({
  open: Object.freeze([]),
  source: 'mock-order-projection',
  matcherLocalOnly: true,
});

const DEFAULT_FILLS = Object.freeze({
  items: Object.freeze([]),
  source: 'in-memory-indexer-projection',
  projectionType: 'IndexedFillProjection',
  confirmedOnly: true,
});

const DEFAULT_SAFETY = Object.freeze({
  noWalletLoading: true,
  noRpcUrlAccess: true,
  noSigning: true,
  noBroadcast: true,
  noDeploys: true,
  noTransactionSubmission: true,
  noFundsMovement: true,
  delegateCanWithdraw: false,
  delegateCanAdmin: false,
  notice: ACCOUNT_OVERVIEW_NOTICE,
});

const freezeRows = (rows = []) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

const normalizeBalances = (balances = {}) => Object.freeze({
  balances: freezeRows(balances.balances ?? []),
  source: balances.source ?? DEFAULT_BALANCES.source,
  custody: balances.custody ?? DEFAULT_BALANCES.custody,
  permissions: [...(balances.permissions ?? DEFAULT_BALANCES.permissions)],
  withdrawalAuthority: balances.withdrawalAuthority ?? DEFAULT_BALANCES.withdrawalAuthority,
  settlementMode: balances.settlementMode ?? DEFAULT_BALANCES.settlementMode,
  realQuaiTransactions: balances.realQuaiTransactions ?? false,
  walletRequired: balances.walletRequired ?? false,
  safetyNotice: balances.safetyNotice ?? DEFAULT_BALANCES.safetyNotice,
});

const normalizeOrders = (orders = {}) => Object.freeze({
  open: freezeRows(orders.open ?? []),
  source: orders.source ?? DEFAULT_ORDERS.source,
  matcherLocalOnly: orders.matcherLocalOnly ?? DEFAULT_ORDERS.matcherLocalOnly,
});

const normalizeFills = (fills = {}) => Object.freeze({
  items: freezeRows(fills.items ?? []),
  source: fills.source ?? DEFAULT_FILLS.source,
  projectionType: fills.projectionType ?? DEFAULT_FILLS.projectionType,
  confirmedOnly: fills.confirmedOnly ?? DEFAULT_FILLS.confirmedOnly,
});

const normalizeSession = (session = {}) => Object.freeze({
  mode: session.mode ?? ACCOUNT_OVERVIEW_SAFETY.session.mode,
  authenticated: session.authenticated ?? false,
  walletRequired: session.walletRequired ?? false,
});

const normalizeSafety = (safety = {}) => Object.freeze({
  ...DEFAULT_SAFETY,
  ...safety,
});

export const createMockAccountOverviewFixture = () => Object.freeze({
  ...ACCOUNT_OVERVIEW_SAFETY,
  session: { ...ACCOUNT_OVERVIEW_SAFETY.session },
  permissions: [...ACCOUNT_OVERVIEW_SAFETY.permissions],
  balances: normalizeBalances(DEFAULT_BALANCES),
  orders: normalizeOrders(DEFAULT_ORDERS),
  fills: normalizeFills(DEFAULT_FILLS),
  safety: normalizeSafety(),
});

export const normalizeAccountOverviewPanelFixture = (accountOverview = createMockAccountOverviewFixture()) => Object.freeze({
  account: accountOverview.account ?? null,
  source: accountOverview.source ?? ACCOUNT_OVERVIEW_SAFETY.source,
  projectionType: accountOverview.projectionType ?? ACCOUNT_OVERVIEW_SAFETY.projectionType,
  custody: accountOverview.custody ?? ACCOUNT_OVERVIEW_SAFETY.custody,
  session: normalizeSession(accountOverview.session),
  permissions: [...(accountOverview.permissions ?? ACCOUNT_OVERVIEW_SAFETY.permissions)],
  balances: normalizeBalances(accountOverview.balances),
  orders: normalizeOrders(accountOverview.orders),
  fills: normalizeFills(accountOverview.fills),
  settlementMode: accountOverview.settlementMode ?? ACCOUNT_OVERVIEW_SAFETY.settlementMode,
  realQuaiTransactions: accountOverview.realQuaiTransactions ?? false,
  walletRequired: accountOverview.walletRequired ?? false,
  fundsMoved: accountOverview.fundsMoved ?? false,
  tradingVaultMutation: accountOverview.tradingVaultMutation ?? false,
  safety: normalizeSafety(accountOverview.safety),
});
