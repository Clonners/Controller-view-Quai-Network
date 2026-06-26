const DEFAULT_BASE_URL = 'https://api.bitquai.live';
const ZERO_DELEGATE = '0x0000000000000000000000000000000000000000';
const DEFAULT_OWNER = '0x1111111111111111111111111111111111111111';
const DEFAULT_SETTLEMENT_CONTRACT = '0x2222222222222222222222222222222222222222';
const MOCK_SIGNED_AT = 1780000000;
const DEFAULT_EXPIRES_AT = 1780003600;

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const marketDepthChannel = (marketId) => `market.${marketId}.depth`;
const marketTradesChannel = (marketId) => `market.${marketId}.trades`;
const marketKlinesChannel = (marketId, interval = '15m') => `market.${marketId}.klines.${interval}`;
const klinesPath = (marketId, { interval } = {}) => {
  const path = `/v1/klines/${encodeURIComponent(marketId)}`;
  return interval === undefined ? path : `${path}?${new URLSearchParams({ interval }).toString()}`;
};

class QDexHttpError extends Error {
  constructor(message, { status, body }) {
    super(message);
    this.name = 'QDexHttpError';
    this.status = status;
    this.body = body;
  }
}

const assertOk = ({ status, body }, path) => {
  if (status < 200 || status >= 300) {
    throw new QDexHttpError(`QDex API request failed for ${path}: HTTP ${status}`, { status, body });
  }

  return body;
};

class QDexStream {
  constructor({ channel, url, WebSocketImpl, timeoutMs = 2_000 }) {
    if (typeof WebSocketImpl !== 'function') {
      throw new TypeError('QDexClient stream support requires a WebSocket implementation.');
    }

    this.channel = channel;
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.messages = [];
    this.waiters = [];
    this.error = null;
    this.closed = false;
    this.ws = new WebSocketImpl(url);

    this.ws.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        this.#fail(new Error(`QDex stream expected text JSON for ${channel}.`));
        return;
      }

      try {
        this.#push(JSON.parse(event.data));
      } catch (error) {
        this.#fail(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.ws.addEventListener('error', () => {
      this.#fail(new Error(`QDex WebSocket stream failed for ${channel}.`));
    }, { once: true });

    this.ws.addEventListener('close', () => {
      this.closed = true;
      this.#fail(new Error(`QDex WebSocket stream closed for ${channel}.`));
    }, { once: true });
  }

  async next({ timeoutMs = this.timeoutMs } = {}) {
    if (this.messages.length > 0) {
      return this.messages.shift();
    }

    if (this.error !== null) {
      throw this.error;
    }

    return await new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        reject(new Error(`timed out waiting for ${this.channel} stream message`));
      }, timeoutMs);

      this.waiters.push(waiter);
    });
  }

  async close() {
    this.closed = true;

    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`QDex WebSocket stream closed for ${this.channel}.`));
    }

    if (this.ws.readyState === 3) {
      return;
    }

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 250);
      this.ws.addEventListener('close', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.close();
    });
  }

  #push(message) {
    const waiter = this.waiters.shift();
    if (waiter === undefined) {
      this.messages.push(message);
      return;
    }

    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }

  #fail(error) {
    if (this.closed && this.waiters.length === 0) {
      return;
    }

    this.error = error;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
}

export const createMockSignedOrder = (overrides = {}) => {
  const type = overrides.type ?? 'limit';
  const owner = overrides.owner ?? DEFAULT_OWNER;
  const delegate = overrides.delegate ?? ZERO_DELEGATE;
  const nonce = overrides.nonce ?? '1';
  const timeInForce = overrides.timeInForce ?? (type === 'market_ioc' ? 'IOC' : 'GTC');
  const maxSlippageBps = overrides.maxSlippageBps ?? (type === 'market_ioc' ? 50 : 0);

  const order = {
    marketId: 'WQUAI-WQI',
    side: 'sell',
    type,
    baseToken: 'mock:WQUAI',
    quoteToken: 'mock:WQI',
    amount: '100',
    price: '5',
    timeInForce,
    maxSlippageBps,
    owner,
    delegate,
    nonce,
    expiresAt: DEFAULT_EXPIRES_AT,
    chainId: 0,
    settlementContract: DEFAULT_SETTLEMENT_CONTRACT,
    clientOrderId: `sdk-mock-order-${nonce}`,
    ...overrides,
  };

  order.signature = {
    scheme: 'mock',
    signer: order.owner,
    value: `0xmock-${order.nonce}`,
    signedAt: MOCK_SIGNED_AT,
    ...(overrides.signature ?? {}),
  };

  return order;
};

export class QDexClient {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    fetch: fetchImpl = globalThis.fetch,
    WebSocket: WebSocketImpl = globalThis.WebSocket,
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('QDexClient requires a fetch implementation.');
    }

    this.baseUrl = trimTrailingSlash(baseUrl);
    this.fetch = fetchImpl;
    this.WebSocket = WebSocketImpl;

    // Mock endpoints
    this.markets = {
      list: async () => (await this.#requestOk('/v1/markets')).markets,
    };

    this.tickers = {
      list: async () => (await this.#requestOk('/v1/tickers')).tickers,
      get: async (marketId) => this.#requestOk(`/v1/tickers/${encodeURIComponent(marketId)}`),
      openStream: (options = {}) => this.streams.open('global.tickers', options),
      stream: async (options = {}) => this.streams.read('global.tickers', options),
    };

    this.orderbook = {
      get: async (marketId) => this.#requestOk(`/v1/orderbook/${encodeURIComponent(marketId)}`),
      openStream: (marketId, options = {}) => this.streams.open(marketDepthChannel(marketId), options),
      stream: async (marketId, options = {}) => this.streams.read(marketDepthChannel(marketId), options),
    };

    this.klines = {
      get: async (marketId, options = {}) => this.#requestOk(klinesPath(marketId, options)),
      openStream: (marketId, { interval = '15m', ...options } = {}) => this.streams.open(marketKlinesChannel(marketId, interval), options),
      stream: async (marketId, { interval = '15m', ...options } = {}) => this.streams.read(marketKlinesChannel(marketId, interval), options),
    };

    this.contracts = {
      get: async () => this.#requestOk('/v1/contracts'),
    };

    this.fees = {
      get: async () => this.#requestOk('/v1/fees'),
      openStream: (options = {}) => this.streams.open('fees', options),
      stream: async (options = {}) => this.streams.read('fees', options),
    };

    this.account = {
      get: async () => this.#requestOk('/v1/account'),
      balances: async () => this.#requestOk('/v1/account/balances'),
      orders: {
        get: async () => this.#requestOk('/v1/account/orders'),
        openStream: (options = {}) => this.streams.open('open-orders', options),
        stream: async (options = {}) => this.streams.read('open-orders', options),
      },
    };

    this.vault = {
      deposits: {
        list: async () => this.#requestOk('/v1/vault/deposits'),
        openStream: (options = {}) => this.streams.open('deposits', options),
        stream: async (options = {}) => this.streams.read('deposits', options),
        prepare: async (request) => this.#requestExpectedStatus('/v1/vault/deposits/prepare', {
          method: 'POST',
          body: { ...request, operation: 'deposit' },
          expectedStatus: 501,
        }),
      },
      withdrawals: {
        list: async () => this.#requestOk('/v1/vault/withdrawals'),
        openStream: (options = {}) => this.streams.open('withdrawals', options),
        stream: async (options = {}) => this.streams.read('withdrawals', options),
        prepare: async (request) => this.#requestExpectedStatus('/v1/vault/withdrawals/prepare', {
          method: 'POST',
          body: { ...request, operation: 'withdrawal' },
          expectedStatus: 501,
        }),
      },
    };

    this.listings = {
      policy: {
        get: async () => this.#requestOk('/v1/listings/policy'),
      },
      reviewFlow: {
        get: async () => this.#requestOk('/v1/listings/review-flow'),
      },
      requests: {
        prepareSubmit: async (request) => this.#requestExpectedStatus('/v1/listings/requests', {
          method: 'POST',
          body: request,
          expectedStatus: 501,
        }),
        listLocalReviewQueue: async () => this.#requestOk('/v1/listings/requests'),
        enqueueLocalReview: async (request) => this.#requestExpectedStatus('/v1/listings/requests', {
          method: 'POST',
          body: { ...request, requestMode: 'local_review_queue' },
          expectedStatus: 202,
        }),
        decideLocalReview: async (requestId, decision) => this.#requestExpectedStatus(
          `/v1/listings/requests/${encodeURIComponent(requestId)}/decision`,
          {
            method: 'POST',
            body: { ...decision, decisionMode: 'local_review_decision' },
            expectedStatus: 200,
          },
        ),
      },
    };

    this.relayer = {
      settlementModeGate: {
        get: async () => this.#requestOk('/v1/relayer/settlement-mode-gate'),
      },
    };

    this.nonces = {
      prepareCancel: async (request) => this.#requestExpectedStatus('/v1/nonces/cancel', {
        method: 'POST',
        body: request,
        expectedStatus: 501,
      }),
      cancellations: {
        list: async () => this.#requestOk('/v1/nonces/cancellations'),
        openStream: (options = {}) => this.streams.open('nonce-cancellations', options),
        stream: async (options = {}) => this.streams.read('nonce-cancellations', options),
      },
    };

    this.orders = {
      list: async () => this.#requestOk('/v1/orders'),
      submitSignedOrder: async (order) => this.#requestOk('/v1/orders', {
        method: 'POST',
        body: { order },
      }),
      cancel: async (orderHash) => this.#requestOk(`/v1/orders/${encodeURIComponent(orderHash)}`, { method: 'DELETE' }),
      cancelAll: async ({ marketId, owner } = {}) => {
        const body = Object.fromEntries(Object.entries({ marketId, owner }).filter(([, value]) => value !== undefined));
        return this.#requestOk('/v1/orders/cancel-all', {
          method: 'POST',
          body: Object.keys(body).length > 0 ? body : undefined,
        });
      },
      openStream: (options = {}) => this.streams.open('orders', options),
      stream: async (options = {}) => this.streams.read('orders', options),
    };

    this.fills = {
      list: async () => this.#requestOk('/v1/fills'),
      openStream: (options = {}) => this.streams.open('fills', options),
      stream: async (options = {}) => this.streams.read('fills', options),
    };

    this.trades = {
      list: async (marketId) => this.#requestOk(`/v1/trades/${encodeURIComponent(marketId)}`),
      openStream: (marketId, options = {}) => this.streams.open(marketTradesChannel(marketId), options),
      stream: async (marketId, options = {}) => this.streams.read(marketTradesChannel(marketId), options),
    };

    this.proofs = {
      trade: async (tradeId) => this.#requestOk(`/v1/proofs/trades/${encodeURIComponent(tradeId)}`),
    };

    this.delegateKeys = {
      list: async () => this.#requestOk('/v1/delegate-keys'),
      listRegistrations: async () => this.#requestOk('/v1/delegate-keys/registrations'),
      listRevocations: async () => this.#requestOk('/v1/delegate-keys/revocations'),
      registrations: {
        openStream: (options = {}) => this.streams.open('delegate-key-registrations', options),
        stream: async (options = {}) => this.streams.read('delegate-key-registrations', options),
      },
      revocations: {
        openStream: (options = {}) => this.streams.open('delegate-key-revocations', options),
        stream: async (options = {}) => this.streams.read('delegate-key-revocations', options),
      },
      prepareRegister: async (request) => this.#requestExpectedStatus('/v1/delegate-keys', {
        method: 'POST',
        body: request,
        expectedStatus: 501,
      }),
      prepareRevoke: async (keyId, request = {}) => this.#requestExpectedStatus(`/v1/delegate-keys/${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
        body: request,
        expectedStatus: 501,
      }),
    };

    // Real network endpoints (read from chain)
    this.real = {
      network: {
        get: async () => this.#requestOk('/v1/real/network'),
      },
      markets: {
        list: async () => (await this.#requestOk('/v1/real/markets')).markets,
      },
      fees: {
        get: async () => (await this.#requestOk('/v1/real/fees')).fees,
      },
      balances: {
        get: async (address) => this.#requestOk(`/v1/real/balances/${encodeURIComponent(address)}`),
      },
      trades: {
        list: async (marketId, limit = 50) => {
          const params = limit ? `?limit=${limit}` : '';
          return (await this.#requestOk(`/v1/real/trades${params}`)).trades;
        },
      },
      block: {
        get: async () => (await this.#requestOk('/v1/real/block')).blockNumber,
      },
      events: {
        trades: {
          list: async (limit = 50) => {
            const params = limit ? `?limit=${limit}` : '';
            return (await this.#requestOk(`/v1/real/events/trades${params}`)).trades;
          },
        },
        deposits: {
          list: async (limit = 50) => {
            const params = limit ? `?limit=${limit}` : '';
            return (await this.#requestOk(`/v1/real/events/deposits${params}`)).deposits;
          },
        },
        withdrawals: {
          list: async (limit = 50) => {
            const params = limit ? `?limit=${limit}` : '';
            return (await this.#requestOk(`/v1/real/events/withdrawals${params}`)).withdrawals;
          },
        },
      },
    };

    this.streams = {
      open: (channel, options = {}) => this.#openStream(channel, options),
      read: async (channel, options = {}) => this.#readStream(channel, options),
    };
  }

  #streamUrl(channel) {
    const url = new URL(this.baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/v1/ws';
    url.search = '';
    url.searchParams.set('channel', channel);
    return url.toString();
  }

  #openStream(channel, { timeoutMs = 2_000 } = {}) {
    return new QDexStream({
      channel,
      url: this.#streamUrl(channel),
      WebSocketImpl: this.WebSocket,
      timeoutMs,
    });
  }

  async #readStream(channel, { limit = 1, timeoutMs = 2_000 } = {}) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new TypeError('QDex stream read limit must be a positive integer.');
    }

    const stream = this.#openStream(channel, { timeoutMs });
    const messages = [];

    try {
      while (messages.length < limit) {
        messages.push(await stream.next({ timeoutMs }));
      }
    } finally {
      await stream.close();
    }

    return messages;
  }

  async #requestOk(path, options = {}) {
    return assertOk(await this.#request(path, options), path);
  }

  async #requestExpectedStatus(path, { expectedStatus, ...options }) {
    const response = await this.#request(path, options);
    if (response.status !== expectedStatus) {
      throw new QDexHttpError(`QDex API request for ${path} returned HTTP ${response.status}, expected HTTP ${expectedStatus}`, response);
    }

    return response;
  }

  async #request(path, { method = 'GET', body } = {}) {
    const headers = body === undefined ? {} : { 'content-type': 'application/json' };
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const parsedBody = text.length > 0 ? JSON.parse(text) : null;

    return {
      status: response.status,
      body: parsedBody,
    };
  }
}

const firstFillFrom = (orderResponse) => {
  const fill = orderResponse.fills?.[0];
  if (fill === undefined) {
    throw new Error('Mock cross smoke expected the crossing order to produce one fill.');
  }

  return fill;
};

export const runMockCrossSmoke = async (client, {
  restingSell = createMockSignedOrder({
    side: 'sell',
    amount: '100',
    price: '5',
    nonce: '1001',
    owner: DEFAULT_OWNER,
  }),
  crossingBuy = createMockSignedOrder({
    side: 'buy',
    amount: '100',
    price: '6',
    nonce: '1002',
    owner: '0x3333333333333333333333333333333333333333',
  }),
} = {}) => {
  const marketId = restingSell.marketId;
  const bookBefore = await client.orderbook.get(marketId);
  const restingOrderInitial = await client.orders.submitSignedOrder(restingSell);
  const bookWithResting = await client.orderbook.get(marketId);
  const crossingOrder = await client.orders.submitSignedOrder(crossingBuy);
  const fill = firstFillFrom(crossingOrder);
  const orders = await client.orders.list();
  const restingOrder = orders.orders.find((order) => order.orderHash === restingOrderInitial.orderHash) ?? restingOrderInitial;
  const fills = await client.fills.list();
  const trades = await client.trades.list(marketId);
  const proofEnvelope = await client.proofs.trade(fill.tradeId);
  const bookAfter = await client.orderbook.get(marketId);

  return {
    marketId,
    bookBefore,
    bookWithResting,
    bookAfter,
    restingOrder,
    crossingOrder,
    fill,
    fills,
    trades,
    proofEnvelope,
    proof: proofEnvelope.proof,
  };
};

export { QDexHttpError };
