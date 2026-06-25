const DELEGATE_KEY_HISTORY_SAFETY = Object.freeze({
  source: 'delegatekeyregistry-event-projection',
  custody: 'non-custodial-no-withdrawal-authority',
  permissions: Object.freeze(['READ_ONLY', 'NO_WITHDRAW', 'NO_ADMIN']),
  settlementMode: 'mock',
  settlementTx: null,
  blockNumber: null,
  blockHash: null,
  eventIndex: null,
  explorerUrl: null,
  delegateCanWithdraw: false,
  delegateCanAdmin: false,
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  delegateKeyRegistryMutation: false,
});

const DELEGATE_KEY_HISTORY_CONFIG = Object.freeze({
  registration: Object.freeze({
    collection: 'registrations',
    projectionType: 'DelegateKeyRegisteredProjection',
    eventName: 'DelegateKeyRegistered',
  }),
  revocation: Object.freeze({
    collection: 'revocations',
    projectionType: 'DelegateKeyRevokedProjection',
    eventName: 'DelegateKeyRevoked',
  }),
});

const freezeRows = (rows = []) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

const safetyNoticeFor = (eventName) => (
  `Read-only DelegateKeyRegistry ${eventName} history projection: mock rows have no real Quai transaction, no wallet loaded, no live DelegateKeyRegistry mutation, no funds moved, and no delegate withdrawal/admin authority.`
);

const configFor = (operation) => {
  const config = DELEGATE_KEY_HISTORY_CONFIG[operation];
  if (config === undefined) {
    throw new Error(`Unsupported delegate-key history operation: ${operation}`);
  }
  return config;
};

const createHistoryEnvelope = (operation, rows = []) => {
  const config = configFor(operation);

  return Object.freeze({
    [config.collection]: freezeRows(rows),
    ...DELEGATE_KEY_HISTORY_SAFETY,
    permissions: [...DELEGATE_KEY_HISTORY_SAFETY.permissions],
    projectionType: config.projectionType,
    eventName: config.eventName,
    safetyNotice: safetyNoticeFor(config.eventName),
  });
};

const normalizeEnvelope = (operation, envelope = {}) => {
  const config = configFor(operation);
  const rows = envelope[config.collection] ?? [];

  return Object.freeze({
    [config.collection]: freezeRows(rows),
    source: envelope.source ?? DELEGATE_KEY_HISTORY_SAFETY.source,
    projectionType: envelope.projectionType ?? config.projectionType,
    eventName: envelope.eventName ?? config.eventName,
    custody: envelope.custody ?? DELEGATE_KEY_HISTORY_SAFETY.custody,
    permissions: [...(envelope.permissions ?? DELEGATE_KEY_HISTORY_SAFETY.permissions)],
    settlementMode: envelope.settlementMode ?? DELEGATE_KEY_HISTORY_SAFETY.settlementMode,
    settlementTx: envelope.settlementTx ?? null,
    blockNumber: envelope.blockNumber ?? null,
    blockHash: envelope.blockHash ?? null,
    eventIndex: envelope.eventIndex ?? null,
    explorerUrl: envelope.explorerUrl ?? null,
    delegateCanWithdraw: envelope.delegateCanWithdraw ?? false,
    delegateCanAdmin: envelope.delegateCanAdmin ?? false,
    realQuaiTransactions: envelope.realQuaiTransactions ?? false,
    walletRequired: envelope.walletRequired ?? false,
    fundsMoved: envelope.fundsMoved ?? false,
    tradingVaultMutation: envelope.tradingVaultMutation ?? false,
    delegateKeyRegistryMutation: envelope.delegateKeyRegistryMutation ?? false,
    safetyNotice: envelope.safetyNotice ?? safetyNoticeFor(config.eventName),
  });
};

export const createMockDelegateKeyHistoryFixture = () => Object.freeze({
  registrations: createHistoryEnvelope('registration'),
  revocations: createHistoryEnvelope('revocation'),
});

export const normalizeDelegateKeyHistoryPanelFixture = (
  delegateKeyHistory = createMockDelegateKeyHistoryFixture(),
) => Object.freeze({
  registrations: normalizeEnvelope('registration', delegateKeyHistory.registrations),
  revocations: normalizeEnvelope('revocation', delegateKeyHistory.revocations),
});
