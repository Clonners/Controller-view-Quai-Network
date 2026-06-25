import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';
import { bindVaultPrepareTrigger } from './vault-prepare-trigger.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const noop = () => {};

const setDatasetValue = (mount, key, value) => {
  if (mount?.dataset !== undefined) {
    mount.dataset[key] = value;
  }
};

export const bindVaultPrepareTriggerWithLocalApiSmoke = ({
  mount,
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  baseFixture = mockVerticalSliceFixture,
  render = renderTradeProofPanel,
  onPrepare = noop,
  onError = noop,
} = {}) => bindVaultPrepareTrigger({
  mount,
  baseUrl,
  fetchImpl,
  baseFixture,
  render,
  onPrepare: (result, fixture) => {
    setDatasetValue(mount, 'qdxVaultPrepareSmoke', 'prepare-only');
    setDatasetValue(mount, 'qdxVaultPrepareSmokeOperation', result.body.vaultOperation);
    setDatasetValue(mount, 'qdxVaultPrepareSmokeHttpStatus', String(result.httpStatus));
    onPrepare(result, fixture);
  },
  onError: (error) => {
    setDatasetValue(mount, 'qdxVaultPrepareSmoke', 'error');
    onError(error);
  },
});
