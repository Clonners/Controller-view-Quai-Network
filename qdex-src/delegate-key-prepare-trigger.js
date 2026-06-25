import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const DELEGATE_KEY_SOURCE = 'delegate-key-owner-signed-prepare-boundary';
const DELEGATE_KEY_CUSTODY = 'non-custodial-no-withdrawal-authority';
const OPERATION_STATUS = 'prepare-only-owner-signed-required';
const OWNER_AUTHORIZATION = 'owner-wallet-signature-required';
const DELEGATE_AUTHORITY = 'trade-only-no-withdraw-no-admin';
const SAFE_PERMISSIONS = ['NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const REQUIRED_FIELDS = ['delegate', 'expiresAt', 'allowedMarkets', 'maxNotional', 'permissions'];
const DEFAULT_KEY_ID = 'bot-mm-1';

const OPERATION_CONFIG = Object.freeze({
  register: Object.freeze({
    method: 'POST',
    pathname: '/v1/delegate-keys',
    operation: 'register_delegate_key',
    error: 'delegate_key_registration_not_implemented',
    triggerSelector: '[data-qdx-delegate-key-prepare-register]',
    statusSelector: '[data-qdx-delegate-key-register-status]',
    statusDatasetKey: 'qdxDelegateKeyRegisterStatus',
    statusLabel: 'register delegate/API key',
  }),
  revoke: Object.freeze({
    method: 'DELETE',
    pathname: '/v1/delegate-keys/:keyId',
    operation: 'revoke_delegate_key',
    error: 'delegate_key_revocation_not_implemented',
    triggerSelector: '[data-qdx-delegate-key-prepare-revoke]',
    statusSelector: '[data-qdx-delegate-key-revoke-status]',
    statusDatasetKey: 'qdxDelegateKeyRevokeStatus',
    statusLabel: 'revoke delegate/API key',
  }),
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const noop = () => {};

const normalizeOperation = (operation) => {
  if (operation === 'create-key' || operation === 'register_delegate_key') {
    return 'register';
  }

  if (operation === 'revoke-key' || operation === 'revoke_delegate_key') {
    return 'revoke';
  }

  if (!Object.hasOwn(OPERATION_CONFIG, operation)) {
    throw new Error(`unsupported delegate key prepare operation: ${operation}`);
  }

  return operation;
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

const assertArrayIncludesAll = (actual, expected, label) => {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} must be an array.`);
  }

  const missing = expected.filter((value) => !actual.includes(value));
  if (missing.length > 0) {
    throw new Error(`${label} missing ${missing.join(', ')}.`);
  }
};

const assertSafePermissions = (permissions, operation) => {
  assertArrayIncludesAll(permissions, SAFE_PERMISSIONS, 'delegate key prepare permissions');
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));
  if (forbidden.length > 0) {
    throw new Error(`unsafe delegate key prepare permissions for ${operation}: ${forbidden.join(', ')}`);
  }

  if (operation === 'register' && !permissions.includes('PLACE_ORDER')) {
    throw new Error('delegate key registration prepare permissions must include PLACE_ORDER.');
  }
};

const requireDelegateKeyPrepareEnvelope = (body, operation, keyId = DEFAULT_KEY_ID) => {
  const normalizedOperation = normalizeOperation(operation);
  const config = OPERATION_CONFIG[normalizedOperation];

  assertObject(body, 'delegate key prepare response');
  assertEqual(body.error, config.error, 'delegate key prepare error');
  assertEqual(body.source, DELEGATE_KEY_SOURCE, 'delegate key prepare source');
  assertEqual(body.custody, DELEGATE_KEY_CUSTODY, 'delegate key prepare custody');
  assertEqual(body.operation, config.operation, 'delegate key prepare operation');
  assertEqual(body.operationStatus, OPERATION_STATUS, 'delegate key prepare operationStatus');
  assertEqual(body.ownerAuthorization, OWNER_AUTHORIZATION, 'delegate key prepare ownerAuthorization');
  assertEqual(body.delegateAuthority, DELEGATE_AUTHORITY, 'delegate key prepare delegateAuthority');
  assertEqual(body.delegateCanWithdraw, false, 'delegate key prepare delegateCanWithdraw');
  assertEqual(body.delegateCanAdmin, false, 'delegate key prepare delegateCanAdmin');
  assertEqual(body.realQuaiTransactions, false, 'delegate key prepare realQuaiTransactions');
  assertEqual(body.walletRequired, false, 'delegate key prepare walletRequired');
  assertEqual(body.fundsMoved, false, 'delegate key prepare fundsMoved');
  assertEqual(body.tradingVaultMutation, false, 'delegate key prepare tradingVaultMutation');
  assertEqual(
    body.approvalGate,
    'explicit-approval-required-before-owner-wallet-signing-or-live-registry-mutation',
    'delegate key prepare approvalGate',
  );
  assertArrayIncludesAll(body.requiredFields, REQUIRED_FIELDS, 'delegate key prepare requiredFields');
  assertSafePermissions(body.permissions, normalizedOperation);

  if (normalizedOperation === 'revoke') {
    assertEqual(body.keyId, keyId, 'delegate key revoke keyId');
  }

  if (typeof body.message !== 'string' || !/not wired to wallet loading, signing, broadcast, deploy, transaction helpers, live DelegateKeyRegistry mutation, TradingVault mutation, or funds movement/i.test(body.message)) {
    throw new Error('delegate key prepare message must preserve no-wallet/no-registry-mutation/no-funds wording.');
  }

  return clone(body);
};

const buildHttpApiUrl = ({ baseUrl = DEFAULT_API_BASE_URL, pathname }) => {
  const url = new URL(baseUrl);
  if (url.protocol === 'wss:') {
    url.protocol = 'https:';
  } else if (url.protocol === 'ws:') {
    url.protocol = 'http:';
  }
  url.pathname = pathname;
  url.search = '';
  return url.toString();
};

export const buildDelegateKeyPrepareUrl = ({
  baseUrl = DEFAULT_API_BASE_URL,
  operation,
  keyId = DEFAULT_KEY_ID,
} = {}) => {
  const normalizedOperation = normalizeOperation(operation);
  const pathname = OPERATION_CONFIG[normalizedOperation].pathname.replace(':keyId', encodeURIComponent(keyId));
  return buildHttpApiUrl({ baseUrl, pathname });
};

export const createDefaultDelegateKeyPrepareRequest = (operation, { keyId = DEFAULT_KEY_ID } = {}) => {
  const normalizedOperation = normalizeOperation(operation);
  const base = {
    keyId,
    owner: '0x1111111111111111111111111111111111111111',
    requestMode: 'prepare-only-owner-signed-delegate-key-boundary',
    ownerAuthorizationRef: 'owner-wallet-signature-required-not-created',
  };

  if (normalizedOperation === 'revoke') {
    return base;
  }

  return {
    ...base,
    delegate: '0x3333333333333333333333333333333333333333',
    allowedMarkets: ['WQUAI-WQI'],
    maxNotional: '1000',
    permissions: ['PLACE_ORDER', 'CANCEL_ORDER', 'CANCEL_ALL', 'NO_WITHDRAW', 'NO_ADMIN'],
    expiresAt: 1780003600,
  };
};

export const prepareDelegateKeyOperation = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  operation,
  keyId = DEFAULT_KEY_ID,
  request = createDefaultDelegateKeyPrepareRequest(operation, { keyId }),
  fetchImpl = globalThis.fetch,
} = {}) => {
  const normalizedOperation = normalizeOperation(operation);
  const config = OPERATION_CONFIG[normalizedOperation];
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('prepareDelegateKeyOperation requires a fetch implementation.');
  }

  const response = await fetchImpl(buildDelegateKeyPrepareUrl({ baseUrl, operation: normalizedOperation, keyId }), {
    method: config.method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!isObject(response) || typeof response.json !== 'function') {
    throw new TypeError('prepareDelegateKeyOperation requires a fetch Response-like object with json().');
  }

  const body = await response.json();
  if (response.status !== 501) {
    const reason = isObject(body) && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    const expectedPath = config.pathname.replace(':keyId', encodeURIComponent(keyId));
    throw new Error(`${config.method} ${expectedPath} expected prepare-only HTTP 501 boundary response, got ${reason}.`);
  }

  return {
    httpStatus: response.status,
    body: requireDelegateKeyPrepareEnvelope(body, normalizedOperation, keyId),
  };
};

export const createDelegateKeyOperationFixture = ({ baseFixture = mockVerticalSliceFixture, prepareResult }) => {
  assertObject(prepareResult, 'delegate key prepare result');
  assertObject(prepareResult.body, 'delegate key prepare result body');

  return {
    ...clone(baseFixture),
    delegateKeyOperation: {
      httpStatus: prepareResult.httpStatus,
      ...clone(prepareResult.body),
    },
  };
};

const closestDelegateKeyPrepareTrigger = (target) => {
  if (target === undefined || target === null) {
    return null;
  }

  for (const [operation, config] of Object.entries(OPERATION_CONFIG)) {
    if (typeof target.closest === 'function') {
      const trigger = target.closest(config.triggerSelector);
      if (trigger !== null) {
        return { operation, trigger };
      }
    }

    if (typeof target.matches === 'function' && target.matches(config.triggerSelector)) {
      return { operation, trigger: target };
    }
  }

  return null;
};

const setStatus = (mount, operation, text, state) => {
  const config = OPERATION_CONFIG[operation];
  const statusNode = typeof mount.querySelector === 'function'
    ? mount.querySelector(config.statusSelector)
    : null;

  if (statusNode !== null) {
    statusNode.textContent = text;
    if (statusNode.dataset !== undefined) {
      statusNode.dataset[config.statusDatasetKey] = state;
    }
  }
};

export const bindDelegateKeyPrepareTrigger = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onPrepare = noop,
  onError = noop,
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.addEventListener !== 'function') {
    throw new TypeError('bindDelegateKeyPrepareTrigger requires a mount node with addEventListener().');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindDelegateKeyPrepareTrigger requires a render function.');
  }

  const handleClick = async (event) => {
    const match = closestDelegateKeyPrepareTrigger(event?.target);
    if (match === null) {
      return undefined;
    }

    const { operation, trigger } = match;
    const config = OPERATION_CONFIG[operation];
    event?.preventDefault?.();
    if (trigger.disabled) {
      return undefined;
    }

    trigger.disabled = true;
    if (mount.dataset !== undefined) {
      mount.dataset.qdxDelegateKeyPrepareTrigger = `${operation}-preparing`;
    }
    setStatus(
      mount,
      operation,
      `requesting ${config.statusLabel} prepare-only boundary; owner-wallet-signature-required; NO_WITHDRAW/NO_ADMIN; no wallet/RPC/signing/broadcast/deploy/tx/funds.`,
      'preparing',
    );

    try {
      const prepareResult = await prepareDelegateKeyOperation({
        baseUrl,
        operation,
        keyId: DEFAULT_KEY_ID,
        request: createDefaultDelegateKeyPrepareRequest(operation, { keyId: DEFAULT_KEY_ID }),
        fetchImpl,
      });
      const fixture = createDelegateKeyOperationFixture({ baseFixture, prepareResult });
      mount.innerHTML = render(fixture);

      if (mount.dataset !== undefined) {
        mount.dataset.qdxDelegateKeyPrepareTrigger = `${operation}-prepare-only`;
      }
      setStatus(
        mount,
        operation,
        `${config.statusLabel} prepare-only boundary returned HTTP ${prepareResult.httpStatus}; owner-wallet-signature-required; NO_WITHDRAW/NO_ADMIN; no wallet/RPC/signing/broadcast/deploy/tx/funds.`,
        'prepare-only',
      );
      onPrepare(prepareResult, fixture);
      return prepareResult;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (mount.dataset !== undefined) {
        mount.dataset.qdxDelegateKeyPrepareTrigger = 'error';
      }
      setStatus(mount, operation, `delegate/API key ${config.statusLabel} prepare failed: ${normalizedError.message}`, 'error');
      onError(normalizedError);
      return undefined;
    } finally {
      trigger.disabled = false;
    }
  };

  mount.addEventListener('click', handleClick);

  return {
    close() {
      if (typeof mount.removeEventListener === 'function') {
        mount.removeEventListener('click', handleClick);
      }
    },
  };
};
