import { createMockAccountOverviewFixture } from './account-overview-panel.js';
import { createMockCommandPaletteFixture } from './command-palette.js';
import { createMockDelegateKeyHistoryFixture } from './delegate-key-history-panel.js';
import { createMockFeePolicyFixture } from './fee-policy-panel.js';
import { createMockFillHistoryFixture } from './fill-history-panel.js';
import { createMockKeyboardShortcutHelpFixture } from './keyboard-shortcuts.js';
import { createMockKlineFixture } from './kline-panel.js';
import { createMockNonceCancelPrepareFixture } from './nonce-cancel-prepare-panel.js';
import { createMockNonceCancellationHistoryFixture } from './nonce-cancellation-history-panel.js';
import { createMockOpenOrdersFixture } from './open-orders-panel.js';
import { createMockVaultHistoryFixture } from './vault-history-panel.js';

export const mockVerticalSliceFixture = Object.freeze({
  sources: Object.freeze({
    fills: 'in-memory-indexer-projection',
    trades: 'in-memory-indexer-projection',
    proof: 'proof-service-indexer-projection',
  }),
  market: Object.freeze({
    id: 'WQUAI-WQI',
    base: 'WQUAI',
    quote: 'WQI',
    custodyModel: 'contract-vault-non-custodial',
    settlementMode: 'mock',
  }),
  orderbook: Object.freeze({
    sequence: 2,
    bids: Object.freeze([]),
    asks: Object.freeze([]),
    source: 'mock-orderbook',
  }),
  fill: Object.freeze({
    projectionType: 'IndexedFillProjection',
    fillId: 'fill-000001',
    tradeId: 'trade-000001',
    marketId: 'WQUAI-WQI',
    makerOrderHash: '0xf45d2ec6a81b3f2c0d5ef6cce6e5a6fca1d0a41efb8a355827ac4e356d36c7c7',
    takerOrderHash: '0x7859c9d616c70f7cab6cfcb39f506730f60a1df0b35054d0ef684532b26c5b6a',
    maker: '0x1111111111111111111111111111111111111111',
    taker: '0x3333333333333333333333333333333333333333',
    price: '5',
    amount: '100',
    makerFee: '0',
    takerFee: '0',
    settlementMode: 'mock',
    settlementStatus: 'confirmed',
    sourceEventId: 'event-000001',
  }),
  trade: Object.freeze({
    tradeId: 'trade-000001',
    fillId: 'fill-000001',
    marketId: 'WQUAI-WQI',
    price: '5',
    amount: '100',
    settlementStatus: 'confirmed',
    proofUrl: '/v1/proofs/trades/trade-000001',
  }),
  proof: Object.freeze({
    tradeId: 'trade-000001',
    fillId: 'fill-000001',
    orderHashes: Object.freeze([
      '0xf45d2ec6a81b3f2c0d5ef6cce6e5a6fca1d0a41efb8a355827ac4e356d36c7c7',
      '0x7859c9d616c70f7cab6cfcb39f506730f60a1df0b35054d0ef684532b26c5b6a',
    ]),
    settlementMode: 'mock',
    mockSettlementReference: 'mock-settlement-fill-000001',
    settlementTx: null,
    blockNumber: null,
    blockHash: null,
    eventIndex: 0,
    maker: '0x1111111111111111111111111111111111111111',
    taker: '0x3333333333333333333333333333333333333333',
    market: 'WQUAI-WQI',
    price: '5',
    amount: '100',
    fees: Object.freeze({
      maker: '0',
      taker: '0',
    }),
    explorerUrl: null,
    safetyNotice: 'Mock proof only: no real Quai transaction, no explorer URL, no funds moved.',
    rawEvent: Object.freeze({
      eventId: 'event-000001',
      type: 'SETTLEMENT_CONFIRMED',
      source: 'mock-settlement',
      fillId: 'fill-000001',
      settlementMode: 'mock',
      mockSettlementReference: 'mock-settlement-fill-000001',
      settlementTx: null,
      blockNumber: null,
      blockHash: null,
      eventIndex: 0,
    }),
    createdFromEventId: 'event-000001',
  }),
  accountOverview: createMockAccountOverviewFixture(),
  commandPalette: createMockCommandPaletteFixture(),
  keyboardShortcuts: createMockKeyboardShortcutHelpFixture(),
  vaultHistory: createMockVaultHistoryFixture(),
  delegateKeyHistory: createMockDelegateKeyHistoryFixture(),
  feePolicy: createMockFeePolicyFixture(),
  klines: createMockKlineFixture(),
  nonceCancelPrepare: createMockNonceCancelPrepareFixture(),
  nonceCancellationHistory: createMockNonceCancellationHistoryFixture(),
  openOrders: createMockOpenOrdersFixture(),
  fillHistory: createMockFillHistoryFixture(),
  custody: Object.freeze({
    note: 'non-custodial-no-withdrawal-authority',
    withdrawalAuthority: 'owner-wallet-only',
  }),
});
