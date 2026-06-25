import { bindCommandPaletteSkeleton, createMockCommandPaletteFixture } from './command-palette.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_MARKET_ID = 'WQUAI-WQI';
const SMOKE_SOURCE = 'terminal-command-palette-local-api-smoke';
const PALETTE_SOURCE = 'terminal-command-palette-skeleton';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const SAFETY_NOTICE = 'Local API command-palette smoke only: prechecks read-only/prepare-only surfaces, keeps preview-only-no-dispatch, and performs no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.';

const HTTP_COMMANDS = Object.freeze([
  Object.freeze({
    command: ':markets',
    method: 'GET',
    pathname: '/v1/markets',
    expectedStatuses: [200],
    source: 'market-list',
    validate(body) {
      assertArray(body.markets, 'markets response markets');
      if (!body.markets.some((market) => market?.id === DEFAULT_MARKET_ID)) {
        throw new Error('GET /v1/markets must include WQUAI-WQI for command-palette preview.');
      }
    },
  }),
  Object.freeze({
    command: ':ticker WQUAI-WQI',
    method: 'GET',
    pathname: `/v1/tickers/${DEFAULT_MARKET_ID}`,
    expectedStatuses: [200],
    source: 'mock-market-data',
    validate(body) {
      assertEqual(body.marketId, DEFAULT_MARKET_ID, 'ticker marketId');
      assertEqual(body.source, 'mock-market-data', 'ticker source');
      assertEqual(body.volume24h, '0', 'ticker volume24h');
    },
  }),
  Object.freeze({
    command: ':book WQUAI-WQI',
    method: 'GET',
    pathname: `/v1/orderbook/${DEFAULT_MARKET_ID}`,
    expectedStatuses: [200],
    source: 'mock-orderbook',
    validate(body) {
      assertEqual(body.marketId, DEFAULT_MARKET_ID, 'orderbook marketId');
      assertEqual(body.source, 'mock-orderbook', 'orderbook source');
      assertArray(body.bids, 'orderbook bids');
      assertArray(body.asks, 'orderbook asks');
    },
  }),
  Object.freeze({
    command: ':proof trade-000001',
    method: 'GET',
    pathname: '/v1/proofs/trades/trade-000001',
    expectedStatuses: [404],
    source: 'proof-service-indexer-projection',
    validate(body) {
      assertEqual(body.error, 'proof_not_found', 'fresh proof lookup error');
      assertEqual(body.source, 'proof-service-indexer-projection', 'fresh proof lookup source');
      assertEqual(body.proof, null, 'fresh proof lookup proof');
    },
  }),
  Object.freeze({
    command: ':balance',
    method: 'GET',
    pathname: '/v1/account/balances',
    expectedStatuses: [200],
    source: 'mock-vault-projection',
    validate(body) {
      assertEqual(body.source, 'mock-vault-projection', 'account balances source');
      assertSafePermissions(body.permissions, 'account balances');
      assertEqual(body.realQuaiTransactions, false, 'account balances realQuaiTransactions');
      assertEqual(body.walletRequired, false, 'account balances walletRequired');
    },
  }),
  Object.freeze({
    command: ':account',
    method: 'GET',
    pathname: '/v1/account',
    expectedStatuses: [200],
    source: 'mock-account-overview',
    validate(body) {
      assertEqual(body.source, 'mock-account-overview', 'account overview source');
      assertEqual(body.projectionType, 'LocalAccountOverviewProjection', 'account overview projectionType');
      assertSafePermissions(body.permissions, 'account overview');
      assertEqual(body.realQuaiTransactions, false, 'account overview realQuaiTransactions');
      assertEqual(body.walletRequired, false, 'account overview walletRequired');
      assertEqual(body.fundsMoved, false, 'account overview fundsMoved');
      assertEqual(body.tradingVaultMutation, false, 'account overview tradingVaultMutation');
    },
  }),
  Object.freeze({
    command: ':fees',
    method: 'GET',
    pathname: '/v1/fees',
    expectedStatuses: [200],
    source: 'feemanager-policy-projection',
    validate(body) {
      assertEqual(body.source, 'feemanager-policy-projection', 'fee policy source');
      assertSafePermissions(body.permissions, 'fee policy');
      assertEqual(body.realQuaiTransactions, false, 'fee policy realQuaiTransactions');
      assertEqual(body.walletRequired, false, 'fee policy walletRequired');
      assertEqual(body.fundsMoved, false, 'fee policy fundsMoved');
      assertEqual(body.tradingVaultMutation, false, 'fee policy tradingVaultMutation');
      assertEqual(body.feeManagerMutation, false, 'fee policy feeManagerMutation');
    },
  }),
  Object.freeze({
    command: ':deposit WQI 10 prepare owner-wallet-only',
    method: 'POST',
    pathname: '/v1/vault/deposits/prepare',
    expectedStatuses: [501],
    source: 'owner-wallet-vault-operation-placeholder',
    body: { token: 'WQI', amount: '10', requestMode: 'prepare-only-owner-wallet-required' },
    validate(body) {
      assertEqual(body.source, 'owner-wallet-vault-operation-placeholder', 'vault prepare source');
      assertEqual(body.operationStatus, 'prepare-only-not-implemented', 'vault prepare operationStatus');
      assertSafePreparePermissions(body.permissions, 'vault prepare');
      assertEqual(body.realQuaiTransactions, false, 'vault prepare realQuaiTransactions');
      assertEqual(body.walletRequired, false, 'vault prepare walletRequired');
      assertEqual(body.fundsMoved, false, 'vault prepare fundsMoved');
      assertEqual(body.tradingVaultMutation, false, 'vault prepare tradingVaultMutation');
    },
  }),
  Object.freeze({
    command: ':api create-key bot-mm-1 prepare NO_WITHDRAW NO_ADMIN',
    method: 'POST',
    pathname: '/v1/delegate-keys',
    expectedStatuses: [501],
    source: 'delegate-key-owner-signed-prepare-boundary',
    body: {
      label: 'bot-mm-1',
      delegate: '0x000000000000000000000000000000000000dE1E',
      allowedMarkets: [DEFAULT_MARKET_ID],
      permissions: ['PLACE_ORDER', 'CANCEL_ORDER', 'CANCEL_ALL', 'NO_WITHDRAW', 'NO_ADMIN'],
      requestMode: 'prepare-only-owner-signed-required',
    },
    validate(body) {
      assertEqual(body.source, 'delegate-key-owner-signed-prepare-boundary', 'delegate-key prepare source');
      assertEqual(body.operationStatus, 'prepare-only-owner-signed-required', 'delegate-key prepare operationStatus');
      assertSafePreparePermissions(body.permissions, 'delegate-key prepare');
      assertEqual(body.delegateCanWithdraw, false, 'delegate-key prepare delegateCanWithdraw');
      assertEqual(body.delegateCanAdmin, false, 'delegate-key prepare delegateCanAdmin');
      assertEqual(body.realQuaiTransactions, false, 'delegate-key prepare realQuaiTransactions');
      assertEqual(body.walletRequired, false, 'delegate-key prepare walletRequired');
      assertEqual(body.fundsMoved, false, 'delegate-key prepare fundsMoved');
      assertEqual(body.tradingVaultMutation, false, 'delegate-key prepare tradingVaultMutation');
    },
  }),
]);

const PREVIEW_ONLY_COMMANDS = Object.freeze([
  Object.freeze({
    command: ':stream tickers',
    surface: '/v1/ws?channel=global.tickers',
    source: PALETTE_SOURCE,
    dispatchMode: 'preview-only-no-dispatch',
    realQuaiTransactions: false,
    walletRequired: false,
    fundsMoved: false,
    tradingVaultMutation: false,
    marketRegistryMutation: false,
    delegateKeyRegistryMutation: false,
    nonceManagerMutation: false,
  }),
  Object.freeze({
    command: ':mock cross',
    surface: 'existing data-qdx-trigger-cross browser button',
    source: PALETTE_SOURCE,
    dispatchMode: 'preview-only-no-dispatch',
    realQuaiTransactions: false,
    walletRequired: false,
    fundsMoved: false,
    tradingVaultMutation: false,
    marketRegistryMutation: false,
    delegateKeyRegistryMutation: false,
    nonceManagerMutation: false,
  }),
  Object.freeze({
    command: ':cancel all matcher-local',
    surface: 'matcher-local cancellation placeholder',
    source: PALETTE_SOURCE,
    dispatchMode: 'preview-only-no-dispatch',
    realQuaiTransactions: false,
    walletRequired: false,
    fundsMoved: false,
    tradingVaultMutation: false,
    marketRegistryMutation: false,
    delegateKeyRegistryMutation: false,
    nonceManagerMutation: false,
  }),
]);

const noop = () => {};
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const assertArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
};

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(`${label} must be ${expected}.`);
  }
};

const assertSafePermissions = (permissions, label) => {
  assertArray(permissions, `${label} permissions`);
  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => ['WITHDRAW', 'ADMIN'].includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`${label} permissions are unsafe: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}.`);
  }
};

const assertSafePreparePermissions = (permissions, label) => {
  assertArray(permissions, `${label} permissions`);
  const missing = ['NO_WITHDRAW', 'NO_ADMIN'].filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => ['WITHDRAW', 'ADMIN'].includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`${label} permissions are unsafe: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}.`);
  }
};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

const commandSurface = ({ method, pathname }) => `${method} ${pathname}`;

const buildUrl = ({ baseUrl, pathname }) => {
  const url = new URL(baseUrl);
  if (url.protocol === 'wss:') {
    url.protocol = 'https:';
  } else if (url.protocol === 'ws:') {
    url.protocol = 'http:';
  }
  url.pathname = pathname;
  url.search = '';
  return url;
};

const readJsonWithExpectedStatus = async ({ command, baseUrl, fetchImpl }) => {
  const url = buildUrl({ baseUrl, pathname: command.pathname });
  const headers = { accept: 'application/json' };
  const options = { method: command.method, headers };
  if (command.body !== undefined) {
    options.headers = { ...headers, 'content-type': 'application/json' };
    options.body = JSON.stringify(command.body);
  }

  const response = await fetchImpl(url.toString(), options);
  const body = await response.json();
  if (!command.expectedStatuses.includes(response.status)) {
    throw new Error(`${commandSurface(command)} expected HTTP ${command.expectedStatuses.join('/')} but received ${response.status}.`);
  }
  if (!isObject(body)) {
    throw new Error(`${commandSurface(command)} must return an object envelope.`);
  }

  command.validate(body);
  return { response, body };
};

const createSafetyEnvelope = () => ({
  source: SMOKE_SOURCE,
  commandPaletteSource: PALETTE_SOURCE,
  mode: 'local-api-precheck-preview-only',
  dispatchMode: 'preview-only-no-dispatch',
  custody: 'non-custodial-no-withdrawal-authority',
  permissions: [...SAFE_PERMISSIONS],
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  marketRegistryMutation: false,
  delegateKeyRegistryMutation: false,
  nonceManagerMutation: false,
  delegateCanWithdraw: false,
  delegateCanAdmin: false,
  safetyNotice: SAFETY_NOTICE,
});

export const fetchCommandPaletteLocalApiSnapshots = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchCommandPaletteLocalApiSnapshots requires a fetch implementation.');
  }

  const precheckedEntries = [];
  const surfaceLabels = [];

  for (const command of HTTP_COMMANDS) {
    const { response, body } = await readJsonWithExpectedStatus({ command, baseUrl, fetchImpl });
    const source = body.source ?? command.source;
    surfaceLabels.push(commandSurface(command));
    precheckedEntries.push([
      command.command,
      {
        command: command.command,
        method: command.method,
        pathname: command.pathname,
        surface: commandSurface(command),
        httpStatus: response.status,
        source,
        error: typeof body.error === 'string' ? body.error : null,
        dispatchMode: 'preview-only-no-dispatch',
        realQuaiTransactions: false,
        walletRequired: false,
        fundsMoved: false,
        tradingVaultMutation: false,
        marketRegistryMutation: false,
        delegateKeyRegistryMutation: false,
        nonceManagerMutation: false,
        delegateCanWithdraw: body.delegateCanWithdraw ?? false,
        delegateCanAdmin: body.delegateCanAdmin ?? false,
      },
    ]);
  }

  return Object.freeze({
    ...createSafetyEnvelope(),
    surfaces: Object.freeze(surfaceLabels),
    precheckedCommands: Object.freeze(Object.fromEntries(precheckedEntries)),
    previewOnlyCommands: Object.freeze(Object.fromEntries(PREVIEW_ONLY_COMMANDS.map((command) => [
      command.command,
      Object.freeze({ ...command, permissions: [...SAFE_PERMISSIONS] }),
    ]))),
  });
};

const getStatusNode = (mount) => (typeof mount?.querySelector === 'function'
  ? mount.querySelector('[data-qdx-command-palette-status]')
  : null);

const decoratePreviewStatus = ({ mount, preview, apiSnapshot }) => {
  const statusNode = getStatusNode(mount);
  const precheck = apiSnapshot.precheckedCommands[preview.command];
  const previewOnly = apiSnapshot.previewOnlyCommands[preview.command];

  if (preview.status !== 'matched') {
    setDatasetValue(mount, 'qdxCommandPaletteLocalApiPreview', 'unsupported');
    if (statusNode !== null) {
      statusNode.dataset.qdxCommandPaletteLocalApiSmoke = 'unsupported-preview-only';
      statusNode.textContent = `${statusNode.textContent} local API smoke ${SMOKE_SOURCE}: unsupported command remains blocked-no-dispatch; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.`;
    }
    return;
  }

  const surface = precheck?.surface ?? previewOnly?.surface ?? preview.surface;
  const source = precheck?.source ?? previewOnly?.source ?? PALETTE_SOURCE;
  const httpText = precheck !== undefined ? ` HTTP ${precheck.httpStatus}` : '';
  setDatasetValue(mount, 'qdxCommandPaletteLocalApiPreview', surface);
  if (statusNode !== null) {
    statusNode.dataset.qdxCommandPaletteLocalApiSmoke = 'verified-preview-only';
    statusNode.textContent = `${statusNode.textContent} local API smoke ${SMOKE_SOURCE}: ${surface}${httpText} ${source}; READ_ONLY/NO_WITHDRAW/NO_ADMIN; preview-only-no-dispatch; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.`;
  }
};

export const bindCommandPaletteLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  palette = createMockCommandPaletteFixture(),
  onSmoke = noop,
  onPreview = noop,
  onError = noop,
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.querySelector !== 'function') {
    throw new TypeError('bindCommandPaletteLocalApiSmoke requires a mount with querySelector.');
  }

  let apiSnapshot;
  try {
    apiSnapshot = await fetchCommandPaletteLocalApiSnapshots({ baseUrl, fetchImpl });
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    setDatasetValue(mount, 'qdxCommandPaletteLocalApiSmoke', 'error');
    onError(normalizedError);
    throw normalizedError;
  }

  setDatasetValue(mount, 'qdxCommandPaletteLocalApiSmoke', SMOKE_SOURCE);
  setDatasetValue(mount, 'qdxCommandPaletteDispatchMode', 'preview-only-no-dispatch');
  setDatasetValue(mount, 'qdxCommandPalettePermissions', SAFE_PERMISSIONS.join(','));
  setDatasetValue(mount, 'qdxCommandPaletteLocalApiSurfaces', apiSnapshot.surfaces.join(','));
  onSmoke(clone(apiSnapshot));

  const skeletonBinding = bindCommandPaletteSkeleton({
    mount,
    palette,
    onPreview: (preview) => {
      decoratePreviewStatus({ mount, preview, apiSnapshot });
      onPreview(preview, clone(apiSnapshot));
    },
    onError: (error) => {
      setDatasetValue(mount, 'qdxCommandPaletteLocalApiSmoke', 'error');
      onError(error);
    },
  });

  return Object.freeze({
    apiSnapshot: clone(apiSnapshot),
    close() {
      skeletonBinding.close();
    },
  });
};
