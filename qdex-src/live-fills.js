const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const FILL_STREAM_CHANNEL = 'fills';
const INDEXER_SOURCE = 'in-memory-indexer-projection';
const PROOF_SOURCE = 'proof-service-indexer-projection';
const CUSTODY_NOTE = 'non-custodial-no-withdrawal-authority';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const MOCK_STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';
const MOCK_PROOF_SAFETY_NOTICE = 'Mock proof only: no real Quai transaction, no explorer URL, no funds moved.';

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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

const assertMockOnlyProof = (proof) => {
  assertObject(proof, 'proof-service proof');
  assertEqual(proof.settlementMode, 'mock', 'proof.settlementMode');

  if (proof.settlementTx !== null || proof.blockNumber !== null || proof.blockHash !== null || proof.explorerUrl !== null) {
    throw new Error('mock proof must keep settlementTx/block/explorer null until real Quai event evidence exists.');
  }

  if (proof.safetyNotice !== MOCK_PROOF_SAFETY_NOTICE) {
    throw new Error('mock proof safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }
};

const assertSafePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw new Error('unsafe private fill stream permissions: permissions must be an array.');
  }

  const missing = SAFE_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  const forbidden = permissions.filter((permission) => FORBIDDEN_PERMISSIONS.includes(permission));

  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(`unsafe private fill stream permissions: missing=${missing.join(',') || 'none'} forbidden=${forbidden.join(',') || 'none'}`);
  }
};

const requireLatestFillShape = (fill) => {
  assertObject(fill, 'latest fill');
  assertEqual(fill.projectionType, 'IndexedFillProjection', 'latest fill projectionType');

  for (const field of ['fillId', 'tradeId', 'marketId', 'makerOrderHash', 'takerOrderHash', 'price', 'amount', 'settlementMode', 'settlementStatus', 'sourceEventId']) {
    if (fill[field] === undefined || fill[field] === null || fill[field] === '') {
      throw new Error(`latest fill is missing adapter field ${field}.`);
    }
  }

  if (Object.hasOwn(fill, 'createdAt')) {
    throw new Error('latest fill must be adapter-shaped and must not expose matcher-local createdAt.');
  }

  assertEqual(fill.settlementMode, 'mock', 'latest fill settlementMode');
  assertEqual(fill.settlementStatus, 'confirmed', 'latest fill settlementStatus');
};

export const buildFillStreamUrl = ({ baseUrl = DEFAULT_API_BASE_URL, channel = FILL_STREAM_CHANNEL } = {}) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

const buildHttpApiUrl = ({ baseUrl = DEFAULT_API_BASE_URL, pathname }) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = pathname;
  url.search = '';
  return url.toString();
};

export const buildTradeProofUrl = ({ baseUrl = DEFAULT_API_BASE_URL, tradeId }) => buildHttpApiUrl({
  baseUrl,
  pathname: `/v1/proofs/trades/${encodeURIComponent(tradeId)}`,
});

export const normalizeFillStreamMessage = (message) => {
  assertObject(message, 'fill stream message');
  assertEqual(message.type, 'snapshot', 'fill stream message type');
  assertEqual(message.transport, 'websocket', 'fill stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'fill stream snapshot');
  assertEqual(snapshot.channel, FILL_STREAM_CHANNEL, 'fill stream channel');
  assertEqual(snapshot.visibility, 'private', 'fill stream visibility');
  assertEqual(snapshot.payload, 'fill_projection', 'fill stream payload');
  assertEqual(snapshot.source, INDEXER_SOURCE, 'fill stream source');
  assertEqual(snapshot.custody, CUSTODY_NOTE, 'fill stream custody');
  assertSafePermissions(snapshot.permissions);

  if (snapshot.safetyNotice !== MOCK_STREAM_SAFETY_NOTICE) {
    throw new Error('fill stream safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }

  assertObject(snapshot.data, 'fill stream snapshot data');
  assertEqual(snapshot.data.source, INDEXER_SOURCE, 'fill stream data source');
  if (!Array.isArray(snapshot.data.fills)) {
    throw new Error('fill stream data.fills must be an array.');
  }

  const fills = clone(snapshot.data.fills);
  const latestFill = fills.at(-1) ?? null;
  if (latestFill !== null) {
    requireLatestFillShape(latestFill);
  }

  return {
    channel: snapshot.channel,
    source: snapshot.source,
    custody: snapshot.custody,
    permissions: clone(snapshot.permissions),
    safetyNotice: snapshot.safetyNotice,
    fills,
    latestFill,
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveTradeProofFixture = ({ baseFixture, normalizedFillStream, proofEnvelope }) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(normalizedFillStream, 'normalized fill stream');
  assertObject(proofEnvelope, 'proof-service envelope');
  assertEqual(proofEnvelope.source, PROOF_SOURCE, 'proof-service source');
  assertEqual(proofEnvelope.custody, CUSTODY_NOTE, 'proof-service custody');

  const fill = normalizedFillStream.latestFill;
  if (fill === null) {
    return null;
  }

  const proof = clone(proofEnvelope.proof);
  assertMockOnlyProof(proof);
  assertEqual(proof.tradeId, fill.tradeId, 'proof tradeId');
  assertEqual(proof.fillId, fill.fillId, 'proof fillId');
  assertEqual(proof.createdFromEventId, fill.sourceEventId, 'proof createdFromEventId');

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      fills: normalizedFillStream.source,
      trades: normalizedFillStream.source,
      proof: proofEnvelope.source,
    },
    market: {
      ...(baseFixture.market ?? {}),
      id: fill.marketId,
      settlementMode: 'mock',
      custodyModel: 'contract-vault-non-custodial',
    },
    fill: clone(fill),
    trade: {
      tradeId: fill.tradeId,
      fillId: fill.fillId,
      marketId: fill.marketId,
      price: fill.price,
      amount: fill.amount,
      settlementStatus: fill.settlementStatus,
      proofUrl: `/v1/proofs/trades/${fill.tradeId}`,
    },
    proof,
    custody: {
      note: CUSTODY_NOTE,
      withdrawalAuthority: 'owner-wallet-only',
    },
    liveStream: {
      channel: normalizedFillStream.channel,
      source: normalizedFillStream.source,
      custody: normalizedFillStream.custody,
      permissions: clone(normalizedFillStream.permissions),
      safetyNotice: normalizedFillStream.safetyNotice,
      streamEvent: normalizedFillStream.streamEvent,
    },
  };
};

const readProofEnvelope = async ({ baseUrl, tradeId, fetchImpl }) => {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('live fill stream binding requires a fetch implementation for proof-service lookup.');
  }

  const url = buildTradeProofUrl({ baseUrl, tradeId });
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`proof-service lookup failed for ${tradeId}: HTTP ${response.status}`);
  }

  return await response.json();
};

export const bindLiveFillStream = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture,
  render,
  WebSocketImpl = globalThis.WebSocket,
  fetchImpl = globalThis.fetch,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveFillStream requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveFillStream requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveFillStream requires a WebSocket implementation.');
  }

  const url = buildFillStreamUrl({ baseUrl, channel: FILL_STREAM_CHANNEL });
  const ws = new WebSocketImpl(url);

  const reportError = (error) => {
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const handleMessage = async (event) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      const normalized = normalizeFillStreamMessage(payload);
      if (normalized.latestFill === null) {
        return;
      }

      const proofEnvelope = await readProofEnvelope({
        baseUrl,
        tradeId: normalized.latestFill.tradeId,
        fetchImpl,
      });
      const fixture = createLiveTradeProofFixture({
        baseFixture,
        normalizedFillStream: normalized,
        proofEnvelope,
      });
      if (fixture === null) {
        return;
      }

      mount.innerHTML = render(fixture);
      onUpdate(fixture);
    } catch (error) {
      reportError(error);
    }
  };

  const handleError = () => reportError(new Error('live fill WebSocket stream failed.'));

  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);

  return {
    url,
    close() {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      if (ws.readyState !== 3) {
        ws.close();
      }
    },
  };
};
