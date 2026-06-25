import { bindAccountOverviewLocalApiSmoke } from './account-overview-binding.js';
import { bindLiveBalanceStreamWithAccountSnapshot } from './balance-stream-binding.js';
import { bindCommandPaletteSkeleton } from './command-palette.js';
import { bindCommandPaletteLocalApiSmoke } from './command-palette-smoke-binding.js';
import { bindDelegateKeyHistoryLocalApiSmoke } from './delegate-key-history-binding.js';
import { bindLiveDelegateKeyHistoryStreamsWithRestHistory } from './delegate-key-history-stream-binding.js';
import { bindDelegateKeyPrepareTriggerWithLocalApiSmoke } from './delegate-key-prepare-binding.js';
import { bindFeePolicyLocalApiSmoke } from './fee-policy-binding.js';
import { bindLiveFeePolicyStreamWithRestSnapshot } from './fee-policy-stream-binding.js';
import { bindKeyboardShortcutHelpLocalApiSmoke } from './keyboard-shortcuts-smoke-binding.js';
import { bindMockCancelTriggerWithOrderStream } from './cancel-stream-binding.js';
import { bindLiveFillStream } from './live-fills.js';
import { bindLiveKlineStreamWithRestSnapshot } from './kline-stream-binding.js';
import { bindLivePublicMarketDataStreamsWithRestSnapshots } from './market-data-stream-binding.js';
import { bindLiveVaultHistoryStreamsWithRestHistory } from './vault-history-stream-binding.js';
import { bindMockOrderTrigger } from './mock-order-trigger.js';
import { bindNonceCancelPrepareTriggerWithLocalApiSmoke } from './nonce-cancel-prepare-binding.js';
import { bindOpenOrdersLocalApiSmoke } from './open-orders-binding.js';
import { bindLiveOpenOrdersStreamsWithRestOrders } from './open-orders-stream-binding.js';
import { bindVaultPrepareTriggerWithLocalApiSmoke } from './vault-prepare-binding.js';
import { mockVerticalSliceFixture } from './mock-vertical-fixture.js';
import { renderTradeProofPanel } from './render.js';

const mount = document.querySelector('[data-qdx-app]');

if (mount) {
  const baseUrl = mount.dataset.qdxStreamBaseUrl || globalThis.QDEX_STREAM_BASE_URL || 'http://127.0.0.1:8787';

  mount.innerHTML = renderTradeProofPanel(mockVerticalSliceFixture);

  const bindCommandPaletteFallback = () => bindCommandPaletteSkeleton({
    mount,
    palette: mockVerticalSliceFixture.commandPalette,
    onPreview: () => {
      mount.dataset.qdxCommandPalette = 'preview-only';
    },
    onError: (error) => {
      mount.dataset.qdxCommandPalette = 'error';
      console.warn('QDEX command palette preview failed safely; no wallet, RPC, signing, broadcast, transaction, or funds behavior was attempted.', error);
    },
  });

  try {
    bindCommandPaletteLocalApiSmoke({
      mount,
      baseUrl,
      palette: mockVerticalSliceFixture.commandPalette,
      onSmoke: () => {
        mount.dataset.qdxCommandPaletteLocalApiSmoke = 'terminal-command-palette-local-api-smoke';
      },
      onPreview: () => {
        mount.dataset.qdxCommandPalette = 'preview-only';
      },
      onError: (error) => {
        mount.dataset.qdxCommandPaletteLocalApiSmoke = 'error';
        console.warn('QDEX command-palette local API smoke failed safely; no wallet, RPC, signing, broadcast, transaction, or funds behavior was attempted.', error);
      },
    }).catch((error) => {
      mount.dataset.qdxCommandPaletteLocalApiSmoke = 'disabled';
      console.warn('QDEX command-palette local API smoke disabled; falling back to static preview-only command hints.', error);
      bindCommandPaletteFallback();
    });
  } catch (error) {
    mount.dataset.qdxCommandPaletteLocalApiSmoke = 'disabled';
    console.warn('QDEX command-palette local API smoke disabled; keeping static read-only/local mock command hints.', error);
    try {
      bindCommandPaletteFallback();
    } catch (fallbackError) {
      mount.dataset.qdxCommandPalette = 'disabled';
      console.warn('QDEX command palette skeleton disabled; keeping static read-only/local mock command hints.', fallbackError);
    }
  }

  try {
    bindKeyboardShortcutHelpLocalApiSmoke({
      mount,
      baseUrl,
      keyboardShortcuts: mockVerticalSliceFixture.keyboardShortcuts,
      onSmoke: () => {
        mount.dataset.qdxKeyboardShortcutLocalApiSmoke = 'terminal-keyboard-shortcut-help-local-api-smoke';
      },
      onHelpPreview: () => {
        mount.dataset.qdxKeyboardShortcutHelp = 'help-only';
      },
      onError: (error) => {
        mount.dataset.qdxKeyboardShortcutLocalApiSmoke = 'error';
        console.warn('QDEX keyboard-shortcut local API smoke failed safely; no wallet, RPC, signing, broadcast, transaction, or funds behavior was attempted.', error);
      },
    }).catch((error) => {
      mount.dataset.qdxKeyboardShortcutLocalApiSmoke = 'disabled';
      console.warn('QDEX keyboard-shortcut local API smoke disabled; keeping static help-only shortcut hints.', error);
    });
  } catch (error) {
    mount.dataset.qdxKeyboardShortcutLocalApiSmoke = 'disabled';
    console.warn('QDEX keyboard-shortcut local API smoke disabled; keeping static read-only/local mock shortcut hints.', error);
  }


  try {
    bindAccountOverviewLocalApiSmoke({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onAccountOverview: () => {
        mount.dataset.qdxAccountOverviewSmoke = 'mock-account-overview';
      },
      onError: (error) => {
        mount.dataset.qdxAccountOverviewSmoke = 'error';
        console.warn('QDEX account overview REST smoke failed; keeping static read-only fixture with no wallet, RPC, signing, broadcast, transaction, or funds behavior.', error);
      },
    }).catch((error) => {
      mount.dataset.qdxAccountOverviewSmoke = 'disabled';
      console.warn('QDEX account overview REST smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxAccountOverviewSmoke = 'disabled';
    console.warn('QDEX account overview REST smoke disabled; keeping static read-only fixture.', error);
  }

  try {
    bindMockOrderTrigger({
      mount,
      baseUrl,
      onError: (error) => {
        mount.dataset.qdxMockOrderTrigger = 'error';
        console.warn('QDEX mock order trigger failed; no real Quai transaction was attempted.', error);
      },
      onSmoke: () => {
        mount.dataset.qdxMockOrderTrigger = 'filled';
      },
    });
  } catch (error) {
    mount.dataset.qdxMockOrderTrigger = 'disabled';
    console.warn('QDEX mock order trigger disabled.', error);
  }

  try {
    bindMockCancelTriggerWithOrderStream({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onCancelError: (error) => {
        mount.dataset.qdxMockCancelTrigger = 'error';
        console.warn('QDEX mock cancel trigger failed; no on-chain nonce cancellation or real Quai transaction was attempted.', error);
      },
      onCancel: () => {
        mount.dataset.qdxMockCancelTrigger = 'cancelled';
      },
      onStreamError: (error) => {
        mount.dataset.qdxLiveOrdersStream = 'error';
        console.warn('QDEX live orders stream unavailable; keeping static mock fixture.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxLiveOrdersStream = 'orders';
      },
    });
  } catch (error) {
    mount.dataset.qdxMockCancelTrigger = 'disabled';
    mount.dataset.qdxLiveOrdersStream = 'disabled';
    console.warn('QDEX local cancel/order-stream smoke disabled.', error);
  }

  try {
    bindVaultPrepareTriggerWithLocalApiSmoke({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onError: (error) => {
        mount.dataset.qdxVaultPrepareTrigger = 'error';
        console.warn('QDEX vault prepare trigger failed; no wallet, RPC, signing, broadcast, transaction, or funds behavior was attempted.', error);
      },
      onPrepare: () => {
        mount.dataset.qdxVaultPrepareTrigger = 'prepare-only';
      },
    });
  } catch (error) {
    mount.dataset.qdxVaultPrepareTrigger = 'disabled';
    console.warn('QDEX vault prepare trigger disabled; keeping owner-wallet boundary prepare-only.', error);
  }

  try {
    bindDelegateKeyPrepareTriggerWithLocalApiSmoke({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onError: (error) => {
        mount.dataset.qdxDelegateKeyPrepareTrigger = 'error';
        console.warn('QDEX delegate/API key prepare trigger failed; no wallet, RPC, signing, broadcast, transaction, live DelegateKeyRegistry mutation, or funds behavior was attempted.', error);
      },
      onPrepare: () => {
        mount.dataset.qdxDelegateKeyPrepareTrigger = 'prepare-only';
      },
    });
  } catch (error) {
    mount.dataset.qdxDelegateKeyPrepareTrigger = 'disabled';
    console.warn('QDEX delegate/API key prepare trigger disabled; keeping owner-signed boundary prepare-only.', error);
  }

  try {
    bindNonceCancelPrepareTriggerWithLocalApiSmoke({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onError: (error) => {
        mount.dataset.qdxNonceCancelPrepareTrigger = 'error';
        console.warn('QDEX nonce cancel prepare trigger failed; no wallet, RPC, signing, broadcast, transaction, or funds behavior was attempted.', error);
      },
      onPrepare: () => {
        mount.dataset.qdxNonceCancelPrepareTrigger = 'prepare-only';
      },
    });
  } catch (error) {
    mount.dataset.qdxNonceCancelPrepareTrigger = 'disabled';
    console.warn('QDEX nonce cancel prepare trigger disabled; keeping owner-signed boundary prepare-only.', error);
  }

  try {
    bindOpenOrdersLocalApiSmoke({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onOrders: () => {
        mount.dataset.qdxOpenOrdersSmoke = 'mock-order-projection';
      },
      onError: (error) => {
        mount.dataset.qdxOpenOrdersSmoke = 'error';
        console.warn('QDEX open orders REST smoke failed; keeping static read-only fixture with no wallet, RPC, signing, broadcast, transaction, or funds behavior.', error);
      },
    }).catch((error) => {
      mount.dataset.qdxOpenOrdersSmoke = 'disabled';
      console.warn('QDEX open orders REST smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxOpenOrdersSmoke = 'disabled';
    console.warn('QDEX open orders REST smoke disabled; keeping static read-only fixture.', error);
  }

  try {
    bindLiveOpenOrdersStreamsWithRestOrders({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onRestError: (error) => {
        mount.dataset.qdxFillOpenOrdersRestSnapshot = 'error';
        console.warn('QDEX open orders REST snapshot unavailable; keeping static read-only fixture.', error);
      },
      onRestOrders: () => {
        mount.dataset.qdxFillOpenOrdersRestSnapshot = 'mock-order-projection';
      },
      onStreamError: (error) => {
        mount.dataset.qdxFillOpenOrdersStreams = 'error';
        console.warn('QDEX live open orders streams unavailable; keeping static read-only fixture.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxFillOpenOrdersStreams = 'open-orders';
      },
    }).catch((error) => {
      mount.dataset.qdxFillOpenOrdersStreams = 'disabled';
      console.warn('QDEX local open orders API/stream smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxFillOpenOrdersStreams = 'disabled';
    console.warn('QDEX live open orders streams disabled; keeping static read-only fixture.', error);
  }

  try {
    bindFeePolicyLocalApiSmoke({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onFeePolicy: () => {
        mount.dataset.qdxFeePolicySmoke = 'feemanager-policy-projection';
      },
      onError: (error) => {
        mount.dataset.qdxFeePolicySmoke = 'error';
        console.warn('QDEX FeeManager fee schedule REST smoke failed; keeping static read-only fixture with no fee-authority runtime keys.', error);
      },
    }).catch((error) => {
      mount.dataset.qdxFeePolicySmoke = 'disabled';
      console.warn('QDEX FeeManager fee schedule REST smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxFeePolicySmoke = 'disabled';
    console.warn('QDEX FeeManager fee schedule REST smoke disabled; keeping static read-only fixture.', error);
  }

  try {
    bindLiveFeePolicyStreamWithRestSnapshot({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onRestError: (error) => {
        mount.dataset.qdxFeePolicyRestSnapshot = 'error';
        console.warn('QDEX FeeManager fee schedule REST snapshot unavailable; keeping static read-only fixture with no fee-authority runtime keys.', error);
      },
      onRestSnapshot: () => {
        mount.dataset.qdxFeePolicyRestSnapshot = 'feemanager-policy-projection';
      },
      onStreamError: (error) => {
        mount.dataset.qdxFeePolicyStream = 'error';
        console.warn('QDEX live FeeManager fee schedule stream unavailable; keeping static read-only fixture with no fee-authority runtime keys.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxFeePolicyStream = 'fees';
      },
    }).catch((error) => {
      mount.dataset.qdxFeePolicyStream = 'disabled';
      console.warn('QDEX local FeeManager fee schedule API/stream smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxFeePolicyStream = 'disabled';
    console.warn('QDEX live FeeManager fee schedule stream disabled; keeping static read-only fixture.', error);
  }

  try {
    bindLiveKlineStreamWithRestSnapshot({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onRestError: (error) => {
        mount.dataset.qdxKlineRestSnapshot = 'error';
        console.warn('QDEX public kline/candle REST snapshot unavailable; keeping static read-only fixture with no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.', error);
      },
      onRestSnapshot: () => {
        mount.dataset.qdxKlineRestSnapshot = 'mock-candle-projection';
      },
      onStreamError: (error) => {
        mount.dataset.qdxKlineStream = 'error';
        console.warn('QDEX live public kline/candle stream unavailable; keeping static read-only fixture with no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxKlineStream = 'market.WQUAI-WQI.klines.1m';
      },
    }).catch((error) => {
      mount.dataset.qdxKlineStream = 'disabled';
      console.warn('QDEX local public kline/candle API/stream smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxKlineStream = 'disabled';
    console.warn('QDEX live public kline/candle stream disabled; keeping static read-only fixture.', error);
  }

  try {
    bindLivePublicMarketDataStreamsWithRestSnapshots({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onRestError: (error) => {
        mount.dataset.qdxPublicMarketDataRestSnapshots = 'error';
        console.warn('QDEX public market-data REST snapshots unavailable; keeping static read-only fixture with no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.', error);
      },
      onRestSnapshots: () => {
        mount.dataset.qdxPublicMarketDataRestSnapshots = 'mock-market-data,mock-orderbook,in-memory-indexer-projection';
      },
      onStreamError: (error) => {
        mount.dataset.qdxPublicMarketDataStreams = 'error';
        console.warn('QDEX live public market-data streams unavailable; keeping static read-only fixture with no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxPublicMarketDataStreams = 'global.tickers,market.WQUAI-WQI.depth,market.WQUAI-WQI.trades';
      },
    }).catch((error) => {
      mount.dataset.qdxPublicMarketDataStreams = 'disabled';
      console.warn('QDEX local public market-data API/stream smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxPublicMarketDataStreams = 'disabled';
    console.warn('QDEX live public market-data streams disabled; keeping static read-only fixture.', error);
  }

  try {
    bindDelegateKeyHistoryLocalApiSmoke({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onHistory: () => {
        mount.dataset.qdxDelegateKeyHistorySmoke = 'delegatekeyregistry-event-projection';
      },
      onError: (error) => {
        mount.dataset.qdxDelegateKeyHistorySmoke = 'error';
        console.warn('QDEX delegate/API key history REST smoke failed; keeping static read-only fixture with no live DelegateKeyRegistry mutation.', error);
      },
    }).catch((error) => {
      mount.dataset.qdxDelegateKeyHistorySmoke = 'disabled';
      console.warn('QDEX delegate/API key history REST smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxDelegateKeyHistorySmoke = 'disabled';
    console.warn('QDEX delegate/API key history REST smoke disabled; keeping static read-only fixture.', error);
  }

  try {
    bindLiveDelegateKeyHistoryStreamsWithRestHistory({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onRestError: (error) => {
        mount.dataset.qdxDelegateKeyHistoryRestSnapshot = 'error';
        console.warn('QDEX delegate/API key history REST snapshot unavailable; keeping static read-only fixture.', error);
      },
      onRestHistory: () => {
        mount.dataset.qdxDelegateKeyHistoryRestSnapshot = 'delegatekeyregistry-event-projection';
      },
      onStreamError: (error) => {
        mount.dataset.qdxDelegateKeyHistoryStreams = 'error';
        console.warn('QDEX live delegate/API key history streams unavailable; keeping static read-only fixture and no live DelegateKeyRegistry mutation.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxDelegateKeyHistoryStreams = 'delegate-key-registrations,delegate-key-revocations';
      },
    }).catch((error) => {
      mount.dataset.qdxDelegateKeyHistoryStreams = 'disabled';
      console.warn('QDEX local delegate/API key history API/stream smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxDelegateKeyHistoryStreams = 'disabled';
    console.warn('QDEX live delegate/API key history streams disabled; keeping static read-only fixture.', error);
  }

  try {
    bindLiveVaultHistoryStreamsWithRestHistory({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onRestError: (error) => {
        mount.dataset.qdxVaultHistoryRestSnapshot = 'error';
        console.warn('QDEX vault history REST snapshot unavailable; keeping static read-only fixture.', error);
      },
      onRestHistory: () => {
        mount.dataset.qdxVaultHistoryRestSnapshot = 'tradingvault-event-projection';
      },
      onStreamError: (error) => {
        mount.dataset.qdxVaultHistoryStreams = 'error';
        console.warn('QDEX live vault history streams unavailable; keeping static read-only fixture and no funds behavior.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxVaultHistoryStreams = 'deposits,withdrawals';
      },
    }).catch((error) => {
      mount.dataset.qdxVaultHistoryStreams = 'disabled';
      console.warn('QDEX local vault history API/stream smoke disabled; keeping static read-only fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxVaultHistoryStreams = 'disabled';
    console.warn('QDEX live vault history streams disabled; keeping static read-only fixture.', error);
  }

  try {
    bindLiveFillStream({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onError: (error) => {
        mount.dataset.qdxLiveStream = 'error';
        console.warn('QDEX live fills stream unavailable; keeping static mock fixture.', error);
      },
      onUpdate: () => {
        mount.dataset.qdxLiveStream = 'fills';
      },
    });
  } catch (error) {
    mount.dataset.qdxLiveStream = 'disabled';
    console.warn('QDEX live fills stream disabled; keeping static mock fixture.', error);
  }

  try {
    bindLiveBalanceStreamWithAccountSnapshot({
      mount,
      baseUrl,
      baseFixture: mockVerticalSliceFixture,
      render: renderTradeProofPanel,
      onRestError: (error) => {
        mount.dataset.qdxBalanceRestSnapshot = 'error';
        console.warn('QDEX account balance snapshot unavailable; keeping static mock fixture.', error);
      },
      onStreamError: (error) => {
        mount.dataset.qdxLiveBalancesStream = 'error';
        console.warn('QDEX live balances stream unavailable; keeping static mock fixture.', error);
      },
      onStreamUpdate: () => {
        mount.dataset.qdxLiveBalancesStream = 'balances';
      },
    }).catch((error) => {
      mount.dataset.qdxLiveBalancesStream = 'disabled';
      console.warn('QDEX local balances API/stream smoke disabled; keeping static mock fixture.', error);
    });
  } catch (error) {
    mount.dataset.qdxLiveBalancesStream = 'disabled';
    console.warn('QDEX live balances stream disabled; keeping static mock fixture.', error);
  }
}
