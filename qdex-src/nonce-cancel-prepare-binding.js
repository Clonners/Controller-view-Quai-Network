import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { bindNonceCancelPrepareTrigger } from './nonce-cancel-prepare-trigger.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const noop = () => {};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

export const bindNonceCancelPrepareTriggerWithLocalApiSmoke = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onPrepare = noop,
  onError = noop,
} = {}) => bindNonceCancelPrepareTrigger({
  mount,
  baseUrl,
  fetchImpl,
  baseFixture,
  render,
  onPrepare: (result, fixture) => {
    setDatasetValue(mount, 'qdxNonceCancelPrepareSmoke', 'prepare-only');
    setDatasetValue(mount, 'qdxNonceCancelPrepareSmokeHttpStatus', String(result.httpStatus));
    onPrepare(result, fixture);
  },
  onError: (error) => {
    setDatasetValue(mount, 'qdxNonceCancelPrepareSmoke', 'error');
    onError(error);
  },
});
