import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { normalizeOpenOrdersPanelFixture } from './open-orders-panel.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const ORDER_SOURCE = 'mock-order-projection';
const ORDER_PROJECTION = 'LocalOrderProjection';
const ORDER_CUSTODY = 'non-custodial-no-withdrawal-authority';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];

const noop = () => {};
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
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

const assertFalse = (actual, label) => {
  if (actual !== false) {
    throw new Error(`${label} must be false.`);
  }
};

const assertTrue = (actual, label) => {
  if (actual !== true) {
    throw new Error(`${label} must be true.`);
  }
};

const assertSafePermissions = (permissions, label) => {
  if (!Array.isArray(permissions)) {
    throw new Error(`${label}: permissions must be an array.`);
  }

  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));

  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`${label}: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}`);
  }
};

const assertProjectionRows = (rows, label) => {
  if (!Array.isArray(rows)) {
    throw new Error(`${label} must be an array.`);
  }
};

export const normalizeOpenOrdersApiEnvelope = (openOrders) => {
  assertObject(openOrders, 'open orders envelope');
  assertEqual(openOrders.source, ORDER_SOURCE, 'open orders source');
  assertEqual(openOrders.projectionType, ORDER_PROJECTION, 'open orders projectionType');
  assertEqual(openOrders.custody, ORDER_CUSTODY, 'open orders custody');
  assertSafePermissions(openOrders.permissions, 'open orders permissions');
  assertTrue(openOrders.matcherLocalOnly, 'open orders matcherLocalOnly');
  assertEqual(openOrders.settlementMode, 'mock', 'open orders settlementMode');
  assertFalse(openOrders.realQuaiTransactions, 'open orders realQuaiTransactions');
  assertFalse(openOrders.walletRequired, 'open orders walletRequired');
  assertFalse(openOrders.fundsMoved, 'open orders fundsMoved');
  assertFalse(openOrders.tradingVaultMutation, 'open orders tradingVaultMutation');
  assertProjectionRows(openOrders.orders, 'open orders orders');

  return normalizeOpenOrdersPanelFixture(openOrders);
};

export const fetchOpenOrdersApiEnvelope = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchOpenOrdersApiEnvelope requires a fetch implementation.');
  }

  const response = await fetchImpl(new URL('/v1/account/orders', baseUrl).toString());
  if (!response.ok) {
    throw new Error(`GET /v1/account/orders failed with HTTP ${response.status}.`);
  }

  return normalizeOpenOrdersApiEnvelope(await response.json());
};

const openOrderCount = (openOrders) => openOrders.orders.length;

export const bindOpenOrdersLocalApiSmoke = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onOrders = noop,
  onError = noop,
} = {}) => {
  try {
    const openOrders = await fetchOpenOrdersApiEnvelope({ baseUrl, fetchImpl });
    const fixture = {
      ...baseFixture,
      openOrders,
    };

    setDatasetValue(mount, 'qdxFillOrdersSmoke', openOrders.source);
    setDatasetValue(mount, 'qdxFillOrdersProjection', openOrders.projectionType);
    setDatasetValue(mount, 'qdxFillOrdersCount', String(openOrderCount(openOrders)));

    if (mount !== undefined && mount !== null) {
      mount.innerHTML = render(fixture);
    }

    onOrders(openOrders, fixture);

    return {
      openOrders: clone(openOrders),
      close() {},
    };
  } catch (error) {
    setDatasetValue(mount, 'qdxFillOrdersSmoke', 'error');
    onError(error);
    throw error;
  }
};
