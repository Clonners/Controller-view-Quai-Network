const SAFE_PERMISSIONS = Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']);

const DEFAULT_SAFETY = Object.freeze({
  notice: 'Display-only command palette skeleton for read-only/local mock actions: no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.',
  noWalletLoading: true,
  noRpcUrlAccess: true,
  noSigning: true,
  noBroadcast: true,
  noDeploys: true,
  noTransactionSubmission: true,
  noFundsMovement: true,
  noCustodyAuthority: true,
});

const freezeCommand = (command) => Object.freeze({
  source: 'terminal-command-palette-skeleton',
  mode: 'local-ui-preview-only',
  dispatchMode: 'preview-only-no-dispatch',
  custody: 'non-custodial-no-withdrawal-authority',
  permissions: SAFE_PERMISSIONS,
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  marketRegistryMutation: false,
  delegateKeyRegistryMutation: false,
  nonceManagerMutation: false,
  delegateCanWithdraw: false,
  delegateCanAdmin: false,
  safetyNotice: DEFAULT_SAFETY.notice,
  ...command,
});

const DEFAULT_COMMANDS = Object.freeze([
  freezeCommand({
    command: ':markets',
    label: 'markets',
    actionType: 'read_only',
    surface: 'GET /v1/markets',
    description: 'Preview public market metadata without wallet or custody authority.',
  }),
  freezeCommand({
    command: ':ticker WQUAI-WQI',
    label: 'ticker',
    actionType: 'read_only',
    surface: 'GET /v1/tickers/WQUAI-WQI',
    description: 'Preview public ticker metadata for the mock WQUAI-WQI market.',
  }),
  freezeCommand({
    command: ':book WQUAI-WQI',
    label: 'book',
    actionType: 'read_only',
    surface: 'GET /v1/orderbook/WQUAI-WQI',
    description: 'Preview public mock orderbook depth without custody authority.',
  }),
  freezeCommand({
    command: ':proof trade-000001',
    label: 'proof',
    actionType: 'read_only',
    surface: 'GET /v1/proofs/trades/trade-000001',
    description: 'Preview proof-service/indexer mock proof metadata only.',
  }),
  freezeCommand({
    command: ':balance',
    label: 'balance',
    actionType: 'read_only',
    surface: 'GET /v1/account/balances',
    description: 'Preview read-only mock-vault balance projection.',
  }),
  freezeCommand({
    command: ':account',
    label: 'account',
    actionType: 'read_only',
    surface: 'GET /v1/account',
    description: 'Preview local no-wallet account overview projection.',
  }),
  freezeCommand({
    command: ':fees',
    label: 'fees',
    actionType: 'read_only',
    surface: 'GET /v1/fees',
    description: 'Preview read-only FeeManager fee schedule projection.',
  }),
  freezeCommand({
    command: ':stream tickers',
    label: 'stream tickers',
    actionType: 'read_only',
    surface: '/v1/ws?channel=global.tickers',
    description: 'Preview public ticker stream intent; no WebSocket is opened by the skeleton.',
  }),
  freezeCommand({
    command: ':mock cross',
    label: 'mock cross',
    actionType: 'local_mock',
    surface: 'existing data-qdx-trigger-cross browser button',
    description: 'Preview the local/dev crossed-order smoke action without dispatching it from the palette.',
    safetyNotice: 'Local mock command preview only: signed mock orders and mock settlement stay local; no real Quai transaction, no explorer URL, no funds moved.',
  }),
  freezeCommand({
    command: ':cancel all matcher-local',
    label: 'matcher-local cancel all',
    actionType: 'local_mock',
    surface: 'matcher-local cancellation placeholder',
    description: 'Preview matcher-local cancel-all wording only; no cancellation request is sent by the skeleton.',
    safetyNotice: 'Preview only: matcher-local cancellation does not mutate on-chain NonceManager nonces and does not move funds.',
  }),
  freezeCommand({
    command: ':deposit WQI 10 prepare owner-wallet-only',
    label: 'prepare deposit',
    actionType: 'prepare_only',
    surface: 'POST /v1/vault/deposits/prepare',
    description: 'Preview owner-wallet-only TradingVault deposit prepare boundary.',
    safetyNotice: 'Prepare-only command preview: delegates cannot deposit or withdraw; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.',
  }),
  freezeCommand({
    command: ':api create-key bot-mm-1 prepare NO_WITHDRAW NO_ADMIN',
    label: 'prepare delegate/API key',
    actionType: 'prepare_only',
    surface: 'POST /v1/delegate-keys',
    description: 'Preview owner-signed delegate/API key registration boundary with NO_WITHDRAW and NO_ADMIN.',
    safetyNotice: 'Prepare-only command preview: owner-wallet-signature-required, delegateCanWithdraw false, delegateCanAdmin false, no live DelegateKeyRegistry mutation.',
  }),
]);

const normalizeCommand = (command) => freezeCommand({
  ...command,
  permissions: Object.freeze([...(command.permissions ?? SAFE_PERMISSIONS)]),
});

export const createMockCommandPaletteFixture = () => Object.freeze({
  source: 'terminal-command-palette-skeleton',
  mode: 'local-ui-preview-only',
  dispatchMode: 'preview-only-no-dispatch',
  custody: 'non-custodial-no-withdrawal-authority',
  permissions: SAFE_PERMISSIONS,
  commands: DEFAULT_COMMANDS,
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  marketRegistryMutation: false,
  delegateKeyRegistryMutation: false,
  delegateCanWithdraw: false,
  delegateCanAdmin: false,
  safety: DEFAULT_SAFETY,
});

export const normalizeCommandPaletteFixture = (fixture = {}) => {
  const fallback = createMockCommandPaletteFixture();
  const commands = (fixture.commands ?? fallback.commands).map(normalizeCommand);

  return Object.freeze({
    source: fixture.source ?? fallback.source,
    mode: fixture.mode ?? fallback.mode,
    dispatchMode: fixture.dispatchMode ?? fallback.dispatchMode,
    custody: fixture.custody ?? fallback.custody,
    permissions: Object.freeze([...(fixture.permissions ?? fallback.permissions)]),
    commands: Object.freeze(commands),
    realQuaiTransactions: fixture.realQuaiTransactions ?? fallback.realQuaiTransactions,
    walletRequired: fixture.walletRequired ?? fallback.walletRequired,
    fundsMoved: fixture.fundsMoved ?? fallback.fundsMoved,
    tradingVaultMutation: fixture.tradingVaultMutation ?? fallback.tradingVaultMutation,
    marketRegistryMutation: fixture.marketRegistryMutation ?? fallback.marketRegistryMutation,
    delegateKeyRegistryMutation: fixture.delegateKeyRegistryMutation ?? fallback.delegateKeyRegistryMutation,
    delegateCanWithdraw: fixture.delegateCanWithdraw ?? fallback.delegateCanWithdraw,
    delegateCanAdmin: fixture.delegateCanAdmin ?? fallback.delegateCanAdmin,
    safety: Object.freeze({
      ...fallback.safety,
      ...(fixture.safety ?? {}),
    }),
  });
};

export const previewCommandPaletteInput = (input, fixture = createMockCommandPaletteFixture()) => {
  const palette = normalizeCommandPaletteFixture(fixture);
  const normalizedInput = String(input ?? '').trim().replace(/\s+/g, ' ');
  const command = palette.commands.find((candidate) => candidate.command === normalizedInput);

  if (command === undefined) {
    return Object.freeze({
      status: 'unsupported',
      command: normalizedInput,
      source: palette.source,
      mode: palette.mode,
      dispatchMode: 'blocked-no-dispatch',
      custody: palette.custody,
      permissions: palette.permissions,
      realQuaiTransactions: false,
      walletRequired: false,
      fundsMoved: false,
      tradingVaultMutation: false,
      marketRegistryMutation: false,
      delegateKeyRegistryMutation: false,
      delegateCanWithdraw: false,
      delegateCanAdmin: false,
      message: `${normalizedInput || '(empty command)'} is not enabled in the local command-palette skeleton; blocked-no-dispatch with READ_ONLY/NO_WITHDRAW/NO_ADMIN and no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.`,
    });
  }

  return Object.freeze({
    status: 'matched',
    command: command.command,
    label: command.label,
    actionType: command.actionType,
    surface: command.surface,
    source: palette.source,
    mode: palette.mode,
    dispatchMode: command.dispatchMode,
    custody: command.custody,
    permissions: command.permissions,
    realQuaiTransactions: command.realQuaiTransactions,
    walletRequired: command.walletRequired,
    fundsMoved: command.fundsMoved,
    tradingVaultMutation: command.tradingVaultMutation,
    marketRegistryMutation: command.marketRegistryMutation,
    delegateKeyRegistryMutation: command.delegateKeyRegistryMutation,
    delegateCanWithdraw: command.delegateCanWithdraw,
    delegateCanAdmin: command.delegateCanAdmin,
    safetyNotice: command.safetyNotice,
    message: `${command.command} preview-only (${command.actionType}) for ${command.surface}; ${command.safetyNotice}`,
  });
};

export const bindCommandPaletteSkeleton = ({
  mount,
  palette = createMockCommandPaletteFixture(),
  onPreview = () => {},
  onError = () => {},
} = {}) => {
  if (mount === undefined || mount === null || typeof mount.querySelector !== 'function') {
    throw new TypeError('bindCommandPaletteSkeleton requires a mount with querySelector.');
  }

  const form = mount.querySelector('[data-qdx-command-palette-form]');
  const input = mount.querySelector('[data-qdx-command-palette-input]');
  const statusNode = mount.querySelector('[data-qdx-command-palette-status]');

  if (form === undefined || form === null || typeof form.addEventListener !== 'function') {
    throw new TypeError('bindCommandPaletteSkeleton requires a command palette form.');
  }
  if (input === undefined || input === null) {
    throw new TypeError('bindCommandPaletteSkeleton requires a command palette input.');
  }

  const handleSubmit = (event) => {
    event?.preventDefault?.();

    try {
      const preview = previewCommandPaletteInput(input.value, palette);
      mount.dataset.qdxCommandPalette = preview.status === 'matched' ? 'preview-only' : 'unsupported';
      if (statusNode !== undefined && statusNode !== null) {
        statusNode.dataset.qdxCommandPaletteStatus = preview.status === 'matched' ? 'preview-only' : 'unsupported';
        statusNode.textContent = `${preview.command}: ${preview.message} permissions READ_ONLY/NO_WITHDRAW/NO_ADMIN; ${preview.dispatchMode}; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.`;
      }
      onPreview(preview);
    } catch (error) {
      mount.dataset.qdxCommandPalette = 'error';
      if (statusNode !== undefined && statusNode !== null) {
        statusNode.dataset.qdxCommandPaletteStatus = 'error';
        statusNode.textContent = `Command palette preview failed safely; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior. ${error.message}`;
      }
      onError(error);
    }
  };

  form.addEventListener('submit', handleSubmit);

  return Object.freeze({
    close() {
      form.removeEventListener?.('submit', handleSubmit);
    },
  });
};
