const NONCE_CANCEL_PREPARE_SAFETY = Object.freeze({
  source: 'owner-signed-nonce-cancel-placeholder',
  custody: 'non-custodial',
  nonceManager: 'owner-signed-required',
  permissions: Object.freeze(['NO_WITHDRAW', 'NO_ADMIN']),
  realQuaiTransactions: false,
  walletRequired: false,
  fundsMoved: false,
  tradingVaultMutation: false,
  nonceManagerMutation: false,
  approvalGate: 'explicit-approval-required-before-wallet-signing-or-quai-broadcast',
});

const NONCE_CANCEL_OPERATION_CONFIG = Object.freeze({
  cancelNonce: Object.freeze({
    action: 'cancelNonce',
    statusLabel: 'cancel nonce',
  }),
  cancelNonceRange: Object.freeze({
    action: 'cancelNonceRange',
    statusLabel: 'cancel nonce range',
  }),
});

const DEFAULT_SAFETY = Object.freeze({
  noWalletLoading: true,
  noRpcUrlAccess: true,
  noSigning: true,
  noBroadcast: true,
  noDeploys: true,
  noTransactionSubmission: true,
  noFundsMovement: true,
  notice:
    'Prepare-only nonce cancellation boundary: no real Quai transaction, no wallet loaded, no NonceManager mutation, no funds moved, and no delegate withdrawal/admin authority.',
});

const normalizeSafety = (safety = {}) => Object.freeze({
  ...DEFAULT_SAFETY,
  ...safety,
});

const createPrepareEnvelope = (operation) => {
  const config = NONCE_CANCEL_OPERATION_CONFIG[operation];
  if (config === undefined) {
    throw new Error(`Unsupported nonce cancel prepare operation: ${operation}`);
  }

  return Object.freeze({
    operation,
    httpStatus: 501,
    error: 'owner_signed_nonce_cancel_not_implemented',
    source: NONCE_CANCEL_PREPARE_SAFETY.source,
    custody: NONCE_CANCEL_PREPARE_SAFETY.custody,
    nonceManager: NONCE_CANCEL_PREPARE_SAFETY.nonceManager,
    permissions: [...NONCE_CANCEL_PREPARE_SAFETY.permissions],
    realQuaiTransactions: NONCE_CANCEL_PREPARE_SAFETY.realQuaiTransactions,
    walletRequired: NONCE_CANCEL_PREPARE_SAFETY.walletRequired,
    fundsMoved: NONCE_CANCEL_PREPARE_SAFETY.fundsMoved,
    tradingVaultMutation: NONCE_CANCEL_PREPARE_SAFETY.tradingVaultMutation,
    nonceManagerMutation: NONCE_CANCEL_PREPARE_SAFETY.nonceManagerMutation,
    approvalGate: NONCE_CANCEL_PREPARE_SAFETY.approvalGate,
    message: 'This operation does not mutate on-chain NonceManager nonces; owner wallet signature required to proceed.',
    safetyNotice: DEFAULT_SAFETY.notice,
  });
};

const normalizePrepareEnvelope = (operation, envelope = {}) => {
  const config = NONCE_CANCEL_OPERATION_CONFIG[operation];

  return Object.freeze({
    operation: envelope.operation ?? operation,
    httpStatus: envelope.httpStatus ?? 501,
    error: envelope.error ?? 'owner_signed_nonce_cancel_not_implemented',
    source: envelope.source ?? NONCE_CANCEL_PREPARE_SAFETY.source,
    custody: envelope.custody ?? NONCE_CANCEL_PREPARE_SAFETY.custody,
    nonceManager: envelope.nonceManager ?? NONCE_CANCEL_PREPARE_SAFETY.nonceManager,
    permissions: [...(envelope.permissions ?? NONCE_CANCEL_PREPARE_SAFETY.permissions)],
    realQuaiTransactions: envelope.realQuaiTransactions ?? false,
    walletRequired: envelope.walletRequired ?? false,
    fundsMoved: envelope.fundsMoved ?? false,
    tradingVaultMutation: envelope.tradingVaultMutation ?? false,
    nonceManagerMutation: envelope.nonceManagerMutation ?? false,
    approvalGate: envelope.approvalGate ?? NONCE_CANCEL_PREPARE_SAFETY.approvalGate,
    message: envelope.message ?? 'This operation does not mutate on-chain NonceManager nonces; owner wallet signature required to proceed.',
    safetyNotice: envelope.safetyNotice ?? DEFAULT_SAFETY.notice,
    safety: normalizeSafety(envelope.safety),
  });
};

export const createMockNonceCancelPrepareFixture = () => Object.freeze({
  cancelNonce: createPrepareEnvelope('cancelNonce'),
  cancelNonceRange: createPrepareEnvelope('cancelNonceRange'),
  ...NONCE_CANCEL_PREPARE_SAFETY,
  permissions: [...NONCE_CANCEL_PREPARE_SAFETY.permissions],
  safety: normalizeSafety(),
});

export const normalizeNonceCancelPreparePanelFixture = (nonceCancelPrepare = createMockNonceCancelPrepareFixture()) => Object.freeze({
  cancelNonce: normalizePrepareEnvelope('cancelNonce', nonceCancelPrepare.cancelNonce),
  cancelNonceRange: normalizePrepareEnvelope('cancelNonceRange', nonceCancelPrepare.cancelNonceRange),
  source: nonceCancelPrepare.source ?? NONCE_CANCEL_PREPARE_SAFETY.source,
  custody: nonceCancelPrepare.custody ?? NONCE_CANCEL_PREPARE_SAFETY.custody,
  nonceManager: nonceCancelPrepare.nonceManager ?? NONCE_CANCEL_PREPARE_SAFETY.nonceManager,
  permissions: [...(nonceCancelPrepare.permissions ?? NONCE_CANCEL_PREPARE_SAFETY.permissions)],
  realQuaiTransactions: nonceCancelPrepare.realQuaiTransactions ?? false,
  walletRequired: nonceCancelPrepare.walletRequired ?? false,
  fundsMoved: nonceCancelPrepare.fundsMoved ?? false,
  tradingVaultMutation: nonceCancelPrepare.tradingVaultMutation ?? false,
  nonceManagerMutation: nonceCancelPrepare.nonceManagerMutation ?? false,
  approvalGate: nonceCancelPrepare.approvalGate ?? NONCE_CANCEL_PREPARE_SAFETY.approvalGate,
  safety: normalizeSafety(nonceCancelPrepare.safety),
});
