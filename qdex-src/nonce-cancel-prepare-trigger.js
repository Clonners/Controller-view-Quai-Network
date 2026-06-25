import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const NONCE_CANCEL_SOURCE = 'owner-signed-nonce-cancel-placeholder';
const NONCE_CANCEL_CUSTODY = 'non-custodial';
const NONCE_MANAGER = 'owner-signed-required';
const SAFE_PERMISSIONS = ['NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const APPROVAL_GATE = 'explicit-approval-required-before-wallet-signing-or-quai-broadcast';

const OPERATION_CONFIG = Object.freeze({
  cancelNonce: Object.freeze({
    pathname: '/v1/nonces/cancel',
    triggerSelector: '[data-qdx-nonce-cancel-prepare]',
    statusSelector: '[data-qdx-nonce-cancel-status]',
    statusDatasetKey: 'qdxNonceCancelStatus',
    statusLabel: 'cancel nonce',
    action: 'cancelNonce',
  }),
  cancelNonceRange: Object.freeze({
    pathname: '/v1/nonces/cancel',
    triggerSelector: '[data-qdx-nonce-cancel-range-prepare]',
    statusSelector: '[data-qdx-nonce-cancel-range-status]',
    statusDatasetKey: 'qdxNonceCancelRangeStatus',
    statusLabel: 'cancel nonce range',
    action: 'cancelNonceRange',
  }),
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const noop = () => {};

const normalizeOperation = (operation) => {
  if (operation === 'cancelNonce' || operation === 'cancel-nonce') {
    return 'cancelNonce';
  }

  if (operation === 'cancelNonceRange' || operation === 'cancel-nonce-range') {
    return 'cancelNonceRange';
  }

  if (!Object.hasOwn(OPERATION_CONFIG, operation)) {
    throw new Error(`unsupported nonce cancel prepare operation: ${operation}`);
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

const assertSafePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw new Error('nonce cancel prepare permissions must be an array.');
  }

  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`unsafe nonce cancel prepare permissions: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}`);
  }
};

const requireNonceCancelPrepareEnvelope = (body, operation) => {
  const normalizedOperation = normalizeOperation(operation);
  const config = OPERATION_CONFIG[normalizedOperation];

  assertObject(body, 'nonce cancel prepare response');
  assertEqual(body.error, 'owner_signed_nonce_cancel_not_implemented', 'nonce cancel prepare error');
  assertEqual(body.source, NONCE_CANCEL_SOURCE, 'nonce cancel prepare source');
  assertEqual(body.custody, NONCE_CANCEL_CUSTODY, 'nonce cancel prepare custody');
  assertEqual(body.nonceManager, NONCE_MANAGER, 'nonce cancel prepare nonceManager');
  assertEqual(body.realQuaiTransactions, false, 'nonce cancel prepare realQuaiTransactions');
  assertEqual(body.walletRequired, false, 'nonce cancel prepare walletRequired');
  assertEqual(body.approvalGate, APPROVAL_GATE, 'nonce cancel prepare approvalGate');
  assertSafePermissions(body.permissions);

  if (typeof body.message !== 'string' || !/does not mutate on-chain NonceManager nonces/i.test(body.message)) {
    throw new Error('nonce cancel prepare message must preserve matcher-local cancellation wording.');
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

export const buildNonceCancelPrepareUrl = ({ baseUrl = DEFAULT_API_BASE_URL } = {}) => {
  return buildHttpApiUrl({ baseUrl, pathname: OPERATION_CONFIG.cancelNonce.pathname });
};

export const createDefaultNonceCancelRequest = (operation) => {
  const normalizedOperation = normalizeOperation(operation);
  const config = OPERATION_CONFIG[normalizedOperation];

  const base = {
    owner: '0x1111111111111111111111111111111111111111',
    chainId: 0,
    nonceManagerContract: 'local-only-not-deployed',
    expiresAt: 1780003600,
    signature: '0xmock-signature-not-real',
    requestMode: 'prepare-only-owner-signed-boundary',
  };

  if (normalizedOperation === 'cancelNonce') {
    return { ...base, action: config.action, nonce: '42', nonceRange: null };
  }

  return {
    ...base,
    action: config.action,
    nonce: null,
    nonceRange: { from: '40', to: '50' },
  };
};

export const prepareNonceCancel = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  operation = 'cancelNonce',
  request = createDefaultNonceCancelRequest(operation),
  fetchImpl = globalThis.fetch,
} = {}) => {
  const normalizedOperation = normalizeOperation(operation);
  const config = OPERATION_CONFIG[normalizedOperation];

  if (typeof fetchImpl !== 'function') {
    throw new TypeError('prepareNonceCancel requires a fetch implementation.');
  }

  const response = await fetchImpl(buildHttpApiUrl({ baseUrl, pathname: config.pathname }), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!isObject(response) || typeof response.json !== 'function') {
    throw new TypeError('prepareNonceCancel requires a fetch Response-like object with json().');
  }

  const body = await response.json();
  if (response.status !== 501) {
    const reason = isObject(body) && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(`POST ${config.pathname} expected prepare-only HTTP 501 boundary response, got ${reason}.`);
  }

  return {
    httpStatus: response.status,
    body: requireNonceCancelPrepareEnvelope(body, normalizedOperation),
  };
};

export const createNonceCancelOperationFixture = ({ baseFixture = mockVerticalSliceFixture, prepareResult }) => {
  assertObject(prepareResult, 'nonce cancel prepare result');
  assertObject(prepareResult.body, 'nonce cancel prepare result body');

  return {
    ...clone(baseFixture),
    nonceCancelOperation: {
      httpStatus: prepareResult.httpStatus,
      ...clone(prepareResult.body),
    },
  };
};

const closestNonceCancelPrepareTrigger = (target) => {
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

export const bindNonceCancelPrepareTrigger = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onPrepare = noop,
  onError = noop,
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.addEventListener !== 'function') {
    throw new TypeError('bindNonceCancelPrepareTrigger requires a mount node with addEventListener().');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindNonceCancelPrepareTrigger requires a render function.');
  }

  const handleClick = async (event) => {
    const match = closestNonceCancelPrepareTrigger(event?.target);
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
      mount.dataset.qdxNonceCancelPrepareTrigger = `${operation}-preparing`;
    }
    setStatus(
      mount,
      operation,
      `requesting ${config.statusLabel} prepare-only boundary; owner-signed-required; NO_WITHDRAW/NO_ADMIN; no wallet/RPC/signing/broadcast/deploy/tx/funds.`,
      'preparing',
    );

    try {
      const prepareResult = await prepareNonceCancel({
        baseUrl,
        operation,
        request: createDefaultNonceCancelRequest(operation),
        fetchImpl,
      });
      const fixture = createNonceCancelOperationFixture({ baseFixture, prepareResult });
      mount.innerHTML = render(fixture);

      if (mount.dataset !== undefined) {
        mount.dataset.qdxNonceCancelPrepareTrigger = `${operation}-prepare-only`;
      }
      setStatus(
        mount,
        operation,
        `${config.statusLabel} prepare-only boundary returned HTTP ${prepareResult.httpStatus}; owner-signed-required; NO_WITHDRAW/NO_ADMIN; no wallet/RPC/signing/broadcast/deploy/tx/funds.`,
        'prepare-only',
      );
      onPrepare(prepareResult, fixture);
      return prepareResult;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (mount.dataset !== undefined) {
        mount.dataset.qdxNonceCancelPrepareTrigger = 'error';
      }
      setStatus(mount, operation, `nonce cancel ${config.statusLabel} prepare failed: ${normalizedError.message}`, 'error');
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
