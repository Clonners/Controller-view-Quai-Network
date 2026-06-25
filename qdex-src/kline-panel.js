const KLINE_SOURCE = 'mock-candle-projection';
const KLINE_PAYLOAD = 'kline_snapshot';
const PUBLIC_CUSTODY = 'public-read-only-no-custody';
const DEFAULT_MARKET_ID = 'WQUAI-WQI';
const DEFAULT_INTERVAL = '1m';
const SAFE_PERMISSIONS = Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']);

const DEFAULT_SAFETY = Object.freeze({
  noWalletLoading: true,
  noRpcUrlAccess: true,
  noSigning: true,
  noBroadcast: true,
  noDeploys: true,
  noTransactionSubmission: true,
  noFundsMovement: true,
  noCustodyAuthority: true,
  notice:
    'Read-only public kline/candle metadata: local/mock candles have no wallet loaded, no RPC URL, no signing, no broadcast, no transaction submission, no custody authority, and no funds moved.',
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const freezeCandles = (candles = []) => Object.freeze(candles.map((candle) => Object.freeze({ ...candle })));
const normalizeSafety = (safety = {}) => Object.freeze({ ...DEFAULT_SAFETY, ...safety });

const assertSource = (source) => {
  if (source !== KLINE_SOURCE) {
    throw new Error(`kline source must be ${KLINE_SOURCE}.`);
  }
};

const assertPayload = (payload) => {
  if (payload !== KLINE_PAYLOAD) {
    throw new Error(`kline payload must be ${KLINE_PAYLOAD}.`);
  }
};

const assertCustody = (custody) => {
  if (custody !== PUBLIC_CUSTODY) {
    throw new Error(`kline custody must be ${PUBLIC_CUSTODY}.`);
  }
};

const assertSafePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw new Error('kline permissions must be an array.');
  }

  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => ['WITHDRAW', 'ADMIN'].includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`kline permissions are unsafe: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}.`);
  }
};

export const createMockKlineFixture = ({
  marketId = DEFAULT_MARKET_ID,
  interval = DEFAULT_INTERVAL,
  candles = [],
} = {}) => Object.freeze({
  marketId,
  interval,
  candles: freezeCandles(candles),
  source: KLINE_SOURCE,
  payload: KLINE_PAYLOAD,
  custody: PUBLIC_CUSTODY,
  permissions: [...SAFE_PERMISSIONS],
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  safety: normalizeSafety(),
});

export const normalizeKlinePanelFixture = (klines = createMockKlineFixture()) => {
  const source = klines.source ?? KLINE_SOURCE;
  const payload = klines.payload ?? KLINE_PAYLOAD;
  const custody = klines.custody ?? PUBLIC_CUSTODY;
  const permissions = [...(klines.permissions ?? SAFE_PERMISSIONS)];

  assertSource(source);
  assertPayload(payload);
  assertCustody(custody);
  assertSafePermissions(permissions);

  return Object.freeze({
    marketId: klines.marketId ?? DEFAULT_MARKET_ID,
    interval: klines.interval ?? DEFAULT_INTERVAL,
    candles: freezeCandles(klines.candles ?? []),
    source,
    payload,
    custody,
    permissions,
    realQuaiTransactions: klines.realQuaiTransactions ?? false,
    walletRequired: klines.walletRequired ?? false,
    fundsMoved: klines.fundsMoved ?? false,
    tradingVaultMutation: klines.tradingVaultMutation ?? false,
    safety: normalizeSafety(klines.safety),
  });
};

export const cloneKlineFixture = (klines) => clone(normalizeKlinePanelFixture(klines));
