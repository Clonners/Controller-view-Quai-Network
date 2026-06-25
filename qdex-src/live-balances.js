const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const BALANCE_STREAM_CHANNEL = 'balances';
const BALANCE_SOURCE = 'mock-vault-projection';
const STREAM_CUSTODY_NOTE = 'non-custodial-no-withdrawal-authority';
const PROJECTION_CUSTODY_NOTE = 'non-custodial-contract-vault';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';
const BALANCE_SAFETY_NOTICE = 'Mock vault projection only: no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.';

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

const requireMockVaultProjection = (projection) => {
  assertObject(projection, 'balance projection');
  assertEqual(projection.source, BALANCE_SOURCE, 'balance projection source');
  assertEqual(projection.custody, PROJECTION_CUSTODY_NOTE, 'balance projection custody');
  assertSafePermissions(projection.permissions, 'unsafe balance projection permissions');
  assertEqual(projection.withdrawalAuthority, 'owner-wallet-only', 'balance projection withdrawalAuthority');
  assertEqual(projection.settlementMode, 'mock', 'balance projection settlementMode');
  assertEqual(projection.realQuaiTransactions, false, 'realQuaiTransactions');
  assertEqual(projection.walletRequired, false, 'walletRequired');

  if (!Array.isArray(projection.balances)) {
    throw new Error('balance projection balances must be an array.');
  }

  if (projection.safetyNotice !== BALANCE_SAFETY_NOTICE) {
    throw new Error('balance projection safety notice must state no real Quai transaction, no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.');
  }
};

export const buildBalanceStreamUrl = ({ baseUrl = DEFAULT_API_BASE_URL, channel = BALANCE_STREAM_CHANNEL } = {}) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', channel);
  return url.toString();
};

export const normalizeBalanceStreamMessage = (message) => {
  assertObject(message, 'balance stream message');
  assertEqual(message.type, 'snapshot', 'balance stream message type');
  assertEqual(message.transport, 'websocket', 'balance stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'balance stream snapshot');
  assertEqual(snapshot.channel, BALANCE_STREAM_CHANNEL, 'balance stream channel');
  assertEqual(snapshot.visibility, 'private', 'balance stream visibility');
  assertEqual(snapshot.payload, 'vault_balance_projection', 'balance stream payload');
  assertEqual(snapshot.source, BALANCE_SOURCE, 'balance stream source');
  assertEqual(snapshot.custody, STREAM_CUSTODY_NOTE, 'balance stream custody');
  assertSafePermissions(snapshot.permissions, 'unsafe private balance stream permissions');

  if (snapshot.safetyNotice !== STREAM_SAFETY_NOTICE) {
    throw new Error('balance stream safety notice must state no real Quai transaction, no explorer URL, and no funds moved.');
  }

  requireMockVaultProjection(snapshot.data);

  return {
    channel: snapshot.channel,
    source: snapshot.source,
    custody: snapshot.custody,
    permissions: clone(snapshot.permissions),
    safetyNotice: snapshot.safetyNotice,
    balances: clone(snapshot.data.balances),
    balanceProjection: clone(snapshot.data),
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveBalanceFixture = ({ baseFixture, normalizedBalanceStream }) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(normalizedBalanceStream, 'normalized balance stream');

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      balances: normalizedBalanceStream.source,
    },
    balances: clone(normalizedBalanceStream.balances),
    balanceProjection: clone(normalizedBalanceStream.balanceProjection),
    custody: {
      note: STREAM_CUSTODY_NOTE,
      withdrawalAuthority: 'owner-wallet-only',
    },
    balanceStream: {
      channel: normalizedBalanceStream.channel,
      source: normalizedBalanceStream.source,
      custody: normalizedBalanceStream.custody,
      permissions: clone(normalizedBalanceStream.permissions),
      safetyNotice: normalizedBalanceStream.safetyNotice,
      projectionSafetyNotice: normalizedBalanceStream.balanceProjection.safetyNotice,
      withdrawalAuthority: normalizedBalanceStream.balanceProjection.withdrawalAuthority,
      settlementMode: normalizedBalanceStream.balanceProjection.settlementMode,
      realQuaiTransactions: normalizedBalanceStream.balanceProjection.realQuaiTransactions,
      walletRequired: normalizedBalanceStream.balanceProjection.walletRequired,
      streamEvent: normalizedBalanceStream.streamEvent,
      balanceCount: normalizedBalanceStream.balances.length,
    },
  };
};

export const bindLiveBalanceStream = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture,
  render,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveBalanceStream requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveBalanceStream requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveBalanceStream requires a WebSocket implementation.');
  }

  const url = buildBalanceStreamUrl({ baseUrl, channel: BALANCE_STREAM_CHANNEL });
  const ws = new WebSocketImpl(url);

  const reportError = (error) => {
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const handleMessage = (event) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      const normalized = normalizeBalanceStreamMessage(payload);
      const fixture = createLiveBalanceFixture({
        baseFixture,
        normalizedBalanceStream: normalized,
      });

      mount.innerHTML = render(fixture);
      onUpdate(fixture);
    } catch (error) {
      reportError(error);
    }
  };

  const handleError = () => reportError(new Error('live balance WebSocket stream failed.'));

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
