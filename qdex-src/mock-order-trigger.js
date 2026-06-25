const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const MARKET_ID = 'WQUAI-WQI';
const ZERO_DELEGATE = '0x0000000000000000000000000000000000000000';
const SETTLEMENT_CONTRACT = '0x2222222222222222222222222222222222222222';
const CUSTODY_NOTE = 'non-custodial-no-withdrawal-authority';
const PROOF_SOURCE = 'proof-service-indexer-projection';
const MOCK_PROOF_SAFETY_NOTICE = 'Mock proof only: no real Quai transaction, no explorer URL, no funds moved.';

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

export const buildOrderSubmitUrl = ({ baseUrl = DEFAULT_API_BASE_URL } = {}) => buildHttpApiUrl({
  baseUrl,
  pathname: '/v1/orders',
});

export const buildTradeProofUrl = ({ baseUrl = DEFAULT_API_BASE_URL, tradeId }) => buildHttpApiUrl({
  baseUrl,
  pathname: `/v1/proofs/trades/${encodeURIComponent(tradeId)}`,
});

export const createUiMockSignedOrder = (overrides = {}) => {
  const owner = overrides.owner ?? '0x1111111111111111111111111111111111111111';
  const nonce = overrides.nonce ?? '901';

  return {
    marketId: MARKET_ID,
    side: 'sell',
    type: 'limit',
    baseToken: 'mock:WQUAI',
    quoteToken: 'mock:WQI',
    amount: '100',
    price: '5',
    timeInForce: 'GTC',
    maxSlippageBps: 0,
    owner,
    delegate: ZERO_DELEGATE,
    nonce,
    expiresAt: 1780003600,
    chainId: 0,
    settlementContract: SETTLEMENT_CONTRACT,
    clientOrderId: `terminal-ui-mock-order-${nonce}`,
    signature: {
      scheme: 'mock',
      signer: owner,
      value: `0xterminal-ui-mock-${nonce}`,
      signedAt: 1780000000,
    },
    ...overrides,
    signature: {
      scheme: 'mock',
      signer: owner,
      value: `0xterminal-ui-mock-${nonce}`,
      signedAt: 1780000000,
      ...(overrides.signature ?? {}),
    },
  };
};

export const createMockCrossOrders = () => ({
  restingSell: createUiMockSignedOrder({
    side: 'sell',
    type: 'limit',
    amount: '100',
    price: '5',
    timeInForce: 'GTC',
    maxSlippageBps: 0,
    nonce: '901',
    owner: '0x1111111111111111111111111111111111111111',
  }),
  crossingBuy: createUiMockSignedOrder({
    side: 'buy',
    type: 'market_ioc',
    amount: '100',
    price: '6',
    timeInForce: 'IOC',
    maxSlippageBps: 50,
    nonce: '902',
    owner: '0x3333333333333333333333333333333333333333',
  }),
});

const readJsonResponse = async (response, label) => {
  if (!isObject(response) || typeof response.json !== 'function') {
    throw new TypeError(`${label} requires a fetch Response-like object with json().`);
  }

  const body = await response.json();
  if (!response.ok) {
    const reason = isObject(body) && typeof body.reason === 'string' ? body.reason : `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${reason}`);
  }

  return body;
};

const postOrder = async ({ baseUrl, order, fetchImpl }) => {
  const url = buildOrderSubmitUrl({ baseUrl });
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ order }),
  });

  return readJsonResponse(response, `POST /v1/orders ${order.side}`);
};

const fetchProofEnvelope = async ({ baseUrl, tradeId, fetchImpl }) => {
  const url = buildTradeProofUrl({ baseUrl, tradeId });
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  return readJsonResponse(response, `GET /v1/proofs/trades/${tradeId}`);
};

const requireConfirmedMockFill = (fill) => {
  if (!isObject(fill)) {
    throw new Error('mock order trigger expected a fill object from the crossing order.');
  }

  for (const field of ['fillId', 'tradeId', 'marketId', 'price', 'amount', 'settlementMode', 'settlementStatus', 'sourceEventId']) {
    if (fill[field] === undefined || fill[field] === null || fill[field] === '') {
      throw new Error(`mock order trigger fill is missing ${field}.`);
    }
  }

  if (fill.settlementMode !== 'mock' || fill.settlementStatus !== 'confirmed') {
    throw new Error('mock order trigger must only surface confirmed mock settlement fills.');
  }

  if (Object.hasOwn(fill, 'createdAt')) {
    throw new Error('mock order trigger fill must be adapter-shaped and must not expose matcher-local createdAt.');
  }
};

const requireMockProofEnvelope = (proofEnvelope, fill) => {
  if (!isObject(proofEnvelope) || !isObject(proofEnvelope.proof)) {
    throw new Error('mock order trigger expected a proof-service envelope.');
  }

  if (proofEnvelope.source !== PROOF_SOURCE || proofEnvelope.custody !== CUSTODY_NOTE) {
    throw new Error('mock order trigger proof must come from proof-service/indexer projection without custody authority.');
  }

  const { proof } = proofEnvelope;
  if (proof.tradeId !== fill.tradeId || proof.fillId !== fill.fillId || proof.createdFromEventId !== fill.sourceEventId) {
    throw new Error('mock order trigger proof must match the created adapter-shaped fill.');
  }

  if (proof.settlementMode !== 'mock' || proof.safetyNotice !== MOCK_PROOF_SAFETY_NOTICE) {
    throw new Error('mock order trigger proof must keep explicit mock settlement safety copy.');
  }

  if (proof.settlementTx !== null || proof.blockNumber !== null || proof.blockHash !== null || proof.explorerUrl !== null) {
    throw new Error('mock order trigger proof must keep tx/block/explorer null until real Quai event evidence exists.');
  }
};

export const submitMockCrossOrders = async ({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  orders = createMockCrossOrders(),
} = {}) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('submitMockCrossOrders requires a fetch implementation.');
  }

  const restingOrder = await postOrder({ baseUrl, order: orders.restingSell, fetchImpl });
  const crossingOrder = await postOrder({ baseUrl, order: orders.crossingBuy, fetchImpl });
  const [fill] = crossingOrder.fills ?? [];
  requireConfirmedMockFill(fill);

  const proofEnvelope = await fetchProofEnvelope({ baseUrl, tradeId: fill.tradeId, fetchImpl });
  requireMockProofEnvelope(proofEnvelope, fill);

  return {
    restingOrder: clone(restingOrder),
    crossingOrder: clone(crossingOrder),
    fill: clone(fill),
    proofEnvelope: clone(proofEnvelope),
    proof: clone(proofEnvelope.proof),
    custody: CUSTODY_NOTE,
    safetyNotice: 'Mock UI trigger only: no real Quai tx/explorer/funds moved.',
  };
};

const closestTrigger = (target) => {
  if (target === undefined || target === null) {
    return null;
  }

  if (typeof target.closest === 'function') {
    return target.closest('[data-qdx-trigger-cross]');
  }

  if (typeof target.matches === 'function' && target.matches('[data-qdx-trigger-cross]')) {
    return target;
  }

  return null;
};

const setStatus = (mount, text, state) => {
  const statusNode = typeof mount.querySelector === 'function'
    ? mount.querySelector('[data-qdx-trigger-status]')
    : null;

  if (statusNode !== null) {
    statusNode.textContent = text;
    if (statusNode.dataset !== undefined) {
      statusNode.dataset.qdxTriggerStatus = state;
    }
  }
};

export const bindMockOrderTrigger = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  onSmoke = () => {},
  onError = () => {},
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.addEventListener !== 'function') {
    throw new TypeError('bindMockOrderTrigger requires a mount node with addEventListener().');
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
      mount.dataset.qdxMockOrderTrigger = 'submitting';
    }
    setStatus(mount, 'submitting local mock sell + market_ioc buy; no real Quai tx/explorer/funds.', 'submitting');

    try {
      const smoke = await submitMockCrossOrders({ baseUrl, fetchImpl });
      if (mount.dataset !== undefined) {
        mount.dataset.qdxMockOrderTrigger = 'filled';
      }
      setStatus(
        mount,
        `created ${smoke.fill.fillId} via ${smoke.proofEnvelope.source}; no real Quai tx/explorer/funds moved.`,
        'filled',
      );
      onSmoke(smoke);
      return smoke;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (mount.dataset !== undefined) {
        mount.dataset.qdxMockOrderTrigger = 'error';
      }
      setStatus(mount, `mock order trigger failed: ${normalizedError.message}`, 'error');
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
