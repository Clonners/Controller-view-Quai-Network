const SAFE_PERMISSIONS = Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']);

const DEFAULT_SAFETY = Object.freeze({
  notice: 'Display-only terminal keyboard-shortcut help for read-only/local mock actions: no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.',
  noWalletLoading: true,
  noRpcUrlAccess: true,
  noSigning: true,
  noBroadcast: true,
  noDeploys: true,
  noTransactionSubmission: true,
  noFundsMovement: true,
  noCustodyAuthority: true,
});

const HELP_ONLY_DEFAULTS = Object.freeze({
  source: 'terminal-keyboard-shortcut-help',
  mode: 'local-ui-help-only',
  dispatchMode: 'help-only-no-dispatch',
  custody: 'non-custodial-no-withdrawal-authority',
  permissions: SAFE_PERMISSIONS,
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  marketRegistryMutation: false,
  delegateKeyRegistryMutation: false,
  feeManagerMutation: false,
  nonceManagerMutation: false,
  delegateCanWithdraw: false,
  delegateCanAdmin: false,
  safetyNotice: DEFAULT_SAFETY.notice,
});

const freezeHelpEntry = (entry) => {
  const merged = {
    ...HELP_ONLY_DEFAULTS,
    ...entry,
  };

  return Object.freeze({
    ...merged,
    permissions: Object.freeze([...(entry.permissions ?? SAFE_PERMISSIONS)]),
  });
};

const DEFAULT_SHORTCUTS = Object.freeze([
  freezeHelpEntry({
    key: '/',
    label: 'search market',
    actionType: 'read_only_help',
    surface: 'local market search focus hint',
    description: 'Help-only hint for focusing market search; it does not fetch, dispatch, sign, or move funds.',
  }),
  freezeHelpEntry({
    key: 'b',
    label: 'buy preview',
    actionType: 'local_mock_help',
    surface: ':mock cross / market_ioc signed-slippage preview',
    description: 'Help-only hint for local/mock buy flow preview; market_ioc remains an IOC limit order with signed slippage bounds.',
  }),
  freezeHelpEntry({
    key: 's',
    label: 'sell preview',
    actionType: 'local_mock_help',
    surface: ':mock cross / resting GTC sell preview',
    description: 'Help-only hint for local/mock sell flow preview; no order is sent by the keyboard help panel.',
  }),
  freezeHelpEntry({
    key: 'c',
    label: 'matcher-local cancel',
    actionType: 'local_mock_help',
    surface: ':cancel all matcher-local',
    description: 'Help-only hint for matcher-local cancellation copy; no cancel request is dispatched by this panel.',
    safetyNotice: 'Matcher-local cancellation does not mutate on-chain NonceManager nonces and does not move funds.',
  }),
  freezeHelpEntry({
    key: 'o',
    label: 'open orders',
    actionType: 'read_only_help',
    surface: 'GET /v1/account / private orders stream hint',
    description: 'Help-only hint for read-only account/open-order panels with NO_WITHDRAW and NO_ADMIN.',
  }),
  freezeHelpEntry({
    key: 'w',
    label: 'owner-wallet prepare boundaries',
    actionType: 'prepare_only_help',
    surface: 'POST /v1/vault/deposits/prepare / POST /v1/vault/withdrawals/prepare',
    description: 'Help-only hint for owner-wallet prepare boundaries; delegates cannot deposit or withdraw by default.',
    safetyNotice: 'Prepare-only owner-wallet boundary: no wallet is loaded, no signature is created, no broadcast is sent, and no funds move.',
  }),
  freezeHelpEntry({
    key: '?',
    label: 'help',
    actionType: 'read_only_help',
    surface: 'terminal keyboard-shortcut help panel',
    description: 'Help-only panel for read-only/local mock keyboard hints.',
  }),
]);

const DEFAULT_COMMAND_HINTS = Object.freeze([
  freezeHelpEntry({
    command: ':markets',
    label: 'markets',
    actionType: 'read_only_help',
    surface: 'GET /v1/markets',
    description: 'Read-only public market metadata hint.',
  }),
  freezeHelpEntry({
    command: ':book WQUAI-WQI',
    label: 'book',
    actionType: 'read_only_help',
    surface: 'GET /v1/orderbook/WQUAI-WQI',
    description: 'Read-only mock orderbook hint.',
  }),
  freezeHelpEntry({
    command: ':mock cross',
    label: 'mock cross',
    actionType: 'local_mock_help',
    surface: 'existing data-qdx-trigger-cross browser button',
    description: 'Help-only hint for the local/dev crossed-order smoke action.',
    safetyNotice: 'Local mock command hint only: signed mock orders and mock settlement stay local; no real Quai transaction, no explorer URL, no funds moved.',
  }),
  freezeHelpEntry({
    command: ':cancel all matcher-local',
    label: 'matcher-local cancel all',
    actionType: 'local_mock_help',
    surface: 'matcher-local cancellation placeholder',
    description: 'Help-only hint for matcher-local cancel-all wording.',
    safetyNotice: 'Matcher-local cancellation does not mutate on-chain NonceManager nonces and does not move funds.',
  }),
  freezeHelpEntry({
    command: ':deposit WQI 10 prepare owner-wallet-only',
    label: 'prepare deposit',
    actionType: 'prepare_only_help',
    surface: 'POST /v1/vault/deposits/prepare',
    description: 'Help-only hint for owner-wallet-only TradingVault deposit prepare boundary.',
    safetyNotice: 'Prepare-only hint: delegates cannot deposit or withdraw; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.',
  }),
  freezeHelpEntry({
    command: ':api create-key bot-mm-1 prepare NO_WITHDRAW NO_ADMIN',
    label: 'prepare delegate/API key',
    actionType: 'prepare_only_help',
    surface: 'POST /v1/delegate-keys',
    description: 'Help-only hint for owner-signed delegate/API key registration boundary with NO_WITHDRAW and NO_ADMIN.',
    safetyNotice: 'Prepare-only hint: owner-wallet-signature-required, delegateCanWithdraw false, delegateCanAdmin false, no live DelegateKeyRegistry mutation.',
  }),
]);

const normalizeShortcut = (shortcut) => freezeHelpEntry({
  ...shortcut,
  key: String(shortcut.key ?? ''),
});

const normalizeCommandHint = (hint) => freezeHelpEntry({
  ...hint,
  command: String(hint.command ?? ''),
});

export const createMockKeyboardShortcutHelpFixture = () => Object.freeze({
  source: 'terminal-keyboard-shortcut-help',
  mode: 'local-ui-help-only',
  dispatchMode: 'help-only-no-dispatch',
  panelTrigger: '?',
  custody: 'non-custodial-no-withdrawal-authority',
  permissions: SAFE_PERMISSIONS,
  shortcuts: DEFAULT_SHORTCUTS,
  commandHints: DEFAULT_COMMAND_HINTS,
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  marketRegistryMutation: false,
  delegateKeyRegistryMutation: false,
  feeManagerMutation: false,
  nonceManagerMutation: false,
  delegateCanWithdraw: false,
  delegateCanAdmin: false,
  safety: DEFAULT_SAFETY,
});

export const normalizeKeyboardShortcutHelpFixture = (fixture = {}) => {
  const fallback = createMockKeyboardShortcutHelpFixture();
  const shortcuts = (fixture.shortcuts ?? fallback.shortcuts).map(normalizeShortcut);
  const commandHints = (fixture.commandHints ?? fallback.commandHints).map(normalizeCommandHint);

  return Object.freeze({
    source: fixture.source ?? fallback.source,
    mode: fixture.mode ?? fallback.mode,
    dispatchMode: fixture.dispatchMode ?? fallback.dispatchMode,
    panelTrigger: fixture.panelTrigger ?? fallback.panelTrigger,
    custody: fixture.custody ?? fallback.custody,
    permissions: Object.freeze([...(fixture.permissions ?? fallback.permissions)]),
    shortcuts: Object.freeze(shortcuts),
    commandHints: Object.freeze(commandHints),
    realQuaiTransactions: fixture.realQuaiTransactions ?? fallback.realQuaiTransactions,
    walletRequired: fixture.walletRequired ?? fallback.walletRequired,
    fundsMoved: fixture.fundsMoved ?? fallback.fundsMoved,
    tradingVaultMutation: fixture.tradingVaultMutation ?? fallback.tradingVaultMutation,
    marketRegistryMutation: fixture.marketRegistryMutation ?? fallback.marketRegistryMutation,
    delegateKeyRegistryMutation: fixture.delegateKeyRegistryMutation ?? fallback.delegateKeyRegistryMutation,
    feeManagerMutation: fixture.feeManagerMutation ?? fallback.feeManagerMutation,
    nonceManagerMutation: fixture.nonceManagerMutation ?? fallback.nonceManagerMutation,
    delegateCanWithdraw: fixture.delegateCanWithdraw ?? fallback.delegateCanWithdraw,
    delegateCanAdmin: fixture.delegateCanAdmin ?? fallback.delegateCanAdmin,
    safety: Object.freeze({
      ...fallback.safety,
      ...(fixture.safety ?? {}),
    }),
  });
};
