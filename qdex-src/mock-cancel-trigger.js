import { buildOrderSubmitUrl, createUiMockSignedOrder } from './mock-order-trigger.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const CUSTODY_NOTE = 'non-custodial-no-withdrawal-authority';
const NONCE_MANAGER_NOTE = 'matcher-local-cancel-only-on-chain-nonce-unchanged';
const CANCELLATION_MESSAGE = 'Mock cancellation removes only matcher-open quantity and does not cancel the on-chain nonce; user nonce cancellation must be signed through NonceManager later.';
const SAFE_CANCEL_PERMISSIONS = ['CANCEL_ORDER', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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

export const buildOrderCancelUrl = ({ baseUrl = DEFAULT_API_BASE_URL, orderHash }) => buildHttpApiUrl({
  baseUrl,
  pathname: `/v1/orders/${encodeURIComponent(orderHash)}`,
});

export const createMockCancelableOrder = (overrides = {}) => createUiMockSignedOrder({
  side: 'sell',
  type: 'limit',
  amount: '125',
  price: '5',
  timeInForce: 'GTC',
  maxSlippageBps: 0,
  nonce: '950',
  owner: '0x4444444444444444444444444444444444444444',
  clientOrderId: `terminal-ui-mock-cancel-${overrides.nonce ?? '950'}`,
  ...overrides,
});

const readJsonResponse = async (response, label) => {
  if (!isObject(response) || typeof response.json !== 'function') {
    throw new TypeError(`${label} requires a fetch Response-like object with json().`);
  }

  const body = await response.json();
  if (!response.ok) {
    const reason = isObject(body) && typeof body.error === 'string'
      ? body.error
      : `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${reason}`);
  }

  return body;
};

const postRestingOrder = async ({ baseUrl, order, fetchImpl }) => {
  const response = await fetchImpl(buildOrderSubmitUrl({ baseUrl }), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ order }),
  });

  const acceptedOrder = await readJsonResponse(response, 'POST /v1/orders cancel smoke');
  if (typeof acceptedOrder.orderHash !== 'string' || acceptedOrder.orderHash.length === 0) {
    throw new Error('mock cancel trigger expected POST /v1/orders to return orderHash.');
  }

  if (Array.isArray(acceptedOrder.fills) && acceptedOrder.fills.length > 0) {
    throw new Error('mock cancel trigger must create a resting order without fills or proof rows.');
  }

  if (acceptedOrder.custody !== CUSTODY_NOTE) {
    throw new Error('mock cancel trigger order must preserve non-custodial custody metadata.');
  }

  return acceptedOrder;
};

const deleteRestingOrder = async ({ baseUrl, orderHash, fetchImpl }) => {
  const response = await fetchImpl(buildOrderCancelUrl({ baseUrl, orderHash }), {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
    },
  });

  return readJsonResponse(response, `DELETE /v1/orders/${orderHash}`);
};

const assertCancelPermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw new Error('mock cancel trigger permissions must be an array.');
  }

  const missing = SAFE_CANCEL_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`unsafe mock cancel permissions: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}`);
  }
};

const requireMatcherLocalCancellation = (cancel) => {
  if (!isObject(cancel)) {
    throw new Error('mock cancel trigger expected a cancellation response object.');
  }

  if (cancel.cancelled !== true || cancel.cancelledCount !== 1) {
    throw new Error('mock cancel trigger expected exactly one matcher-local cancellation.');
  }

  if (cancel.source !== 'mock-matching-engine' || cancel.custody !== CUSTODY_NOTE) {
    throw new Error('mock cancel trigger cancellation must come from mock matcher without custody authority.');
  }

  if (cancel.nonceManager !== NONCE_MANAGER_NOTE) {
    throw new Error('mock cancel trigger must keep on-chain NonceManager nonce unchanged.');
  }

  assertCancelPermissions(cancel.permissions);

  if (typeof cancel.message !== 'string' || !/does not cancel the on-chain nonce/i.test(cancel.message)) {
    throw new Error('mock cancel trigger message must say matcher-local cancellation does not cancel the on-chain nonce.');
  }

  if (!Array.isArray(cancel.cancelledOrders) || cancel.cancelledOrders.length !== 1) {
    throw new Error('mock cancel trigger expected exactly one cancelled order projection.');
  }

  const [cancelledOrder] = cancel.cancelledOrders;
  if (!isObject(cancelledOrder)) {
    throw new Error('mock cancel trigger cancelledOrders[0] must be an object.');
  }

  if (cancelledOrder.status !== 'cancelled' || cancelledOrder.remainingAmount !== '0') {
    throw new Error('mock cancel trigger cancelled order must have zero remaining matcher-open quantity.');
  }

  if (cancelledOrder.nonceCancellation !== 'not-implied-matcher-local-only') {
    throw new Error('mock cancel trigger cancelled order must not imply on-chain nonce cancellation.');
  }

  if (Object.hasOwn(cancelledOrder, 'createdAt')) {
    throw new Error('mock cancel trigger order projection must not expose matcher-local createdAt.');
  }
};

export const submitAndCancelMockOrder = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  order = createMockCancelableOrder(),
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('submitAndCancelMockOrder requires a fetch implementation.');
  }

  const acceptedOrder = await postRestingOrder({ baseUrl, order, fetchImpl });
  const cancellation = await deleteRestingOrder({
    baseUrl,
    orderHash: acceptedOrder.orderHash,
    fetchImpl,
  });
  requireMatcherLocalCancellation(cancellation);

  return {
    order: clone(acceptedOrder),
    cancel: clone(cancellation),
    fills: [],
    custody: CUSTODY_NOTE,
    nonceManager: NONCE_MANAGER_NOTE,
    message: CANCELLATION_MESSAGE,
    safetyNotice: 'Mock UI cancellation only: no real Quai tx/explorer/funds moved; matcher-local cancellation does not cancel on-chain nonce.',
  };
};

const closestTrigger = (target) => {
  if (target === undefined || target === null) {
    return null;
  }

  if (typeof target.closest === 'function') {
    return target.closest('[data-qdx-trigger-cancel]');
  }

  if (typeof target.matches === 'function' && target.matches('[data-qdx-trigger-cancel]')) {
    return target;
  }

  return null;
};

const setStatus = (mount, text, state) => {
  const statusNode = typeof mount.querySelector === 'function'
    ? mount.querySelector('[data-qdx-cancel-status]')
    : null;

  if (statusNode !== null) {
    statusNode.textContent = text;
    if (statusNode.dataset !== undefined) {
      statusNode.dataset.qdxCancelStatus = state;
    }
  }
};

export const bindMockCancelTrigger = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  onCancel = () => {},
  onError = () => {},
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.addEventListener !== 'function') {
    throw new TypeError('bindMockCancelTrigger requires a mount node with addEventListener().');
  }

  const handleClick = async (event) => {
    const trigger = closestTrigger(event?.target);
    if (trigger === null) {
      return undefined;
    }

    event?.preventDefault?.();
    if (trigger.disabled) {
      return undefined;
    }

    trigger.disabled = true;
    if (mount.dataset !== undefined) {
      mount.dataset.qdxMockCancelTrigger = 'cancelling';
    }
    setStatus(
      mount,
      'creating resting mock order then matcher-local cancellation; no real Quai tx/explorer/funds and on-chain nonce stays unchanged.',
      'cancelling',
    );

    try {
      const result = await submitAndCancelMockOrder({ baseUrl, fetchImpl });
      if (mount.dataset !== undefined) {
        mount.dataset.qdxMockCancelTrigger = 'cancelled';
      }
      setStatus(
        mount,
        `matcher-local cancelled ${result.cancel.orderHash}; does not cancel on-chain nonce; no real Quai tx/explorer/funds moved.`,
        'cancelled',
      );
      onCancel(result);
      return result;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (mount.dataset !== undefined) {
        mount.dataset.qdxMockCancelTrigger = 'error';
      }
      setStatus(mount, `mock cancel trigger failed: ${normalizedError.message}`, 'error');
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
