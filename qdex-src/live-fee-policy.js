import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { normalizeFeePolicyApiEnvelope } from './fee-policy-binding.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const FEE_POLICY_SOURCE = 'feemanager-policy-projection';
const STREAM_CUSTODY = 'public-read-only-no-custody';
const STREAM_SAFETY_NOTICE =
  'Public FeeManager fee schedule stream: read-only metadata only; no wallet loaded, no fee-authority key, no TradingVault mutation, and no funds moved.';

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

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

const feeScheduleRowCount = (feePolicy) => feePolicy.feeSchedules.length;

export const buildFeePolicyStreamUrl = ({ baseUrl = DEFAULT_API_BASE_URL } = {}) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/ws';
  url.search = '';
  url.searchParams.set('channel', 'fees');
  return url.toString();
};

export const normalizeFeePolicyStreamMessage = (message) => {
  assertObject(message, 'FeeManager fee schedule stream message');
  assertEqual(message.type, 'snapshot', 'FeeManager fees stream message type');
  assertEqual(message.transport, 'websocket', 'FeeManager fees stream transport');

  const { snapshot } = message;
  assertObject(snapshot, 'FeeManager fee schedule stream snapshot');
  assertEqual(snapshot.channel, 'fees', 'FeeManager fees stream channel');
  assertEqual(snapshot.visibility, 'public', 'fees stream visibility');
  assertEqual(snapshot.payload, 'fee_schedule_projection', 'FeeManager fees stream payload');
  assertEqual(snapshot.source, FEE_POLICY_SOURCE, 'FeeManager fees stream source');
  assertEqual(snapshot.custody, STREAM_CUSTODY, 'FeeManager fees stream custody');

  const feePolicyEnvelope = normalizeFeePolicyApiEnvelope(snapshot.data);

  return {
    channel: snapshot.channel,
    payload: snapshot.payload,
    source: snapshot.source,
    custody: snapshot.custody,
    feePolicyEnvelope: clone(feePolicyEnvelope),
    streamEvent: message.streamEvent === undefined ? null : clone(message.streamEvent),
  };
};

export const createLiveFeePolicyFixture = ({
  baseFixture,
  feePolicy,
  streamEvent,
} = {}) => {
  assertObject(baseFixture, 'base terminal UI fixture');
  assertObject(feePolicy, 'FeeManager fee policy fixture');

  const normalizedFeePolicy = normalizeFeePolicyApiEnvelope(feePolicy);
  const firstSchedule = normalizedFeePolicy.feeSchedules[0] ?? {};

  return {
    ...clone(baseFixture),
    sources: {
      ...(baseFixture.sources ?? {}),
      feePolicy: FEE_POLICY_SOURCE,
    },
    feePolicy: clone(normalizedFeePolicy),
    feePolicyStream: {
      channel: 'fees',
      source: FEE_POLICY_SOURCE,
      custody: STREAM_CUSTODY,
      permissions: clone(normalizedFeePolicy.permissions),
      safetyNotice: STREAM_SAFETY_NOTICE,
      projectionSafetyNotice: normalizedFeePolicy.safety.notice,
      projectionType: firstSchedule.projectionType ?? 'FeeScheduleProjection',
      eventName: firstSchedule.eventName ?? 'FeesUpdated',
      settlementMode: firstSchedule.settlementMode ?? 'mock',
      hardMaxFeeBps: normalizedFeePolicy.hardMaxFeeBps,
      feeRecipient: normalizedFeePolicy.feeRecipient,
      rowCount: feeScheduleRowCount(normalizedFeePolicy),
      feeManagerMutation: false,
      tradingVaultMutation: false,
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      noFeeAuthorityRuntimeKeys: normalizedFeePolicy.safety.noFeeAuthorityRuntimeKeys,
      streamEvent: streamEvent === undefined ? null : clone(streamEvent),
    },
  };
};

export const bindLiveFeePolicyStream = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  WebSocketImpl = globalThis.WebSocket,
  onError = () => {},
  onUpdate = () => {},
} = {}) => {
  if (mount === undefined || mount === null) {
    throw new TypeError('bindLiveFeePolicyStream requires a mount node.');
  }

  if (typeof render !== 'function') {
    throw new TypeError('bindLiveFeePolicyStream requires a render function.');
  }

  if (typeof WebSocketImpl !== 'function') {
    throw new TypeError('bindLiveFeePolicyStream requires a WebSocket implementation.');
  }

  const reportError = (error) => {
    setDatasetValue(mount, 'qdxFeePolicyStream', 'error');
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const updateFromStream = (normalized) => {
    const fixture = createLiveFeePolicyFixture({
      baseFixture,
      feePolicy: normalized.feePolicyEnvelope,
      streamEvent: normalized.streamEvent,
    });

    setDatasetValue(mount, 'qdxFeePolicyStream', fixture.feePolicyStream.channel);
    setDatasetValue(mount, 'qdxFeePolicyStreamSource', fixture.feePolicyStream.source);
    setDatasetValue(mount, 'qdxFeePolicyStreamRows', String(fixture.feePolicyStream.rowCount));

    mount.innerHTML = render(fixture);
    onUpdate(fixture);
  };

  const ws = new WebSocketImpl(buildFeePolicyStreamUrl({ baseUrl }));

  const handleMessage = (event) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      updateFromStream(normalizeFeePolicyStreamMessage(payload));
    } catch (error) {
      reportError(error);
    }
  };

  const handleError = () => reportError(new Error('live FeeManager fee schedule WebSocket stream failed.'));

  ws.addEventListener('message', handleMessage);
  ws.addEventListener('error', handleError);

  return {
    url: ws.url,
    close() {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      if (ws.readyState !== 3) {
        ws.close();
      }
    },
  };
};
