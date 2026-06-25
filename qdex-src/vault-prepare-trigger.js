import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const VAULT_SOURCE = 'owner-wallet-vault-operation-placeholder';
const VAULT_CUSTODY = 'non-custodial-contract-vault';
const SAFE_PERMISSIONS = ['NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const OWNER_AUTHORIZATION = 'owner-wallet-required';
const DELEGATE_AUTHORITY = 'delegates-cannot-deposit-or-withdraw';
const OPERATION_STATUS = 'prepare-only-not-implemented';

const OPERATION_CONFIG = Object.freeze({
  deposit: Object.freeze({
    pathname: '/v1/vault/deposits/prepare',
    triggerSelector: '[data-qdx-vault-prepare-deposit]',
    statusSelector: '[data-qdx-vault-deposit-status]',
    statusDatasetKey: 'qdxVaultDepositStatus',
    defaultAssetSymbol: 'WQI',
    defaultAmount: '10',
    statusLabel: 'deposit',
  }),
  withdrawal: Object.freeze({
    pathname: '/v1/vault/withdrawals/prepare',
    triggerSelector: '[data-qdx-vault-prepare-withdraw]',
    statusSelector: '[data-qdx-vault-withdraw-status]',
    statusDatasetKey: 'qdxVaultWithdrawStatus',
    defaultAssetSymbol: 'WQUAI',
    defaultAmount: '1',
    statusLabel: 'withdrawal',
  }),
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const noop = () => {};

const normalizeOperation = (operation) => {
  if (operation === 'withdraw') {
    return 'withdrawal';
  }

  if (!Object.hasOwn(OPERATION_CONFIG, operation)) {
    throw new Error(`unsupported vault prepare operation: ${operation}`);
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
    throw new Error('vault prepare permissions must be an array.');
  }

  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`unsafe vault prepare permissions: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}`);
  }
};

const requireVaultPrepareEnvelope = (body, operation) => {
  const normalizedOperation = normalizeOperation(operation);
  assertObject(body, 'vault prepare response');
  assertEqual(body.error, `owner_wallet_vault_${normalizedOperation}_not_implemented`, 'vault prepare error');
  assertEqual(body.source, VAULT_SOURCE, 'vault prepare source');
  assertEqual(body.custody, VAULT_CUSTODY, 'vault prepare custody');
  assertEqual(body.vaultOperation, normalizedOperation, 'vault prepare operation');
  assertEqual(body.operationStatus, OPERATION_STATUS, 'vault prepare operationStatus');
  assertEqual(body.ownerAuthorization, OWNER_AUTHORIZATION, 'vault prepare ownerAuthorization');
  assertEqual(body.delegateAuthority, DELEGATE_AUTHORITY, 'vault prepare delegateAuthority');
  assertEqual(body.realQuaiTransactions, false, 'vault prepare realQuaiTransactions');
  assertEqual(body.walletRequired, false, 'vault prepare walletRequired');
  assertEqual(body.fundsMoved, false, 'vault prepare fundsMoved');
  assertEqual(body.tradingVaultMutation, false, 'vault prepare tradingVaultMutation');
  assertEqual(body.approvalGate, 'explicit-approval-required-before-wallet-signing-or-quai-broadcast', 'vault prepare approvalGate');
  assertSafePermissions(body.permissions);

  assertObject(body.safety, 'vault prepare safety');
  for (const flag of [
    'noWalletLoading',
    'noRpcUrlAccess',
    'noSigning',
    'noBroadcast',
    'noDeploys',
    'noTransactionSubmission',
    'noFundsMovement',
    'noDelegateWithdrawalAuthority',
    'noAdminWithdrawalAuthority',
  ]) {
    assertEqual(body.safety[flag], true, `vault prepare safety.${flag}`);
  }

  if (typeof body.safety.notice !== 'string' || !/no wallet is loaded/i.test(body.safety.notice)) {
    throw new Error('vault prepare safety notice must state no wallet is loaded.');
  }

  if (typeof body.message !== 'string' || !/prepare-only endpoint does not load wallets/i.test(body.message)) {
    throw new Error('vault prepare message must preserve prepare-only no-wallet wording.');
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

export const buildVaultPrepareUrl = ({ baseUrl = DEFAULT_API_BASE_URL, operation }) => {
  const normalizedOperation = normalizeOperation(operation);
  return buildHttpApiUrl({ baseUrl, pathname: OPERATION_CONFIG[normalizedOperation].pathname });
};

export const createDefaultVaultPrepareRequest = (operation) => {
  const normalizedOperation = normalizeOperation(operation);
  const config = OPERATION_CONFIG[normalizedOperation];

  return {
    owner: '0x1111111111111111111111111111111111111111',
    assetSymbol: config.defaultAssetSymbol,
    amount: config.defaultAmount,
    chainId: 0,
    vaultContractRef: 'local-only-not-deployed',
    requestMode: 'prepare-only-owner-wallet-boundary',
  };
};

export const prepareVaultOperation = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  operation,
  request = createDefaultVaultPrepareRequest(operation),
  fetchImpl = globalThis.fetch,
} = {}) => {
  const normalizedOperation = normalizeOperation(operation);
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('prepareVaultOperation requires a fetch implementation.');
  }

  const response = await fetchImpl(buildVaultPrepareUrl({ baseUrl, operation: normalizedOperation }), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!isObject(response) || typeof response.json !== 'function') {
    throw new TypeError('prepareVaultOperation requires a fetch Response-like object with json().');
  }

  const body = await response.json();
  if (response.status !== 501) {
    const reason = isObject(body) && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(`POST ${OPERATION_CONFIG[normalizedOperation].pathname} expected prepare-only HTTP 501 boundary response, got ${reason}.`);
  }

  return {
    httpStatus: response.status,
    body: requireVaultPrepareEnvelope(body, normalizedOperation),
  };
};

export const createVaultOperationFixture = ({ baseFixture = mockVerticalSliceFixture, prepareResult }) => {
  assertObject(prepareResult, 'vault prepare result');
  assertObject(prepareResult.body, 'vault prepare result body');

  return {
    ...clone(baseFixture),
    vaultOperation: {
      httpStatus: prepareResult.httpStatus,
      ...clone(prepareResult.body),
    },
  };
};

const closestVaultPrepareTrigger = (target) => {
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

export const bindVaultPrepareTrigger = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onPrepare = noop,
  onError = noop,
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.addEventListener !== 'function') {
    throw new TypeError('bindVaultPrepareTrigger requires a mount node with addEventListener().');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindVaultPrepareTrigger requires a render function.');
  }

  const handleClick = async (event) => {
    const match = closestVaultPrepareTrigger(event?.target);
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
      mount.dataset.qdxVaultPrepareTrigger = `${operation}-preparing`;
    }
    setStatus(
      mount,
      operation,
      `requesting ${config.statusLabel} prepare-only boundary; no wallet/RPC/signing/broadcast/deploy/tx/funds.`,
      'preparing',
    );

    try {
      const prepareResult = await prepareVaultOperation({
        baseUrl,
        operation,
        request: createDefaultVaultPrepareRequest(operation),
        fetchImpl,
      });
      const fixture = createVaultOperationFixture({ baseFixture, prepareResult });
      mount.innerHTML = render(fixture);

      if (mount.dataset !== undefined) {
        mount.dataset.qdxVaultPrepareTrigger = `${operation}-prepare-only`;
      }
      setStatus(
        mount,
        operation,
        `${config.statusLabel} prepare-only boundary returned HTTP ${prepareResult.httpStatus}; no wallet/RPC/signing/broadcast/deploy/tx/funds.`,
        'prepare-only',
      );
      onPrepare(prepareResult, fixture);
      return prepareResult;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (mount.dataset !== undefined) {
        mount.dataset.qdxVaultPrepareTrigger = 'error';
      }
      setStatus(mount, operation, `vault ${config.statusLabel} prepare failed: ${normalizedError.message}`, 'error');
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
