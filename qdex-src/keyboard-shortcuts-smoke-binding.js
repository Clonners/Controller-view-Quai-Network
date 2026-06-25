import {
  createMockKeyboardShortcutHelpFixture,
  normalizeKeyboardShortcutHelpFixture,
} from './keyboard-shortcuts.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_MARKET_ID = 'WQUAI-WQI';
const SMOKE_SOURCE = 'terminal-keyboard-shortcut-help-local-api-smoke';
const HELP_SOURCE = 'terminal-keyboard-shortcut-help';
const SAFE_PERMISSIONS = Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']);
const SAFETY_NOTICE = 'Local API keyboard-shortcut help smoke only: prechecks read-only/prepare-only surfaces, keeps help-only-no-dispatch, and performs no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.';

const PREFLIGHT_CHECKS = Object.freeze([
  Object.freeze({
    key: '/',
    label: '/ search market',
    method: 'GET',
    pathname: '/v1/markets',
    expectedStatuses: [200],
    source: 'market-list',
    validate(body) {
      assertArray(body.markets, 'markets response markets');
      if (!body.markets.some((market) => market?.id === DEFAULT_MARKET_ID)) {
        throw new Error('GET /v1/markets must include WQUAI-WQI for keyboard shortcut help.');
      }
    },
  }),
  Object.freeze({
    key: 'b',
    label: 'b buy preview',
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
    key: 's',
    label: 's sell preview',
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
    key: 'c',
    label: 'c matcher-local cancel',
    method: 'GET',
    pathname: '/v1/orders',
    expectedStatuses: [200],
    source: 'mock-order-projection',
    validate(body) {
      assertArray(body.orders, 'orders response orders');
      assertEqual(body.source, 'mock-order-projection', 'orders source');
    },
  }),
  Object.freeze({
    key: 'o',
    label: 'o open orders',
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
    key: 'w',
    label: 'w owner-wallet deposit prepare boundary',
    method: 'POST',
    pathname: '/v1/vault/deposits/prepare',
    expectedStatuses: [501],
    source: 'owner-wallet-vault-operation-placeholder',
    body: { token: 'WQI', amount: '10', requestMode: 'prepare-only-owner-wallet-required' },
    validate(body) {
      assertVaultPreparePlaceholder(body, 'deposit');
    },
  }),
  Object.freeze({
    key: 'w',
    label: 'w owner-wallet withdrawal prepare boundary',
    method: 'POST',
    pathname: '/v1/vault/withdrawals/prepare',
    expectedStatuses: [501],
    source: 'owner-wallet-vault-operation-placeholder',
    body: { token: 'WQI', amount: '10', requestMode: 'prepare-only-owner-wallet-required' },
    validate(body) {
      assertVaultPreparePlaceholder(body, 'withdrawal');
    },
  }),
  Object.freeze({
    command: ':api create-key bot-mm-1 prepare NO_WITHDRAW NO_ADMIN',
    label: ':api create-key bot-mm-1 prepare NO_WITHDRAW NO_ADMIN',
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

const PREVIEW_ONLY_HINTS = Object.freeze([
  Object.freeze({
    command: ':mock cross',
    surface: 'existing data-qdx-trigger-cross browser button',
    source: HELP_SOURCE,
    dispatchMode: 'help-only-no-dispatch',
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
    source: HELP_SOURCE,
    dispatchMode: 'help-only-no-dispatch',
    realQuaiTransactions: false,
    walletRequired: false,
    fundsMoved: false,
    tradingVaultMutation: false,
    marketRegistryMutation: false,
    delegateKeyRegistryMutation: false,
    nonceManagerMutation: false,
  }),
  Object.freeze({
    command: ':deposit WQI 10 prepare owner-wallet-only',
    surface: 'POST /v1/vault/deposits/prepare',
    source: HELP_SOURCE,
    dispatchMode: 'help-only-no-dispatch',
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

const assertVaultPreparePlaceholder = (body, operation) => {
  assertEqual(body.source, 'owner-wallet-vault-operation-placeholder', `${operation} prepare source`);
  assertEqual(body.vaultOperation, operation, `${operation} prepare vaultOperation`);
  assertEqual(body.operationStatus, 'prepare-only-not-implemented', `${operation} prepare operationStatus`);
  assertSafePreparePermissions(body.permissions, `${operation} prepare`);
  assertEqual(body.realQuaiTransactions, false, `${operation} prepare realQuaiTransactions`);
  assertEqual(body.walletRequired, false, `${operation} prepare walletRequired`);
  assertEqual(body.fundsMoved, false, `${operation} prepare fundsMoved`);
  assertEqual(body.tradingVaultMutation, false, `${operation} prepare tradingVaultMutation`);
};

const setDatasetValue = (node, key, value) => {
  if (node?.dataset !== undefined) {
    node.dataset[key] = value;
  }
};

const surfaceLabel = ({ method, pathname }) => `${method} ${pathname}`;

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

const readJsonWithExpectedStatus = async ({ check, baseUrl, fetchImpl }) => {
  const url = buildUrl({ baseUrl, pathname: check.pathname });
  const headers = { accept: 'application/json' };
  const options = { method: check.method, headers };
  if (check.body !== undefined) {
    options.headers = { ...headers, 'content-type': 'application/json' };
    options.body = JSON.stringify(check.body);
  }

  const response = await fetchImpl(url.toString(), options);
  const body = await response.json();
  if (!check.expectedStatuses.includes(response.status)) {
    throw new Error(`${surfaceLabel(check)} expected HTTP ${check.expectedStatuses.join('/')} but received ${response.status}.`);
  }
  if (!isObject(body)) {
    throw new Error(`${surfaceLabel(check)} must return an object envelope.`);
  }

  check.validate(body);
  return { response, body };
};

const createSafetyEnvelope = () => ({
  source: SMOKE_SOURCE,
  keyboardShortcutHelpSource: HELP_SOURCE,
  mode: 'local-api-precheck-help-only',
  dispatchMode: 'help-only-no-dispatch',
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

export const fetchKeyboardShortcutHelpLocalApiSnapshot = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchKeyboardShortcutHelpLocalApiSnapshot requires a fetch implementation.');
  }

  const precheckedEntries = [];
  const surfaceLabels = [];
  const surfacesByKey = new Map();

  for (const check of PREFLIGHT_CHECKS) {
    const { response, body } = await readJsonWithExpectedStatus({ check, baseUrl, fetchImpl });
    const source = body.source ?? check.source;
    const surface = surfaceLabel(check);
    const entry = Object.freeze({
      key: check.key ?? null,
      command: check.command ?? null,
      label: check.label,
      method: check.method,
      pathname: check.pathname,
      surface,
      httpStatus: response.status,
      source,
      error: typeof body.error === 'string' ? body.error : null,
      dispatchMode: 'help-only-no-dispatch',
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      marketRegistryMutation: false,
      delegateKeyRegistryMutation: false,
      nonceManagerMutation: false,
      delegateCanWithdraw: body.delegateCanWithdraw ?? false,
      delegateCanAdmin: body.delegateCanAdmin ?? false,
    });

    surfaceLabels.push(surface);
    precheckedEntries.push([check.label, entry]);
    if (check.key !== undefined) {
      const existing = surfacesByKey.get(check.key) ?? [];
      existing.push(entry);
      surfacesByKey.set(check.key, existing);
    }
  }

  return Object.freeze({
    ...createSafetyEnvelope(),
    surfaces: Object.freeze(surfaceLabels),
    surfacesByKey: Object.freeze(Object.fromEntries(Array.from(surfacesByKey.entries()).map(([key, checks]) => [key, Object.freeze(checks)]))),
    precheckedSurfaces: Object.freeze(Object.fromEntries(precheckedEntries)),
    previewOnlyHints: Object.freeze(Object.fromEntries(PREVIEW_ONLY_HINTS.map((hint) => [
      hint.command,
      Object.freeze({ ...hint, permissions: [...SAFE_PERMISSIONS] }),
    ]))),
  });
};

const getStatusNode = (mount) => (typeof mount?.querySelector === 'function'
  ? mount.querySelector('[data-qdx-keyboard-shortcuts-status]')
  : null);

const statusLineForSurfaces = (surfaces = []) => surfaces
  .map((surface) => `${surface.surface} HTTP ${surface.httpStatus} ${surface.source}`)
  .join(' / ');

const createUnsupportedPreview = (key) => ({
  status: 'unsupported',
  key,
  label: 'unsupported',
  source: SMOKE_SOURCE,
  dispatchMode: 'help-only-no-dispatch',
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
});

const createMatchedPreview = ({ shortcut, surfaces }) => ({
  status: 'matched',
  key: shortcut.key,
  label: shortcut.label,
  source: SMOKE_SOURCE,
  shortcutSource: HELP_SOURCE,
  dispatchMode: 'help-only-no-dispatch',
  surfaces: surfaces.map((surface) => surface.surface),
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
});

const decorateInitialStatus = ({ mount, apiSnapshot }) => {
  const statusNode = getStatusNode(mount);
  if (statusNode !== null) {
    statusNode.dataset.qdxKeyboardShortcutLocalApiSmoke = 'verified-help-only';
    statusNode.textContent = `${SMOKE_SOURCE}: verified ${apiSnapshot.surfaces.length} local API surfaces; READ_ONLY/NO_WITHDRAW/NO_ADMIN; help-only-no-dispatch; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.`;
  }
};

const decorateHelpPreview = ({ mount, preview, surfaces }) => {
  const statusNode = getStatusNode(mount);

  if (preview.status !== 'matched') {
    setDatasetValue(mount, 'qdxKeyboardShortcutLocalApiPreview', 'unsupported');
    if (statusNode !== null) {
      statusNode.dataset.qdxKeyboardShortcutLocalApiSmoke = 'unsupported-help-only-preview';
      statusNode.textContent = `${SMOKE_SOURCE}: unsupported keyboard shortcut ${preview.key}; blocked-no-dispatch; READ_ONLY/NO_WITHDRAW/NO_ADMIN; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.`;
    }
    return;
  }

  const surfaceText = statusLineForSurfaces(surfaces);
  setDatasetValue(mount, 'qdxKeyboardShortcutLocalApiPreview', `${preview.key} ${preview.label}`);
  if (statusNode !== null) {
    statusNode.dataset.qdxKeyboardShortcutLocalApiSmoke = 'shortcut-help-only-preview';
    statusNode.textContent = `${SMOKE_SOURCE}: ${preview.key} ${preview.label} -> ${surfaceText}; READ_ONLY/NO_WITHDRAW/NO_ADMIN; help-only-no-dispatch; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.`;
  }
};

export const bindKeyboardShortcutHelpLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  keyboardShortcuts = createMockKeyboardShortcutHelpFixture(),
  onSmoke = noop,
  onHelpPreview = noop,
  onError = noop,
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.querySelector !== 'function') {
    throw new TypeError('bindKeyboardShortcutHelpLocalApiSmoke requires a mount with querySelector.');
  }

  let apiSnapshot;
  try {
    apiSnapshot = await fetchKeyboardShortcutHelpLocalApiSnapshot({ baseUrl, fetchImpl });
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    setDatasetValue(mount, 'qdxKeyboardShortcutLocalApiSmoke', 'error');
    onError(normalizedError);
    throw normalizedError;
  }

  const normalizedHelp = normalizeKeyboardShortcutHelpFixture(keyboardShortcuts);
  const shortcutsByKey = new Map(normalizedHelp.shortcuts.map((shortcut) => [shortcut.key, shortcut]));
  const keydownListener = (event) => {
    const key = String(event?.key ?? '');
    const shortcut = shortcutsByKey.get(key);
    const surfaces = apiSnapshot.surfacesByKey[key] ?? [];
    const preview = shortcut === undefined
      ? createUnsupportedPreview(key)
      : createMatchedPreview({ shortcut, surfaces });

    decorateHelpPreview({ mount, preview, surfaces });
    onHelpPreview(clone(preview), clone(apiSnapshot));
  };

  setDatasetValue(mount, 'qdxKeyboardShortcutLocalApiSmoke', SMOKE_SOURCE);
  setDatasetValue(mount, 'qdxKeyboardShortcutDispatchMode', 'help-only-no-dispatch');
  setDatasetValue(mount, 'qdxKeyboardShortcutPermissions', SAFE_PERMISSIONS.join(','));
  setDatasetValue(mount, 'qdxKeyboardShortcutLocalApiSurfaces', apiSnapshot.surfaces.join(','));
  decorateInitialStatus({ mount, apiSnapshot });
  onSmoke(clone(apiSnapshot));

  if (typeof mount.addEventListener === 'function') {
    mount.addEventListener('keydown', keydownListener);
  }

  return Object.freeze({
    apiSnapshot: clone(apiSnapshot),
    close() {
      if (typeof mount.removeEventListener === 'function') {
        mount.removeEventListener('keydown', keydownListener);
      }
    },
  });
};
