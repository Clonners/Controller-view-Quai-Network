import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { bindDelegateKeyPrepareTrigger } from './delegate-key-prepare-trigger.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const noop = () => {};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

export const bindDelegateKeyPrepareTriggerWithLocalApiSmoke = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onPrepare = noop,
  onError = noop,
} = {}) => bindDelegateKeyPrepareTrigger({
  mount,
  baseUrl,
  fetchImpl,
  baseFixture,
  render,
  onPrepare: (result, fixture) => {
    setDatasetValue(mount, 'qdxDelegateKeyPrepareSmoke', 'prepare-only');
    setDatasetValue(mount, 'qdxDelegateKeyPrepareSmokeOperation', result.body.operation);
    setDatasetValue(mount, 'qdxDelegateKeyPrepareSmokeHttpStatus', String(result.httpStatus));
    onPrepare(result, fixture);
  },
  onError: (error) => {
    setDatasetValue(mount, 'qdxDelegateKeyPrepareSmoke', 'error');
    onError(error);
  },
});
