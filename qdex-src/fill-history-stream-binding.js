import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { fetchFillHistoryApiEnvelope } from './fill-history-binding.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const FILL_STREAM_CHANNEL = 'fills';
const FILL_SOURCE = 'in-memory-indexer-projection';
const FILL_CUSTODY = 'non-custodial-no-withdrawal-authority';
const SAFE_PERMISSIONS = ['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN'];
const FORBIDDEN_PERMISSIONS = ['WITHDRAW', 'ADMIN'];
const MOCK_STREAM_SAFETY_NOTICE = 'Mock stream payload only: no real Quai transaction, no explorer URL, no funds moved.';

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

const assertFillStreamSnapshot = ({ snapshot, label }) => {
  assertObject(snapshot, `${label} stream snapshot`);
  assertEqual(snapshot.channel, FILL_STREAM_CHANNEL, `${label} channel`);
  assertEqual(snapshot.visibility, 'private', `${label} visibility`);
  assertEqual(snapshot.payload, 'fill_projection', `${label} payload`);
  assertEqual(snapshot.source, FILL_SOURCE, `${label} source`);
  assertEqual(snapshot.custody, FILL_CUSTODY, `${label} custody`);
  assertSafePermissions(snapshot.permissions, `${label} permissions`);
  assertEqual(snapshot.safetyNotice, MOCK_STREAM_SAFETY_NOTICE, `${label} safetyNotice`);
  assertObject(snapshot.data, `${label} snapshot data`);
  assertEqual(snapshot.data.source, FILL_SOURCE, `${label} data.source`);
  if (!Array.isArray(snapshot.data.fills)) {
    throw new Error(`${label} data.fills must be an array.`);
  }
};

const assertFillHistoryData = ({ history, label }) => {
  assertObject(history, `${label} fill history`);
  assertEqual(history.source, FILL_SOURCE, `${label} source`);
  assertEqual(history.projectionType, 'IndexedFillProjection', `${label} projectionType`);
  assertEqual(history.eventName, 'Fill', `${label} eventName`);
  if (!Array.isArray(history.fills)) {
    throw new Error(`${label} fills must be an array.`);
  }
};

const assertRestAndStreamAgree = ({ restHistory, streamSnapshot }) => {
  assertEqual(restHistory.source, streamSnapshot.source, 'REST vs stream source');
  if (JSON.stringify(restHistory.fills) !== JSON.stringify(streamSnapshot.data.fills)) {
    throw new Error('fill history rows must match the REST snapshot before rendering.');
  }
};

export const bindLiveFillHistoryStreamsWithRestHistory = async ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = globalThis.WebSocket,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onRestHistory = noop,
  onStreamUpdate = noop,
  onRestError = noop,
  onStreamError = noop,
} = {}) => {
  let restHistory;

  try {
    restHistory = await fetchFillHistoryApiEnvelope({ baseUrl, fetchImpl });
    setDatasetValue(mount, 'qdxFillHistoryRestSnapshot', restHistory.source);
    onRestHistory(clone(restHistory));
  } catch (error) {
    setDatasetValue(mount, 'qdxFillHistoryRestSnapshot', 'error');
    onRestError(error);
    throw error;
  }

  const currentFillHistory = clone(restHistory);
  const receivedChannels = [];

  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', FILL_STREAM_CHANNEL);
  const wsUrl = url.toString();

  const ws = new WebSocketImpl(wsUrl);

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxFillHistoryStreams', 'error');
    onStreamError(error instanceof Error ? error : new Error(String(error)));
  };

  const handleMessage = (event) => {
    try {
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      assertObject(message, 'fill stream message');
      assertEqual(message.type, 'snapshot', 'fill stream message type');
      assertEqual(message.transport, 'websocket', 'fill stream transport');

      const snapshot = message.snapshot;
      assertFillStreamSnapshot({ snapshot, label: 'fills' });
      assertRestAndStreamAgree({ restHistory, streamSnapshot: snapshot });

      if (!receivedChannels.includes(snapshot.channel)) {
        receivedChannels.push(snapshot.channel);
      }

      currentFillHistory.fills = clone(snapshot.data.fills);

      const fixture = {
        ...clone(baseFixture),
        sources: {
          ...(baseFixture.sources ?? {}),
          fills: snapshot.source,
        },
        fillHistory: clone(currentFillHistory),
        liveStream: {
          channel: snapshot.channel,
          source: snapshot.source,
          custody: snapshot.custody,
          permissions: clone(snapshot.permissions),
          safetyNotice: snapshot.safetyNotice,
        },
      };

      setDatasetValue(mount, 'qdxFillHistoryStreams', snapshot.channel);
      setDatasetValue(mount, 'qdxFillHistoryStreamRows', String(snapshot.data.fills.length));
      mount.innerHTML = render(fixture);
      onStreamUpdate(fixture);
    } catch (error) {
      reportError(error);
    }
  };

  const handleError = () => reportError(new Error('live fill history WebSocket stream failed.'));

  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);

  return {
    fillHistory: clone(restHistory),
    url: wsUrl,
    close() {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      if (ws.readyState !== 3) {
        ws.close();
      }
    },
  };
};
