import { bindLiveOrderStream } from './live-orders.js';
import { bindMockCancelTrigger } from './mock-cancel-trigger.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';

const noop = () => {};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

export const bindMockCancelTriggerWithOrderStream = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = globalThis.WebSocket,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onCancel = noop,
  onStreamUpdate = noop,
  onCancelError = noop,
  onStreamError = noop,
} = {}) => {
  const streamBinding = bindLiveOrderStream({
    mount,
    baseUrl,
    baseFixture,
    render,
    WebSocketImpl,
    onError: (error) => {
      setDatasetValue(mount, 'qdxLiveOrdersStream', 'error');
      onStreamError(error);
    },
    onUpdate: (fixture) => {
      setDatasetValue(mount, 'qdxLiveOrdersStream', 'orders');
      onStreamUpdate(fixture);
    },
  });

  let cancelBinding;
  try {
    cancelBinding = bindMockCancelTrigger({
      mount,
      baseUrl,
      fetchImpl,
      onCancel: (result) => {
        setDatasetValue(mount, 'qdxMockCancelTrigger', 'cancelled');
        onCancel(result);
      },
      onError: (error) => {
        setDatasetValue(mount, 'qdxMockCancelTrigger', 'error');
        onCancelError(error);
      },
    });
  } catch (error) {
    streamBinding.close();
    throw error;
  }

  return {
    close() {
      cancelBinding.close();
      streamBinding.close();
    },
  };
};
