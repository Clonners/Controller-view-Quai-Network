import { normalizeAccountOverviewPanelFixture } from './account-overview-panel.js';
import { normalizeCommandPaletteFixture } from './command-palette.js';
import { normalizeDelegateKeyHistoryPanelFixture } from './delegate-key-history-panel.js';
import { normalizeFeePolicyPanelFixture } from './fee-policy-panel.js';
import { normalizeKeyboardShortcutHelpFixture } from './keyboard-shortcuts.js';
import { normalizeKlinePanelFixture } from './kline-panel.js';
import { normalizeFillHistoryPanelFixture } from './fill-history-panel.js';
import { normalizeOpenOrdersPanelFixture } from './open-orders-panel.js';
import { normalizeVaultHistoryPanelFixture } from './vault-history-panel.js';
import { normalizeNonceCancellationHistoryPanelFixture } from './nonce-cancellation-history-panel.js';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const shortHash = (hash) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

const renderOrderbookSide = (orders, emptyLabel, preview = {}) => {
  if (orders.length === 0) {
    const price = Number(preview.price ?? 5);
    const base = Number.isFinite(price) ? price : 5;
    const side = preview.side === 'bid' ? 'bid' : 'ask';
    const offsets = side === 'ask' ? [0.030, 0.020, 0.010, 0.006] : [-0.006, -0.010, -0.020, -0.030];
    const amounts = side === 'ask' ? [18, 42, 63, 91] : [22, 38, 57, 88];
    const rows = offsets.map((offset, index) => {
      const levelPrice = (base + offset).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      const amount = String(amounts[index]);
      const total = (Number(levelPrice) * amounts[index]).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      return `
        <li class="depth-preview">
          <span>${escapeHtml(levelPrice)}</span>
          <span>${escapeHtml(amount)}</span>
          <code>${escapeHtml(total)}</code>
        </li>
      `;
    }).join('');

    return rows;
  }

  return orders.map((order) => `
    <li>
      <span>${escapeHtml(order.price)}</span>
      <span>${escapeHtml(order.remainingAmount)}</span>
      <code>${escapeHtml(shortHash(order.orderHash))}</code>
    </li>
  `).join('');
};

const renderLiveStreamPanel = (liveStream) => {
  if (liveStream === undefined || liveStream === null) {
    return '';
  }

  const permissions = (liveStream.permissions ?? []).join(', ');
  const streamReason = liveStream.streamEvent?.reason ?? 'initial_snapshot';
  const streamMarket = liveStream.streamEvent?.marketId ?? 'all-markets';

  return `
        <article class="panel stream-panel">
          <h2>live fills stream</h2>
          <p class="warning">${escapeHtml(liveStream.safetyNotice)}</p>
          <dl class="kv">
            <div><dt>channel</dt><dd>${escapeHtml(liveStream.channel)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(liveStream.source)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(liveStream.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>last event</dt><dd>${escapeHtml(streamReason)}</dd></div>
            <div><dt>market</dt><dd>${escapeHtml(streamMarket)}</dd></div>
          </dl>
        </article>
  `;
};

const renderOrderRows = (orders = []) => {
  if (orders.length === 0) {
    return '<li class="muted">no private order updates yet</li>';
  }

  return orders.map((order) => `
    <li>
      <span>${escapeHtml(order.status)}</span>
      <span>${escapeHtml(order.remainingAmount)}</span>
      <code>${escapeHtml(shortHash(order.orderHash))}</code>
    </li>
  `).join('');
};

const renderOrderStreamPanel = (orderStream, orders = []) => {
  if (orderStream === undefined || orderStream === null) {
    return '';
  }

  const permissions = (orderStream.permissions ?? []).join(', ');
  const cancellationPermissions = (orderStream.cancellationPermissions ?? []).join(', ') || 'none';
  const streamReason = orderStream.streamEvent?.reason ?? 'initial_snapshot';
  const streamMarket = orderStream.streamEvent?.marketId ?? 'all-markets';
  const cancelledHashes = (orderStream.cancelledOrderHashes ?? [])
    .map((hash) => shortHash(hash))
    .join(', ') || 'none';
  const nonceManager = orderStream.nonceManager ?? 'none';
  const nonceCancellation = orders
    .map((order) => order.nonceCancellation)
    .filter((value) => value !== undefined && value !== null)
    .join(', ') || 'none';

  return `
        <article class="panel stream-panel">
          <h2>live orders stream</h2>
          <p class="warning">${escapeHtml(orderStream.safetyNotice)}</p>
          <dl class="kv">
            <div><dt>channel</dt><dd>${escapeHtml(orderStream.channel)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(orderStream.source)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(orderStream.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>cancel perms</dt><dd>${escapeHtml(cancellationPermissions)}</dd></div>
            <div><dt>last event</dt><dd>${escapeHtml(streamReason)}</dd></div>
            <div><dt>market</dt><dd>${escapeHtml(streamMarket)}</dd></div>
            <div><dt>nonce manager</dt><dd>${escapeHtml(nonceManager)}</dd></div>
            <div><dt>cancelled</dt><dd>${escapeHtml(cancelledHashes)}</dd></div>
            <div><dt>nonce status</dt><dd>${escapeHtml(nonceCancellation)}</dd></div>
          </dl>
          ${orderStream.message === null || orderStream.message === undefined ? '' : `<p class="warning">${escapeHtml(orderStream.message)}</p>`}
          <h3>private order projection</h3>
          <ul>${renderOrderRows(orders)}</ul>
        </article>
  `;
};

const renderBalanceRows = (balances = []) => {
  if (balances.length === 0) {
    return '<li class="muted">no mock vault balances yet</li>';
  }

  return balances.map((balance) => `
    <li>
      <span>${escapeHtml(balance.token ?? balance.symbol ?? 'token')}</span>
      <span>${escapeHtml(balance.available ?? '0')}</span>
      <span>${escapeHtml(balance.locked ?? balance.total ?? '0')}</span>
    </li>
  `).join('');
};

const renderBalanceStreamPanel = (balanceStream, balanceProjection, balances = []) => {
  if (balanceStream === undefined || balanceStream === null) {
    return '';
  }

  const projection = balanceProjection ?? {};
  const permissions = (balanceStream.permissions ?? projection.permissions ?? []).join(', ');
  const streamReason = balanceStream.streamEvent?.reason ?? 'initial_snapshot';
  const projectionSafetyNotice = balanceStream.projectionSafetyNotice ?? projection.safetyNotice ?? '';
  const withdrawalAuthority = balanceStream.withdrawalAuthority ?? projection.withdrawalAuthority ?? 'owner-wallet-only';
  const settlementMode = balanceStream.settlementMode ?? projection.settlementMode ?? 'mock';
  const realQuaiTransactions = balanceStream.realQuaiTransactions ?? projection.realQuaiTransactions ?? false;
  const walletRequired = balanceStream.walletRequired ?? projection.walletRequired ?? false;
  const projectionCustody = projection.custody ?? 'non-custodial-contract-vault';

  return `
        <article class="panel stream-panel balance-panel">
          <h2>live balances stream</h2>
          <p class="warning">${escapeHtml(balanceStream.safetyNotice)}</p>
          <p class="warning">${escapeHtml(projectionSafetyNotice)}</p>
          <dl class="kv">
            <div><dt>channel</dt><dd>${escapeHtml(balanceStream.channel)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(balanceStream.source)}</dd></div>
            <div><dt>stream custody</dt><dd>${escapeHtml(balanceStream.custody)}</dd></div>
            <div><dt>vault custody</dt><dd>${escapeHtml(projectionCustody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>withdrawals</dt><dd>${escapeHtml(withdrawalAuthority)}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(settlementMode)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(walletRequired)}</dd></div>
            <div><dt>last event</dt><dd>${escapeHtml(streamReason)}</dd></div>
          </dl>
          <h3>private vault balance projection</h3>
          <ul>${renderBalanceRows(balances)}</ul>
        </article>
  `;
};

const renderVaultHistoryStreamEvents = (events = []) => {
  if (events.length === 0) {
    return '<li class="muted">waiting for private vault history stream snapshot</li>';
  }

  return events.map(({ channel, event }) => `
    <li><span>${escapeHtml(channel)}</span> <code>${escapeHtml(event?.reason ?? 'initial_snapshot')}</code></li>
  `).join('');
};

const renderVaultHistoryStreamPanel = (vaultHistoryStream) => {
  if (vaultHistoryStream === undefined || vaultHistoryStream === null) {
    return '';
  }

  const permissions = (vaultHistoryStream.permissions ?? []).join(', ');
  const channels = (vaultHistoryStream.channels ?? []).join(', ');
  const projectionSafetyNotices = vaultHistoryStream.projectionSafetyNotices ?? {};

  return `
        <article class="panel stream-panel vault-history-stream-panel">
          <h2>live vault history streams</h2>
          <p class="warning">${escapeHtml(vaultHistoryStream.safetyNotice)}</p>
          <p class="warning">${escapeHtml(projectionSafetyNotices.deposits ?? '')}</p>
          <p class="warning">${escapeHtml(projectionSafetyNotices.withdrawals ?? '')}</p>
          <dl class="kv">
            <div><dt>channels</dt><dd>${escapeHtml(channels)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(vaultHistoryStream.source)}</dd></div>
            <div><dt>stream custody</dt><dd>${escapeHtml(vaultHistoryStream.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(vaultHistoryStream.settlementMode)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(vaultHistoryStream.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(vaultHistoryStream.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(vaultHistoryStream.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(vaultHistoryStream.tradingVaultMutation)}</dd></div>
            <div><dt>row count</dt><dd>${escapeHtml(vaultHistoryStream.rowCount ?? 0)}</dd></div>
          </dl>
          <h3>private stream events</h3>
          <ul>${renderVaultHistoryStreamEvents(vaultHistoryStream.streamEvents)}</ul>
        </article>
  `;
};

const renderDelegateKeyHistoryStreamEvents = (events = []) => {
  if (events.length === 0) {
    return '<li class="muted">waiting for private DelegateKeyRegistry history stream snapshot</li>';
  }

  return events.map(({ channel, event }) => `
    <li><span>${escapeHtml(channel)}</span> <code>${escapeHtml(event?.reason ?? 'initial_snapshot')}</code></li>
  `).join('');
};

const renderDelegateKeyHistoryStreamPanel = (delegateKeyHistoryStream) => {
  if (delegateKeyHistoryStream === undefined || delegateKeyHistoryStream === null) {
    return '';
  }

  const permissions = (delegateKeyHistoryStream.permissions ?? []).join(', ');
  const channels = (delegateKeyHistoryStream.channels ?? []).join(', ');
  const projectionSafetyNotices = delegateKeyHistoryStream.projectionSafetyNotices ?? {};

  return `
        <article class="panel stream-panel delegate-key-history-stream-panel">
          <h2>live delegate/API key history streams</h2>
          <p class="warning">${escapeHtml(delegateKeyHistoryStream.safetyNotice)}</p>
          <p class="warning">${escapeHtml(projectionSafetyNotices.registrations ?? '')}</p>
          <p class="warning">${escapeHtml(projectionSafetyNotices.revocations ?? '')}</p>
          <dl class="kv">
            <div><dt>channels</dt><dd>${escapeHtml(channels)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(delegateKeyHistoryStream.source)}</dd></div>
            <div><dt>stream custody</dt><dd>${escapeHtml(delegateKeyHistoryStream.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(delegateKeyHistoryStream.settlementMode)}</dd></div>
            <div><dt>delegate can withdraw</dt><dd>${escapeHtml(delegateKeyHistoryStream.delegateCanWithdraw)}</dd></div>
            <div><dt>delegate can admin</dt><dd>${escapeHtml(delegateKeyHistoryStream.delegateCanAdmin)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(delegateKeyHistoryStream.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(delegateKeyHistoryStream.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(delegateKeyHistoryStream.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(delegateKeyHistoryStream.tradingVaultMutation)}</dd></div>
            <div><dt>DelegateKeyRegistry mutation</dt><dd>${escapeHtml(delegateKeyHistoryStream.delegateKeyRegistryMutation)}</dd></div>
            <div><dt>row count</dt><dd>${escapeHtml(delegateKeyHistoryStream.rowCount ?? 0)}</dd></div>
          </dl>
          <h3>private stream events</h3>
          <ul>${renderDelegateKeyHistoryStreamEvents(delegateKeyHistoryStream.streamEvents)}</ul>
        </article>
  `;
};

const renderVaultOperationPanel = (vaultOperation) => {
  if (vaultOperation === undefined || vaultOperation === null) {
    return '';
  }

  const permissions = (vaultOperation.permissions ?? []).join(', ');
  const safetyNotice = vaultOperation.safety?.notice ?? '';

  return `
        <article class="panel stream-panel vault-operation-panel">
          <h2>prepare-only vault operation</h2>
          <p class="warning">${escapeHtml(safetyNotice)}</p>
          <p class="warning">${escapeHtml(vaultOperation.message)}</p>
          <dl class="kv">
            <div><dt>http status</dt><dd>${escapeHtml(vaultOperation.httpStatus)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(vaultOperation.source)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(vaultOperation.custody)}</dd></div>
            <div><dt>vault operation</dt><dd>${escapeHtml(vaultOperation.vaultOperation)}</dd></div>
            <div><dt>operation status</dt><dd>${escapeHtml(vaultOperation.operationStatus)}</dd></div>
            <div><dt>owner auth</dt><dd>${escapeHtml(vaultOperation.ownerAuthorization)}</dd></div>
            <div><dt>delegate authority</dt><dd>${escapeHtml(vaultOperation.delegateAuthority)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(vaultOperation.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(vaultOperation.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(vaultOperation.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(vaultOperation.tradingVaultMutation)}</dd></div>
            <div><dt>approval gate</dt><dd>${escapeHtml(vaultOperation.approvalGate)}</dd></div>
          </dl>
        </article>
  `;
};

const renderDelegateKeyOperationPanel = (delegateKeyOperation) => {
  if (delegateKeyOperation === undefined || delegateKeyOperation === null) {
    return '';
  }

  const permissions = (delegateKeyOperation.permissions ?? []).join(', ');
  const requiredFields = (delegateKeyOperation.requiredFields ?? []).join(', ');
  const keyId = delegateKeyOperation.keyId ?? 'local-prepare-only-not-registered';

  return `
        <article class="panel stream-panel delegate-key-operation-panel">
          <h2>prepare-only delegate/API key</h2>
          <p class="warning">Owner-signed DelegateKeyRegistry boundary: no wallet is loaded, no signature is created, no RPC URL is read, no transaction is submitted, and no funds move.</p>
          <p class="warning">${escapeHtml(delegateKeyOperation.message)}</p>
          <dl class="kv">
            <div><dt>http status</dt><dd>${escapeHtml(delegateKeyOperation.httpStatus)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(delegateKeyOperation.source)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(delegateKeyOperation.custody)}</dd></div>
            <div><dt>operation</dt><dd>${escapeHtml(delegateKeyOperation.operation)}</dd></div>
            <div><dt>key id</dt><dd>${escapeHtml(keyId)}</dd></div>
            <div><dt>operation status</dt><dd>${escapeHtml(delegateKeyOperation.operationStatus)}</dd></div>
            <div><dt>owner auth</dt><dd>${escapeHtml(delegateKeyOperation.ownerAuthorization)}</dd></div>
            <div><dt>delegate authority</dt><dd>${escapeHtml(delegateKeyOperation.delegateAuthority)}</dd></div>
            <div><dt>required fields</dt><dd>${escapeHtml(requiredFields)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>delegate can withdraw</dt><dd>${escapeHtml(delegateKeyOperation.delegateCanWithdraw)}</dd></div>
            <div><dt>delegate can admin</dt><dd>${escapeHtml(delegateKeyOperation.delegateCanAdmin)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(delegateKeyOperation.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(delegateKeyOperation.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(delegateKeyOperation.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(delegateKeyOperation.tradingVaultMutation)}</dd></div>
            <div><dt>approval gate</dt><dd>${escapeHtml(delegateKeyOperation.approvalGate)}</dd></div>
          </dl>
        </article>
  `;
};

const mockEvidenceLabel = (value) => value ?? 'null (mock)';

const renderOpenOrderRows = (orders = []) => {
  if (orders.length === 0) {
    return '<li class="muted">no matcher-local open orders yet</li>';
  }

  return orders.map((order) => `
    <li>
      <span>${escapeHtml(order.side)}</span>
      <span>${escapeHtml(order.price)}</span>
      <span>${escapeHtml(order.remainingAmount)}</span>
      <span>${escapeHtml(order.status)}</span>
      <code>${escapeHtml(shortHash(order.orderHash))}</code>
    </li>
  `).join('');
};

const renderOpenOrdersPanel = (openOrders) => {
  if (openOrders === undefined || openOrders === null) {
    return '';
  }

  const normalized = normalizeOpenOrdersPanelFixture(openOrders);
  const permissions = (normalized.permissions ?? []).join(', ');
  const orderRows = normalized.orders ?? [];

  return `
        <article class="panel open-orders-panel">
          <h2>read-only open orders</h2>
          <p class="warning">${escapeHtml(normalized.safetyNotice)}</p>
          <dl class="kv">
            <div><dt>source</dt><dd>${escapeHtml(normalized.source)}</dd></div>
            <div><dt>projection</dt><dd>${escapeHtml(normalized.projectionType)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(normalized.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>matcher-local</dt><dd>${escapeHtml(normalized.matcherLocalOnly)}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(normalized.settlementMode)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(normalized.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(normalized.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(normalized.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(normalized.tradingVaultMutation)}</dd></div>
            <div><dt>order count</dt><dd>${escapeHtml(orderRows.length)}</dd></div>
          </dl>
          <ul>${renderOpenOrderRows(orderRows)}</ul>
        </article>
  `;
};

const renderFillHistoryRows = (rows = []) => {
  if (rows.length === 0) {
    return '<li class="muted">no fill history rows yet</li>';
  }

  return rows.map((row) => `
    <li>
      <span>${escapeHtml(row.marketId ?? 'N/A')}</span>
      <span>${escapeHtml(row.side ?? 'N/A')}</span>
      <span>${escapeHtml(row.price ?? '0')}</span>
      <span>${escapeHtml(row.amount ?? '0')}</span>
      <code>${escapeHtml(row.fillId ?? row.tradeId ?? 'fill')}</code>
    </li>
  `).join('');
};

const renderFillHistoryPanel = (fillHistory) => {
  if (fillHistory === undefined || fillHistory === null) {
    return '';
  }

  const normalized = normalizeFillHistoryPanelFixture(fillHistory);
  const permissions = (normalized.permissions ?? []).join(', ');
  const fillRows = normalized.fills ?? [];

  return `
        <article class="panel fill-history-panel">
          <h2>read-only fill history</h2>
          <p class="warning">${escapeHtml(normalized.safetyNotice)}</p>
          <dl class="kv">
            <div><dt>source</dt><dd>${escapeHtml(normalized.source)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(normalized.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>projectionType</dt><dd>${escapeHtml(normalized.projectionType)}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(normalized.settlementMode)}</dd></div>
            <div><dt>settlement tx</dt><dd>${escapeHtml(normalized.settlementTx ?? 'null (mock)')}</dd></div>
            <div><dt>block</dt><dd>${escapeHtml(normalized.blockNumber ?? 'null (mock)')}</dd></div>
            <div><dt>event index</dt><dd>${escapeHtml(normalized.eventIndex ?? 'null (mock)')}</dd></div>
            <div><dt>explorer</dt><dd>${escapeHtml(normalized.explorerUrl ?? 'null (mock)')}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(normalized.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(normalized.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(normalized.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(normalized.tradingVaultMutation)}</dd></div>
            <div><dt>fill count</dt><dd>${escapeHtml(fillRows.length)}</dd></div>
          </dl>
          <ul>${renderFillHistoryRows(fillRows)}</ul>
        </article>
  `;
};

const renderAccountOverviewRows = (rows = [], emptyLabel, rowLabel = 'row') => {
  if (rows.length === 0) {
    return `<li class="muted">${escapeHtml(emptyLabel)}</li>`;
  }

  return rows.map((row) => `
    <li>
      <span>${escapeHtml(row.marketId ?? row.token ?? row.symbol ?? rowLabel)}</span>
      <span>${escapeHtml(row.status ?? row.available ?? row.amount ?? '0')}</span>
      <code>${escapeHtml(row.orderHash ?? row.fillId ?? row.sourceEventId ?? rowLabel)}</code>
    </li>
  `).join('');
};

const renderAccountOverviewPanel = (accountOverview) => {
  if (accountOverview === undefined || accountOverview === null) {
    return '';
  }

  const overview = normalizeAccountOverviewPanelFixture(accountOverview);
  const permissions = (overview.permissions ?? []).join(', ');
  const balanceRows = overview.balances.balances ?? [];
  const orderRows = overview.orders.open ?? [];
  const fillRows = overview.fills.items ?? [];
  const accountLabel = overview.account === null ? 'null (local/mock)' : overview.account;

  return `
        <article class="panel stream-panel account-overview-panel">
          <h2>read-only account overview</h2>
          <p class="warning">${escapeHtml(overview.safety.notice)}</p>
          <p class="warning">Mock account overview only: no wallet loaded, no funds moved, and no delegate withdrawal/admin authority.</p>
          <dl class="kv">
            <div><dt>account</dt><dd>${escapeHtml(accountLabel)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(overview.source)}</dd></div>
            <div><dt>projection</dt><dd>${escapeHtml(overview.projectionType)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(overview.custody)}</dd></div>
            <div><dt>session</dt><dd>${escapeHtml(overview.session.mode)}</dd></div>
            <div><dt>authenticated</dt><dd>${escapeHtml(overview.session.authenticated)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>balances source</dt><dd>${escapeHtml(overview.balances.source)}</dd></div>
            <div><dt>orders source</dt><dd>${escapeHtml(overview.orders.source)}</dd></div>
            <div><dt>matcher-local orders</dt><dd>${escapeHtml(overview.orders.matcherLocalOnly)}</dd></div>
            <div><dt>fills source</dt><dd>${escapeHtml(overview.fills.source)}</dd></div>
            <div><dt>fill projection</dt><dd>${escapeHtml(overview.fills.projectionType)}</dd></div>
            <div><dt>confirmed-only fills</dt><dd>${escapeHtml(overview.fills.confirmedOnly)}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(overview.settlementMode)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(overview.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(overview.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(overview.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(overview.tradingVaultMutation)}</dd></div>
            <div><dt>delegate can withdraw</dt><dd>${escapeHtml(overview.safety.delegateCanWithdraw)}</dd></div>
            <div><dt>delegate can admin</dt><dd>${escapeHtml(overview.safety.delegateCanAdmin)}</dd></div>
            <div><dt>balance rows</dt><dd>${escapeHtml(balanceRows.length)}</dd></div>
            <div><dt>open orders</dt><dd>${escapeHtml(orderRows.length)}</dd></div>
            <div><dt>confirmed fills</dt><dd>${escapeHtml(fillRows.length)}</dd></div>
          </dl>
          <h3>mock vault balances</h3>
          <ul>${renderAccountOverviewRows(balanceRows, 'no mock account balances yet', 'balance')}</ul>
          <h3>matcher-local open orders</h3>
          <ul>${renderAccountOverviewRows(orderRows, 'no matcher-local open orders yet', 'order')}</ul>
          <h3>confirmed indexed fills</h3>
          <ul>${renderAccountOverviewRows(fillRows, 'no confirmed IndexedFillProjection rows yet', 'fill')}</ul>
        </article>
  `;
};

const renderVaultHistoryRows = (rows = [], emptyLabel) => {
  if (rows.length === 0) {
    return `<li class="muted">${escapeHtml(emptyLabel)}</li>`;
  }

  return rows.map((row) => `
    <li>
      <span>${escapeHtml(row.eventName ?? row.projectionType ?? 'TradingVault event')}</span>
      <span>${escapeHtml(row.token ?? 'token')}</span>
      <span>${escapeHtml(row.amount ?? '0')}</span>
      <code>${escapeHtml(row.sourceEventId ?? 'mock-event-pending')}</code>
    </li>
  `).join('');
};

const renderVaultHistorySection = ({ title, envelope, rows, emptyLabel }) => {
  const permissions = (envelope.permissions ?? []).join(', ');

  return `
          <section class="vault-history-section">
            <h3>${escapeHtml(title)}</h3>
            <p class="warning">${escapeHtml(envelope.safetyNotice)}</p>
            <dl class="kv">
              <div><dt>source</dt><dd>${escapeHtml(envelope.source)}</dd></div>
              <div><dt>projection</dt><dd>${escapeHtml(envelope.projectionType)}</dd></div>
              <div><dt>event</dt><dd>${escapeHtml(envelope.eventName)}</dd></div>
              <div><dt>custody</dt><dd>${escapeHtml(envelope.custody)}</dd></div>
              <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
              <div><dt>settlementMode</dt><dd>${escapeHtml(envelope.settlementMode)}</dd></div>
              <div><dt>settlement tx</dt><dd><code>${escapeHtml(mockEvidenceLabel(envelope.settlementTx))}</code></dd></div>
              <div><dt>block</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.blockNumber))}</dd></div>
              <div><dt>event index</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.eventIndex))}</dd></div>
              <div><dt>explorer</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.explorerUrl))}</dd></div>
              <div><dt>real Quai tx</dt><dd>${escapeHtml(envelope.realQuaiTransactions)}</dd></div>
              <div><dt>wallet required</dt><dd>${escapeHtml(envelope.walletRequired)}</dd></div>
              <div><dt>funds moved</dt><dd>${escapeHtml(envelope.fundsMoved)}</dd></div>
              <div><dt>TradingVault mutation</dt><dd>${escapeHtml(envelope.tradingVaultMutation)}</dd></div>
            </dl>
            <ul>${renderVaultHistoryRows(rows, emptyLabel)}</ul>
          </section>
  `;
};

const renderVaultHistoryPanel = (vaultHistory) => {
  if (vaultHistory === undefined || vaultHistory === null) {
    return '';
  }

  const history = normalizeVaultHistoryPanelFixture(vaultHistory);

  return `
        <article class="panel stream-panel vault-history-panel">
          <h2>read-only vault history</h2>
${renderVaultHistorySection({
    title: 'TradingVault Deposit history',
    envelope: history.deposits,
    rows: history.deposits.deposits,
    emptyLabel: 'no vault deposit history rows yet',
  })}
${renderVaultHistorySection({
    title: 'TradingVault Withdraw history',
    envelope: history.withdrawals,
    rows: history.withdrawals.withdrawals,
    emptyLabel: 'no vault withdrawal history rows yet',
  })}
        </article>
  `;
};

const renderDelegateKeyHistoryRows = (rows = [], emptyLabel) => {
  if (rows.length === 0) {
    return `<li class="muted">${escapeHtml(emptyLabel)}</li>`;
  }

  return rows.map((row) => `
    <li>
      <span>${escapeHtml(row.eventName ?? row.projectionType ?? 'DelegateKeyRegistry event')}</span>
      <span>${escapeHtml(row.delegate ?? row.keyId ?? 'delegate-key')}</span>
      <span>${escapeHtml(row.allowedMarketsHash ?? row.maxNotional ?? 'metadata-only')}</span>
      <code>${escapeHtml(row.sourceEventId ?? 'mock-event-pending')}</code>
    </li>
  `).join('');
};

const renderDelegateKeyHistorySection = ({ title, envelope, rows, emptyLabel }) => {
  const permissions = (envelope.permissions ?? []).join(', ');

  return `
          <section class="delegate-key-history-section">
            <h3>${escapeHtml(title)}</h3>
            <p class="warning">${escapeHtml(envelope.safetyNotice)}</p>
            <dl class="kv">
              <div><dt>source</dt><dd>${escapeHtml(envelope.source)}</dd></div>
              <div><dt>projection</dt><dd>${escapeHtml(envelope.projectionType)}</dd></div>
              <div><dt>event</dt><dd>${escapeHtml(envelope.eventName)}</dd></div>
              <div><dt>custody</dt><dd>${escapeHtml(envelope.custody)}</dd></div>
              <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
              <div><dt>settlementMode</dt><dd>${escapeHtml(envelope.settlementMode)}</dd></div>
              <div><dt>settlement tx</dt><dd><code>${escapeHtml(mockEvidenceLabel(envelope.settlementTx))}</code></dd></div>
              <div><dt>block</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.blockNumber))}</dd></div>
              <div><dt>event index</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.eventIndex))}</dd></div>
              <div><dt>explorer</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.explorerUrl))}</dd></div>
              <div><dt>delegate can withdraw</dt><dd>${escapeHtml(envelope.delegateCanWithdraw)}</dd></div>
              <div><dt>delegate can admin</dt><dd>${escapeHtml(envelope.delegateCanAdmin)}</dd></div>
              <div><dt>real Quai tx</dt><dd>${escapeHtml(envelope.realQuaiTransactions)}</dd></div>
              <div><dt>wallet required</dt><dd>${escapeHtml(envelope.walletRequired)}</dd></div>
              <div><dt>funds moved</dt><dd>${escapeHtml(envelope.fundsMoved)}</dd></div>
              <div><dt>TradingVault mutation</dt><dd>${escapeHtml(envelope.tradingVaultMutation)}</dd></div>
              <div><dt>DelegateKeyRegistry mutation</dt><dd>${escapeHtml(envelope.delegateKeyRegistryMutation)}</dd></div>
            </dl>
            <ul>${renderDelegateKeyHistoryRows(rows, emptyLabel)}</ul>
          </section>
  `;
};

const renderDelegateKeyHistoryPanel = (delegateKeyHistory) => {
  if (delegateKeyHistory === undefined || delegateKeyHistory === null) {
    return '';
  }

  const history = normalizeDelegateKeyHistoryPanelFixture(delegateKeyHistory);

  return `
        <article class="panel stream-panel delegate-key-history-panel">
          <h2>read-only delegate/API key history</h2>
${renderDelegateKeyHistorySection({
    title: 'DelegateKeyRegistered history',
    envelope: history.registrations,
    rows: history.registrations.registrations,
    emptyLabel: 'no delegate-key registration history rows yet',
  })}
${renderDelegateKeyHistorySection({
    title: 'DelegateKeyRevoked history',
    envelope: history.revocations,
    rows: history.revocations.revocations,
    emptyLabel: 'no delegate-key revocation history rows yet',
  })}
        </article>
  `;
};

const renderNonceCancellationHistoryRows = (rows = [], emptyLabel) => {
  if (rows.length === 0) {
    return `<li class="muted">${escapeHtml(emptyLabel)}</li>`;
  }

  return rows.map((row) => `
    <li>
      <span>${escapeHtml(row.eventName ?? row.projectionType ?? 'NonceManager event')}</span>
      <span>${escapeHtml(row.account ?? 'account')}</span>
      <span>${escapeHtml(row.nonce ?? row.rangeStart ?? 'metadata-only')}</span>
      <code>${escapeHtml(row.sourceEventId ?? 'mock-event-pending')}</code>
    </li>
  `).join('');
};

const renderNonceCancellationHistorySection = ({ title, envelope, rows, emptyLabel }) => {
  const permissions = (envelope.permissions ?? []).join(', ');

  return `
          <section class="nonce-cancellation-history-section">
            <h3>${escapeHtml(title)}</h3>
            <p class="warning">${escapeHtml(envelope.safetyNotice)}</p>
            <dl class="kv">
              <div><dt>source</dt><dd>${escapeHtml(envelope.source)}</dd></div>
              <div><dt>projection</dt><dd>${escapeHtml(envelope.projectionType)}</dd></div>
              <div><dt>event</dt><dd>${escapeHtml(envelope.eventName)}</dd></div>
              <div><dt>custody</dt><dd>${escapeHtml(envelope.custody)}</dd></div>
              <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
              <div><dt>settlementMode</dt><dd>${escapeHtml(envelope.settlementMode)}</dd></div>
              <div><dt>settlement tx</dt><dd><code>${escapeHtml(mockEvidenceLabel(envelope.settlementTx))}</code></dd></div>
              <div><dt>block</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.blockNumber))}</dd></div>
              <div><dt>event index</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.eventIndex))}</dd></div>
              <div><dt>explorer</dt><dd>${escapeHtml(mockEvidenceLabel(envelope.explorerUrl))}</dd></div>
              <div><dt>real Quai tx</dt><dd>${escapeHtml(envelope.realQuaiTransactions)}</dd></div>
              <div><dt>wallet required</dt><dd>${escapeHtml(envelope.walletRequired)}</dd></div>
              <div><dt>funds moved</dt><dd>${escapeHtml(envelope.fundsMoved)}</dd></div>
              <div><dt>TradingVault mutation</dt><dd>${escapeHtml(envelope.tradingVaultMutation)}</dd></div>
              <div><dt>NonceManager mutation</dt><dd>${escapeHtml(envelope.nonceManagerMutation)}</dd></div>
            </dl>
            <ul>${renderNonceCancellationHistoryRows(rows, emptyLabel)}</ul>
          </section>
  `;
};

const renderNonceCancellationHistoryPanel = (nonceCancellationHistory) => {
  if (nonceCancellationHistory === undefined || nonceCancellationHistory === null) {
    return '';
  }

  const history = normalizeNonceCancellationHistoryPanelFixture(nonceCancellationHistory);

  return `
        <article class="panel stream-panel nonce-cancellation-history-panel">
          <h2>read-only nonce cancellation history</h2>
${renderNonceCancellationHistorySection({
    title: 'NonceCancelled history',
    envelope: history.cancellations,
    rows: history.cancellations.cancellations,
    emptyLabel: 'no nonce cancellation history rows yet',
  })}
${renderNonceCancellationHistorySection({
    title: 'NonceRangeCancelled history',
    envelope: history.rangeCancellations,
    rows: history.rangeCancellations.rangeCancellations,
    emptyLabel: 'no nonce range cancellation history rows yet',
  })}
        </article>
  `;
};

const localMockEvidenceLabel = (value) => value ?? 'null (local/mock)';

const renderFeeScheduleRows = (rows = []) => rows.map((row) => `
    <li>
      <span>${escapeHtml(row.marketId)}</span>
      <span>maker fee bps ${escapeHtml(row.makerFeeBps)}</span>
      <span>taker fee bps ${escapeHtml(row.takerFeeBps)}</span>
      <code>${escapeHtml(row.eventName)}</code>
    </li>
  `).join('');

const renderFeePolicyPanel = (feePolicy) => {
  if (feePolicy === undefined || feePolicy === null) {
    return '';
  }

  const policy = normalizeFeePolicyPanelFixture(feePolicy);
  const permissions = (policy.permissions ?? []).join(', ');
  const rows = policy.feeSchedules ?? [];
  const firstSchedule = rows[0] ?? {};

  return `
        <article class="panel stream-panel fee-policy-panel">
          <h2>read-only FeeManager fee schedule</h2>
          <p class="warning">${escapeHtml(policy.safety.notice)}</p>
          <dl class="kv">
            <div><dt>source</dt><dd>${escapeHtml(policy.source)}</dd></div>
            <div><dt>status</dt><dd>${escapeHtml(policy.status)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(policy.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>hard max fee bps</dt><dd>${escapeHtml(policy.hardMaxFeeBps)}</dd></div>
            <div><dt>fee recipient</dt><dd>${escapeHtml(localMockEvidenceLabel(policy.feeRecipient))}</dd></div>
            <div><dt>feeManagerMutation</dt><dd>${escapeHtml(policy.feeManagerMutation)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(policy.tradingVaultMutation)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(policy.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(policy.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(policy.fundsMoved)}</dd></div>
          </dl>
          <h3>FeeScheduleProjection</h3>
          <dl class="kv">
            <div><dt>projection</dt><dd>${escapeHtml(firstSchedule.projectionType ?? 'FeeScheduleProjection')}</dd></div>
            <div><dt>event</dt><dd>${escapeHtml(firstSchedule.eventName ?? 'FeesUpdated')}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(firstSchedule.settlementMode ?? 'mock')}</dd></div>
            <div><dt>settlement tx</dt><dd><code>${escapeHtml(localMockEvidenceLabel(firstSchedule.settlementTx))}</code></dd></div>
            <div><dt>block</dt><dd>${escapeHtml(localMockEvidenceLabel(firstSchedule.blockNumber))}</dd></div>
            <div><dt>event index</dt><dd>${escapeHtml(localMockEvidenceLabel(firstSchedule.eventIndex))}</dd></div>
            <div><dt>explorer</dt><dd>${escapeHtml(localMockEvidenceLabel(firstSchedule.explorerUrl))}</dd></div>
          </dl>
          <ul>${renderFeeScheduleRows(rows)}</ul>
        </article>
  `;
};

const renderFeePolicyStreamPanel = (feePolicyStream) => {
  if (feePolicyStream === undefined || feePolicyStream === null) {
    return '';
  }

  const permissions = (feePolicyStream.permissions ?? []).join(', ');
  const streamReason = feePolicyStream.streamEvent?.reason ?? 'initial_snapshot';

  return `
        <article class="panel stream-panel fee-policy-stream-panel">
          <h2>live FeeManager fee schedule stream</h2>
          <p class="warning">${escapeHtml(feePolicyStream.safetyNotice)}</p>
          <p class="warning">${escapeHtml(feePolicyStream.projectionSafetyNotice ?? '')}</p>
          <dl class="kv">
            <div><dt>channel</dt><dd>${escapeHtml(feePolicyStream.channel)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(feePolicyStream.source)}</dd></div>
            <div><dt>stream custody</dt><dd>${escapeHtml(feePolicyStream.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>projection</dt><dd>${escapeHtml(feePolicyStream.projectionType)}</dd></div>
            <div><dt>event</dt><dd>${escapeHtml(feePolicyStream.eventName)}</dd></div>
            <div><dt>hard max fee bps</dt><dd>${escapeHtml(feePolicyStream.hardMaxFeeBps)}</dd></div>
            <div><dt>fee recipient</dt><dd>${escapeHtml(localMockEvidenceLabel(feePolicyStream.feeRecipient))}</dd></div>
            <div><dt>row count</dt><dd>${escapeHtml(feePolicyStream.rowCount ?? 0)}</dd></div>
            <div><dt>settlementMode</dt><dd>${escapeHtml(feePolicyStream.settlementMode)}</dd></div>
            <div><dt>feeManagerMutation</dt><dd>${escapeHtml(feePolicyStream.feeManagerMutation)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(feePolicyStream.tradingVaultMutation)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(feePolicyStream.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(feePolicyStream.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(feePolicyStream.fundsMoved)}</dd></div>
            <div><dt>fee-authority runtime keys</dt><dd>${escapeHtml(feePolicyStream.noFeeAuthorityRuntimeKeys ? 'absent' : 'unsafe')}</dd></div>
            <div><dt>last event</dt><dd>${escapeHtml(streamReason)}</dd></div>
          </dl>
        </article>
  `;
};

const renderPublicMarketDataStreamEvents = (events = []) => {
  if (events.length === 0) {
    return '<li class="muted">waiting for public market-data stream snapshots</li>';
  }

  return events.map(({ channel, event }) => `
    <li><span>${escapeHtml(channel)}</span> <code>${escapeHtml(event?.reason ?? 'initial_snapshot')}</code></li>
  `).join('');
};

const renderPublicMarketDataStreamPanel = (publicMarketDataStream) => {
  if (publicMarketDataStream === undefined || publicMarketDataStream === null) {
    return '';
  }

  const channels = (publicMarketDataStream.channels ?? []).join(', ');
  const payloads = (publicMarketDataStream.payloads ?? []).join(', ');
  const sources = (publicMarketDataStream.sources ?? []).join(', ');
  const permissions = (publicMarketDataStream.permissions ?? []).join(', ');

  return `
        <article class="panel stream-panel public-market-data-stream-panel">
          <h2>live public market-data streams</h2>
          <p class="warning">${escapeHtml(publicMarketDataStream.safetyNotice)}</p>
          <dl class="kv">
            <div><dt>channels</dt><dd>${escapeHtml(channels)}</dd></div>
            <div><dt>payloads</dt><dd>${escapeHtml(payloads)}</dd></div>
            <div><dt>sources</dt><dd>${escapeHtml(sources)}</dd></div>
            <div><dt>stream custody</dt><dd>${escapeHtml(publicMarketDataStream.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>market</dt><dd>${escapeHtml(publicMarketDataStream.marketId)}</dd></div>
            <div><dt>tickers</dt><dd>${escapeHtml(publicMarketDataStream.tickerCount ?? 0)}</dd></div>
            <div><dt>bids</dt><dd>${escapeHtml(publicMarketDataStream.bidCount ?? 0)}</dd></div>
            <div><dt>asks</dt><dd>${escapeHtml(publicMarketDataStream.askCount ?? 0)}</dd></div>
            <div><dt>trades</dt><dd>${escapeHtml(publicMarketDataStream.tradeCount ?? 0)}</dd></div>
            <div><dt>finality</dt><dd>${escapeHtml(publicMarketDataStream.finality ?? 'confirmed-settlement-only')}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(publicMarketDataStream.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(publicMarketDataStream.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(publicMarketDataStream.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(publicMarketDataStream.tradingVaultMutation)}</dd></div>
          </dl>
          <h3>public stream events</h3>
          <ul>${renderPublicMarketDataStreamEvents(publicMarketDataStream.streamEvents)}</ul>
        </article>
  `;
};

const renderKlineRows = (candles = []) => {
  if (candles.length === 0) {
    return '<li class="muted">no local/mock candle rows yet</li>';
  }

  return candles.map((candle) => `
    <li>
      <span>${escapeHtml(candle.openTime ?? candle.timestamp ?? 'local-candle')}</span>
      <span>${escapeHtml(candle.open ?? '0')}</span>
      <span>${escapeHtml(candle.close ?? '0')}</span>
    </li>
  `).join('');
};

const renderKlinePanel = (klines) => {
  if (klines === undefined || klines === null) {
    return '';
  }

  const panel = normalizeKlinePanelFixture(klines);
  const permissions = (panel.permissions ?? []).join(', ');

  return `
        <article class="panel stream-panel kline-panel">
          <h2>read-only public kline/candle panel</h2>
          <p class="warning">${escapeHtml(panel.safety.notice)}</p>
          <dl class="kv">
            <div><dt>market</dt><dd>${escapeHtml(panel.marketId)}</dd></div>
            <div><dt>interval</dt><dd>${escapeHtml(panel.interval)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(panel.source)}</dd></div>
            <div><dt>payload</dt><dd>${escapeHtml(panel.payload)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(panel.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>candles</dt><dd>${escapeHtml(panel.candles.length)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(panel.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(panel.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(panel.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(panel.tradingVaultMutation)}</dd></div>
            <div><dt>custody authority</dt><dd>${escapeHtml(panel.safety.noCustodyAuthority ? 'no custody authority' : 'unsafe')}</dd></div>
          </dl>
          <h3>kline_snapshot rows</h3>
          <ul>${renderKlineRows(panel.candles)}</ul>
        </article>
  `;
};

const renderKlineStreamPanel = (klineStream) => {
  if (klineStream === undefined || klineStream === null) {
    return '';
  }

  const permissions = (klineStream.permissions ?? []).join(', ');
  const streamReason = klineStream.streamEvent?.reason ?? 'initial_snapshot';

  return `
        <article class="panel stream-panel kline-stream-panel">
          <h2>live public kline/candle stream</h2>
          <p class="warning">${escapeHtml(klineStream.safetyNotice)}</p>
          <p class="warning">${escapeHtml(klineStream.projectionSafetyNotice ?? '')}</p>
          <dl class="kv">
            <div><dt>channel</dt><dd>${escapeHtml(klineStream.channel)}</dd></div>
            <div><dt>source</dt><dd>${escapeHtml(klineStream.source)}</dd></div>
            <div><dt>payload</dt><dd>${escapeHtml(klineStream.payload)}</dd></div>
            <div><dt>stream custody</dt><dd>${escapeHtml(klineStream.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>market</dt><dd>${escapeHtml(klineStream.marketId)}</dd></div>
            <div><dt>interval</dt><dd>${escapeHtml(klineStream.interval)}</dd></div>
            <div><dt>candles</dt><dd>${escapeHtml(klineStream.candleCount ?? 0)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(klineStream.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(klineStream.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(klineStream.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(klineStream.tradingVaultMutation)}</dd></div>
            <div><dt>last event</dt><dd>${escapeHtml(streamReason)}</dd></div>
          </dl>
        </article>
  `;
};

const renderCommandPaletteRows = (commands = []) => commands.map((command) => `
  <li>
    <code>${escapeHtml(command.command)}</code>
    <span>${escapeHtml(command.actionType)}</span>
    <span>${escapeHtml(command.surface)}</span>
    <span>${escapeHtml(command.dispatchMode)}</span>
  </li>
`).join('');

const renderCommandPalettePanel = (commandPalette) => {
  if (commandPalette === undefined || commandPalette === null) {
    return '';
  }

  const panel = normalizeCommandPaletteFixture(commandPalette);
  const permissions = (panel.permissions ?? []).join(', ');

  return `
        <article class="panel command-palette-skeleton-panel">
          <h2>terminal command-palette skeleton</h2>
          <p class="warning">${escapeHtml(panel.safety.notice)}</p>
          <dl class="kv">
            <div><dt>source</dt><dd>${escapeHtml(panel.source)}</dd></div>
            <div><dt>mode</dt><dd>${escapeHtml(panel.mode)}</dd></div>
            <div><dt>dispatch</dt><dd>${escapeHtml(panel.dispatchMode)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(panel.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(panel.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(panel.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(panel.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(panel.tradingVaultMutation)}</dd></div>
            <div><dt>MarketRegistry mutation</dt><dd>${escapeHtml(panel.marketRegistryMutation)}</dd></div>
            <div><dt>DelegateKeyRegistry mutation</dt><dd>${escapeHtml(panel.delegateKeyRegistryMutation)}</dd></div>
            <div><dt>delegate can withdraw</dt><dd>${escapeHtml(panel.delegateCanWithdraw)}</dd></div>
            <div><dt>delegate can admin</dt><dd>${escapeHtml(panel.delegateCanAdmin)}</dd></div>
          </dl>
          <form data-qdx-command-palette-form>
            <label>
              command
              <input data-qdx-command-palette-input value=":proof trade-000001" aria-label="terminal command palette input" />
            </label>
            <button type="submit">preview command</button>
          </form>
          <p class="muted" data-qdx-command-palette-status>Preview-only skeleton: choose a known command; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.</p>
          <h3>previewable commands</h3>
          <ul>${renderCommandPaletteRows(panel.commands)}</ul>
          <p class="warning">Matcher-local cancellation does not mutate on-chain NonceManager nonces. Delegate/API key commands keep delegate can withdraw false and delegate can admin false.</p>
        </article>
  `;
};

const renderKeyboardShortcutRows = (shortcuts = []) => shortcuts.map((shortcut) => `
  <li>
    <span><kbd>${escapeHtml(shortcut.key)}</kbd> ${escapeHtml(shortcut.label)}</span>
    <span class="muted">${escapeHtml(`${shortcut.key} ${shortcut.label}`)}</span>
    <span>${escapeHtml(shortcut.actionType)}</span>
    <span>${escapeHtml(shortcut.surface)}</span>
    <span>${escapeHtml(shortcut.dispatchMode)}</span>
  </li>
`).join('');

const renderKeyboardCommandHintRows = (commandHints = []) => commandHints.map((hint) => `
  <li>
    <code>${escapeHtml(hint.command)}</code>
    <span>${escapeHtml(hint.actionType)}</span>
    <span>${escapeHtml(hint.surface)}</span>
    <span>${escapeHtml(hint.dispatchMode)}</span>
  </li>
`).join('');

const renderKeyboardShortcutHelpPanel = (keyboardShortcuts) => {
  if (keyboardShortcuts === undefined || keyboardShortcuts === null) {
    return '';
  }

  const panel = normalizeKeyboardShortcutHelpFixture(keyboardShortcuts);
  const permissions = (panel.permissions ?? []).join(', ');

  return `
        <article class="panel command-panel keyboard-shortcut-help-panel" data-qdx-keyboard-shortcuts-panel>
          <h2>terminal keyboard-shortcut help</h2>
          <p class="warning">${escapeHtml(panel.safety.notice)}</p>
          <p class="muted" data-qdx-keyboard-shortcuts-status>Waiting for local API keyboard-shortcut help smoke; help-only-no-dispatch and no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.</p>
          <dl class="kv">
            <div><dt>source</dt><dd>${escapeHtml(panel.source)}</dd></div>
            <div><dt>mode</dt><dd>${escapeHtml(panel.mode)}</dd></div>
            <div><dt>dispatch</dt><dd>${escapeHtml(panel.dispatchMode)}</dd></div>
            <div><dt>panel trigger</dt><dd>${escapeHtml(panel.panelTrigger)}</dd></div>
            <div><dt>custody</dt><dd>${escapeHtml(panel.custody)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml(permissions)}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(panel.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(panel.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(panel.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(panel.tradingVaultMutation)}</dd></div>
            <div><dt>MarketRegistry mutation</dt><dd>${escapeHtml(panel.marketRegistryMutation)}</dd></div>
            <div><dt>DelegateKeyRegistry mutation</dt><dd>${escapeHtml(panel.delegateKeyRegistryMutation)}</dd></div>
            <div><dt>delegate can withdraw</dt><dd>${escapeHtml(panel.delegateCanWithdraw)}</dd></div>
            <div><dt>delegate can admin</dt><dd>${escapeHtml(panel.delegateCanAdmin)}</dd></div>
          </dl>
          <h3>shortcuts</h3>
          <ul>${renderKeyboardShortcutRows(panel.shortcuts)}</ul>
          <h3>command hints</h3>
          <ul>${renderKeyboardCommandHintRows(panel.commandHints)}</ul>
          <p class="warning">Matcher-local cancellation does not mutate on-chain NonceManager nonces. Owner-wallet prepare hints remain no wallet/RPC/signing/broadcast/deploy/tx/funds behavior. Delegate/API key hints keep delegate can withdraw false and delegate can admin false.</p>
          <pre>:sell WQUAI-WQI 100 @ 5
:buy WQUAI-WQI 100 market_ioc slippage=50bps
:proof trade-000001
:cancel all matcher-local
:deposit WQI 10 prepare owner-wallet-only
:withdraw WQUAI 1 prepare owner-wallet-only
:api create-key bot-mm-1 prepare owner-wallet-signature-required NO_WITHDRAW
:api revoke-key bot-mm-1 prepare owner-wallet-signature-required NO_ADMIN</pre>
          <div class="mock-trigger">
            <button type="button" data-qdx-trigger-cross>submit mock cross</button>
            <p class="muted" data-qdx-trigger-status>Posts a local/dev GTC sell plus IOC buy with signed slippage bounds; no real Quai tx/explorer/funds.</p>
            <button type="button" data-qdx-trigger-cancel>create + cancel mock order</button>
            <p class="muted" data-qdx-cancel-status>Posts one local/dev resting order, then matcher-local cancellation does not cancel on-chain nonce; no real Quai tx/explorer/funds.</p>
            <button type="button" data-qdx-vault-prepare-deposit>prepare vault deposit</button>
            <p class="muted" data-qdx-vault-deposit-status>Calls prepare-only owner-wallet deposit boundary; no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
            <button type="button" data-qdx-vault-prepare-withdraw>prepare vault withdrawal</button>
            <p class="muted" data-qdx-vault-withdraw-status>Calls prepare-only owner-wallet withdrawal boundary; delegates cannot deposit or withdraw; no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
            <button type="button" data-qdx-delegate-key-prepare-register>prepare delegate/API key</button>
            <p class="muted" data-qdx-delegate-key-register-status>Calls prepare-only owner-signed delegate/API key boundary; owner-wallet-signature-required; NO_WITHDRAW/NO_ADMIN; no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
            <button type="button" data-qdx-delegate-key-prepare-revoke>prepare delegate/API revoke</button>
            <p class="muted" data-qdx-delegate-key-revoke-status>Calls prepare-only owner-signed delegate/API key revocation; no live DelegateKeyRegistry mutation, no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
          </div>
        </article>
  `;
};

export const renderTradeProofPanel = (fixture) => {
  const { sources, market, orderbook, fill, trade, proof, custody } = fixture;
  const proofJson = JSON.stringify(proof, null, 2);
  const proofSettlementTx = proof.settlementTx ?? 'null (mock)';
  const proofBlockNumber = proof.blockNumber ?? 'null (mock)';
  const proofSettlementMode = proof.settlementMode ?? proof.rawEvent.settlementMode;
  const fillSource = sources?.fills ?? 'unknown-fill-source';
  const proofSource = sources?.proof ?? 'unknown-proof-source';
  const spreadLabel = orderbook.bids.length === 0 && orderbook.asks.length === 0
    ? 'cleared by confirmed mock cross'
    : 'local mock depth';
  const overview = normalizeAccountOverviewPanelFixture(fixture.accountOverview);
  const permissions = (overview.permissions ?? []).join(', ');
  const balanceRows = overview.balances.balances ?? [];
  const openOrderRows = overview.orders.open ?? [];
  const confirmedFillRows = overview.fills.items ?? [];
  const accountLabel = overview.account === null ? 'not connected (mock-local-no-wallet-session)' : overview.account;
  const publicStreamStatus = fixture.publicMarketDataStream?.streamEvent?.reason ?? 'REST/WS mock streams ready';
  const feeBps = fixture.feePolicy?.feeSchedules?.[0]
    ? `${fixture.feePolicy.feeSchedules[0].makerFeeBps}/${fixture.feePolicy.feeSchedules[0].takerFeeBps}`
    : '0/0';

  const renderCompactBalanceRows = () => {
    if (balanceRows.length === 0) {
      return '<li class="book-row muted"><span>mock vault</span><span>0</span><span>no wallet</span></li>';
    }

    return balanceRows.map((balance) => `
      <li class="book-row">
        <span>${escapeHtml(balance.token ?? balance.symbol ?? 'token')}</span>
        <span>${escapeHtml(balance.available ?? '0')}</span>
        <span>${escapeHtml(balance.locked ?? balance.total ?? '0')}</span>
      </li>
    `).join('');
  };

  const renderCompactOpenOrderRows = () => {
    if (openOrderRows.length === 0) {
      return '<li class="book-row muted"><span>open orders</span><span>0</span><span>matcher-local</span></li>';
    }

    return openOrderRows.map((order) => `
      <li class="book-row">
        <span>${escapeHtml(order.marketId ?? 'market')}</span>
        <span>${escapeHtml(order.status ?? 'open')}</span>
        <code>${escapeHtml(shortHash(order.orderHash ?? '0x0000000000000000'))}</code>
      </li>
    `).join('');
  };

  const renderCompactFillRows = () => {
    if (confirmedFillRows.length === 0) {
      return `<li class="book-row"><span>${escapeHtml(trade.tradeId)}</span><span>${escapeHtml(trade.amount)} @ ${escapeHtml(trade.price)}</span><a href="${escapeHtml(trade.proofUrl)}">proof</a></li>`;
    }

    return confirmedFillRows.map((row) => `
      <li class="book-row">
        <span>${escapeHtml(row.fillId ?? 'fill')}</span>
        <span>${escapeHtml(row.amount ?? '0')} @ ${escapeHtml(row.price ?? '0')}</span>
        <code>${escapeHtml(row.sourceEventId ?? 'event')}</code>
      </li>
    `).join('');
  };

  const auditPanels = [
    renderLiveStreamPanel(fixture.liveStream),
    renderOrderStreamPanel(fixture.orderStream, fixture.orders),
    renderBalanceStreamPanel(fixture.balanceStream, fixture.balanceProjection, fixture.balances),
    renderAccountOverviewPanel(fixture.accountOverview),
    renderVaultOperationPanel(fixture.vaultOperation),
    renderDelegateKeyOperationPanel(fixture.delegateKeyOperation),
    renderDelegateKeyHistoryPanel(fixture.delegateKeyHistory),
    renderFeePolicyPanel(fixture.feePolicy),
    renderKlinePanel(fixture.klines),
    renderFeePolicyStreamPanel(fixture.feePolicyStream),
    renderKlineStreamPanel(fixture.klineStream),
    renderPublicMarketDataStreamPanel(fixture.publicMarketDataStream),
    renderDelegateKeyHistoryStreamPanel(fixture.delegateKeyHistoryStream),
    renderVaultHistoryStreamPanel(fixture.vaultHistoryStream),
    renderVaultHistoryPanel(fixture.vaultHistory),
    renderNonceCancellationHistoryPanel(fixture.nonceCancellationHistory),
    renderOpenOrdersPanel(fixture.openOrders),
    renderFillHistoryPanel(fixture.fillHistory),
  ].filter(Boolean).join('\n');

  return `
    <section class="terminal-shell safe-trade-shell" aria-label="Quai Terminal DEX mock vertical slice">
      <header class="topbar exchange-topbar">
        <div class="brand-cluster">
          <span class="logo-mark">QDEX</span>
          <nav class="top-tabs" aria-label="Exchange navigation">
            <span class="top-tab active">exchange</span>
            <span class="top-tab">markets</span>
            <span class="top-tab">wallets</span>
            <span class="top-tab">orders</span>
            <span class="top-tab">api</span>
          </nav>
        </div>
        <div class="status-stack">
          <span class="badge green">API-first</span>
          <span class="badge yellow">settlementMode: ${escapeHtml(market.settlementMode)}</span>
          <span class="badge">${escapeHtml(market.custodyModel)}</span>
          <span class="badge">TUI-safe preview</span>
        </div>
      </header>

      <section class="market-header panel safetrade-title-strip" aria-label="Selected market summary">
        <div class="market-selector-strip">
          <div class="selected-pair-cell">
            <strong>${escapeHtml(market.base)}/${escapeHtml(market.quote)}</strong>
            <small>${escapeHtml(market.id)} · QDEX spot</small>
          </div>
          <nav class="pair-tabs" aria-label="Initial QDEX pairs">
            <span class="active">WQUAI/WQI</span>
            <span>WQUAI/USDT</span>
            <span>WQI/USDT</span>
          </nav>
        </div>
        <div class="ticker-strip" aria-label="Market ticker summary">
          <div><span>last price</span><strong>${escapeHtml(trade.price)}</strong></div>
          <div><span>24h change</span><strong class="green">mock +0.00%</strong></div>
          <div><span>24h high</span><strong>5.4</strong></div>
          <div><span>24h low</span><strong>4.8</strong></div>
          <div><span>volume</span><strong>${escapeHtml(trade.amount)} ${escapeHtml(market.base)}</strong></div>
          <div><span>maker/taker</span><strong>${escapeHtml(feeBps)} bps</strong></div>
        </div>
      </section>

      <section class="exchange-grid">
        <aside class="panel markets-panel" aria-label="Markets">
          <div class="panel-title-row">
            <h2>markets</h2>
            <kbd>/</kbd>
          </div>
          <div class="market-quote-tabs safe-panel-tabs" aria-label="Market quote tabs"><span class="active">all</span><span>WQI</span><span>USDT</span></div>
          <div class="terminal-input ghost-input">/ search market</div>
          <button type="button" class="market-row active">
            <span><strong>${escapeHtml(market.id)}</strong><small>${escapeHtml(market.base)} / ${escapeHtml(market.quote)}</small></span>
            <span class="green">${escapeHtml(trade.price)}</span>
          </button>
          <button type="button" class="market-row" disabled>
            <span><strong>WQUAI-USDT</strong><small>initial fixed pair</small></span>
            <span class="muted">listed</span>
          </button>
          <button type="button" class="market-row" disabled>
            <span><strong>WQI-USDT</strong><small>initial fixed pair</small></span>
            <span class="muted">listed</span>
          </button>
          <p class="microcopy">Initial QDEX market set only: WQUAI/WQI, WQUAI/USDT, WQI/USDT.</p>
        </aside>

        <main class="panel chart-panel" aria-label="Chart and tape">
          <div class="chart-header">
            <div class="chart-tabs safe-panel-tabs" aria-label="Chart tabs">
              <span class="active">price chart</span>
              <span>depth chart</span>
              <span>TradingView slot</span>
            </div>
            <div class="timeframe-tabs" aria-label="Chart intervals"><span class="active">1m</span><span>5m</span><span>15m</span><span>1h</span><span>1d</span></div>
          </div>
          <div class="terminal-chart tradingview-placeholder" aria-label="TradingView chart placeholder">
            <div class="chart-axis"><span>5.4</span><span>5.2</span><span>5.0</span><span>4.8</span></div>
            <div class="chart-canvas">
              <span class="price-line"><b>last ${escapeHtml(trade.price)}</b></span>
              <div class="tv-slot-copy">
                <strong>TradingView chart slot</strong>
                <span>${escapeHtml(market.base)}/${escapeHtml(market.quote)} · ${escapeHtml(publicStreamStatus)}</span>
                <small>placeholder visual only — real widget/data feed later</small>
              </div>
            </div>
          </div>
          <div class="trade-tape">
            <div class="tape-row tape-head"><span>time</span><span>side</span><span>price</span><span>amount</span><span>proof</span></div>
            <div class="tape-row"><span>now</span><span class="green">cross</span><span>${escapeHtml(trade.price)}</span><span>${escapeHtml(trade.amount)}</span><a href="${escapeHtml(trade.proofUrl)}">${escapeHtml(trade.tradeId)}</a></div>
          </div>
        </main>

        <aside class="panel book-panel compact-book" aria-label="Orderbook">
          <div class="panel-title-row"><h2>order book</h2><span class="muted">seq ${escapeHtml(orderbook.sequence)}</span></div>
          <div class="book-table safetrade-book">
            <div class="book-row book-head"><span>price</span><span>amount</span><span>total</span></div>
            <div class="book-side asks">
              <h3>sell orders</h3>
              <ul>${renderOrderbookSide(orderbook.asks, 'display ladder preview — confirmed mock fill cleared the real book', { side: 'ask', price: trade.price })}</ul>
            </div>
            <div class="spread-row"><strong>${escapeHtml(trade.price)}</strong><small> last · ${escapeHtml(spreadLabel)}</small></div>
            <div class="book-side bids">
              <h3>buy orders</h3>
              <ul>${renderOrderbookSide(orderbook.bids, 'display ladder preview — crossed taker consumed resting ask', { side: 'bid', price: trade.price })}</ul>
            </div>
          </div>
          <div class="recent-trades-mini">
            <div class="book-row book-head"><span>recent trades</span><span>price</span><span>amount</span></div>
            <div class="book-row"><span>now</span><span class="green">${escapeHtml(trade.price)}</span><span>${escapeHtml(trade.amount)}</span></div>
            <div class="book-row muted-grid"><span>stream</span><span>mock</span><span>safe</span></div>
          </div>
        </aside>

        <aside class="panel order-entry-panel safetrade-ticket" aria-label="Order entry">
          <div class="panel-title-row"><h2>buy / sell ${escapeHtml(market.base)}</h2><span class="badge">preview only</span></div>
          <div class="ticket-tabs"><button type="button" class="active">buy</button><button type="button">sell</button></div>
          <div class="order-form-grid">
            <div class="order-form-card buy-form-card">
              <div class="form-card-title"><strong>Buy ${escapeHtml(market.base)}</strong><small>with ${escapeHtml(market.quote)}</small></div>
              <label class="ticket-field">price<input value="${escapeHtml(trade.price)}" readonly aria-label="mock order price" /></label>
              <label class="ticket-field">amount<input value="${escapeHtml(trade.amount)}" readonly aria-label="mock order amount" /></label>
              <label class="ticket-field">type<input value="market_ioc slippage=50bps" readonly aria-label="mock order type" /></label>
              <button type="button" class="primary-action" data-qdx-trigger-cross>buy ${escapeHtml(market.base)}<span hidden>submit mock cross</span></button>
              <p class="ticket-status" data-qdx-trigger-status>Local mock cross only · no real Quai tx/explorer/funds.</p>
            </div>
            <div class="order-form-card sell-form-card">
              <div class="form-card-title"><strong>Sell ${escapeHtml(market.base)}</strong><small>receive ${escapeHtml(market.quote)}</small></div>
              <label class="ticket-field">price<input value="${escapeHtml(trade.price)}" readonly aria-label="mock sell order price" /></label>
              <label class="ticket-field">amount<input value="0" readonly aria-label="mock sell order amount" /></label>
              <label class="ticket-field">available<input value="mock vault: read-only" readonly aria-label="mock sell available" /></label>
              <button type="button" class="secondary-action-button" disabled>sell ${escapeHtml(market.base)}</button>
              <p class="ticket-status red-note">Owner wallet controls real withdrawals. Delegate/API keys stay NO_WITHDRAW.</p>
            </div>
          </div>
          <div class="secondary-actions exchange-secondary-actions">
            <button type="button" data-qdx-trigger-cancel>create + cancel mock order</button>
            <button type="button" data-qdx-vault-prepare-deposit>prepare vault deposit</button>
            <button type="button" data-qdx-vault-prepare-withdraw>prepare vault withdrawal</button>
            <button type="button" data-qdx-delegate-key-prepare-register>prepare delegate/API key</button>
            <button type="button" data-qdx-delegate-key-prepare-revoke>prepare delegate/API revoke</button>
          </div>
          <details class="ticket-notes">
            <summary>local action safety notes</summary>
            <p class="muted">Posts a local/dev GTC sell plus IOC buy with signed slippage bounds; no real Quai tx/explorer/funds.</p>
            <p class="muted" data-qdx-cancel-status>Posts one local/dev resting order, then matcher-local cancellation does not cancel on-chain nonce; no real Quai tx/explorer/funds.</p>
            <p class="muted" data-qdx-vault-deposit-status>Calls prepare-only owner-wallet deposit boundary; no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
            <p class="muted" data-qdx-vault-withdraw-status>Calls prepare-only owner-wallet withdrawal boundary; delegates cannot deposit or withdraw; no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
            <p class="muted" data-qdx-delegate-key-register-status>Calls prepare-only owner-signed delegate/API key boundary; owner-wallet-signature-required; NO_WITHDRAW/NO_ADMIN; no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
            <p class="muted" data-qdx-delegate-key-revoke-status>Calls prepare-only owner-signed delegate/API key revocation; no live DelegateKeyRegistry mutation, no wallet/RPC/signing/broadcast/deploy/tx/funds.</p>
          </details>
        </aside>

        <section class="panel account-panel exchange-bottom-panel" aria-label="Account overview">
          <div class="bottom-tabs safe-panel-tabs" aria-label="Order and account tabs">
            <span class="active">open orders</span>
            <span>order history</span>
            <span>trade history</span>
            <span>balances</span>
            <span>proofs</span>
            <span>terminal</span>
          </div>
          <div class="account-summary">
            <div><span>session</span><strong>${escapeHtml(accountLabel)}</strong></div>
            <div><span>permissions</span><strong>${escapeHtml(permissions)}</strong></div>
            <div><span>withdrawals</span><strong>${escapeHtml(custody.withdrawalAuthority)}</strong></div>
          </div>
          <div class="account-columns bottom-table-grid">
            <div><h3>balances</h3><ul>${renderCompactBalanceRows()}</ul></div>
            <div><h3>open orders</h3><ul>${renderCompactOpenOrderRows()}</ul></div>
            <div><h3>fills / proofs</h3><ul>${renderCompactFillRows()}</ul></div>
          </div>
        </section>

        <section class="panel proof-card" aria-label="Proof summary">
          <div class="panel-title-row"><h2>last trade / proof</h2><a href="${escapeHtml(trade.proofUrl)}">${escapeHtml(trade.proofUrl)}</a></div>
          <dl class="kv compact-kv">
            <div><dt>trade</dt><dd><code>${escapeHtml(trade.tradeId)}</code></dd></div>
            <div><dt>fill</dt><dd><code>${escapeHtml(trade.fillId)}</code></dd></div>
            <div><dt>market</dt><dd>${escapeHtml(trade.marketId)}</dd></div>
            <div><dt>price</dt><dd>price ${escapeHtml(trade.price)}</dd></div>
            <div><dt>amount</dt><dd>amount ${escapeHtml(trade.amount)}</dd></div>
            <div><dt>status</dt><dd><span class="green">mock settlement confirmed</span></dd></div>
            <div><dt>fill source</dt><dd>${escapeHtml(fillSource)}</dd></div>
            <div><dt>projection type</dt><dd><code>${escapeHtml(fill.projectionType)}</code></dd></div>
            <div><dt>source event</dt><dd><code>${escapeHtml(fill.sourceEventId)}</code></dd></div>
          </dl>
        </section>

        <section class="panel command-palette-skeleton-panel command-deck" aria-label="Command palette">
          <div class="panel-title-row"><h2>terminal command-palette skeleton</h2><span class="badge">preview-only-no-dispatch</span></div>
          <p class="warning">${escapeHtml(fixture.commandPalette.safety.notice)}</p>
          <dl class="kv compact-kv visually-compact">
            <div><dt>source</dt><dd>${escapeHtml(fixture.commandPalette.source)}</dd></div>
            <div><dt>mode</dt><dd>${escapeHtml(fixture.commandPalette.mode)}</dd></div>
            <div><dt>dispatch</dt><dd>${escapeHtml(fixture.commandPalette.dispatchMode)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml((fixture.commandPalette.permissions ?? []).join(', '))}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(fixture.commandPalette.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(fixture.commandPalette.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(fixture.commandPalette.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(fixture.commandPalette.tradingVaultMutation)}</dd></div>
            <div><dt>MarketRegistry mutation</dt><dd>${escapeHtml(fixture.commandPalette.marketRegistryMutation)}</dd></div>
            <div><dt>DelegateKeyRegistry mutation</dt><dd>${escapeHtml(fixture.commandPalette.delegateKeyRegistryMutation)}</dd></div>
            <div><dt>delegate can withdraw</dt><dd>${escapeHtml(fixture.commandPalette.delegateCanWithdraw)}</dd></div>
            <div><dt>delegate can admin</dt><dd>${escapeHtml(fixture.commandPalette.delegateCanAdmin)}</dd></div>
          </dl>
          <form class="command-form" data-qdx-command-palette-form>
            <label>command<input data-qdx-command-palette-input value=":proof trade-000001" aria-label="terminal command palette input" /></label>
            <button type="submit">preview command</button>
          </form>
          <p class="muted" data-qdx-command-palette-status>Preview-only skeleton: choose a known command; no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.</p>
          <div class="command-chip-grid">
            ${(fixture.commandPalette.commands ?? []).map((command) => `<code>${escapeHtml(command.command)}</code>`).join('')}
          </div>
          <p class="warning">Matcher-local cancellation does not mutate on-chain NonceManager nonces. Delegate/API key commands keep delegate can withdraw false and delegate can admin false.</p>
        </section>

        <section class="panel keyboard-shortcut-help-panel shortcuts-deck" data-qdx-keyboard-shortcuts-panel aria-label="Keyboard shortcuts">
          <div class="panel-title-row"><h2>terminal keyboard-shortcut help</h2><span class="badge">help-only-no-dispatch</span></div>
          <p class="warning">${escapeHtml(fixture.keyboardShortcuts.safety.notice)}</p>
          <p class="muted" data-qdx-keyboard-shortcuts-status>Waiting for local API keyboard-shortcut help smoke; help-only-no-dispatch and no wallet/RPC/signing/broadcast/deploy/tx/funds behavior.</p>
          <dl class="kv compact-kv visually-compact">
            <div><dt>source</dt><dd>${escapeHtml(fixture.keyboardShortcuts.source)}</dd></div>
            <div><dt>mode</dt><dd>${escapeHtml(fixture.keyboardShortcuts.mode)}</dd></div>
            <div><dt>dispatch</dt><dd>${escapeHtml(fixture.keyboardShortcuts.dispatchMode)}</dd></div>
            <div><dt>permissions</dt><dd>${escapeHtml((fixture.keyboardShortcuts.permissions ?? []).join(', '))}</dd></div>
            <div><dt>real Quai tx</dt><dd>${escapeHtml(fixture.keyboardShortcuts.realQuaiTransactions)}</dd></div>
            <div><dt>wallet required</dt><dd>${escapeHtml(fixture.keyboardShortcuts.walletRequired)}</dd></div>
            <div><dt>funds moved</dt><dd>${escapeHtml(fixture.keyboardShortcuts.fundsMoved)}</dd></div>
            <div><dt>TradingVault mutation</dt><dd>${escapeHtml(fixture.keyboardShortcuts.tradingVaultMutation)}</dd></div>
            <div><dt>MarketRegistry mutation</dt><dd>${escapeHtml(fixture.keyboardShortcuts.marketRegistryMutation)}</dd></div>
            <div><dt>DelegateKeyRegistry mutation</dt><dd>${escapeHtml(fixture.keyboardShortcuts.delegateKeyRegistryMutation)}</dd></div>
            <div><dt>delegate can withdraw</dt><dd>${escapeHtml(fixture.keyboardShortcuts.delegateCanWithdraw)}</dd></div>
            <div><dt>delegate can admin</dt><dd>${escapeHtml(fixture.keyboardShortcuts.delegateCanAdmin)}</dd></div>
          </dl>
          <div class="shortcut-grid">
            ${(fixture.keyboardShortcuts.shortcuts ?? []).map((shortcut) => `<span><kbd>${escapeHtml(shortcut.key)}</kbd> ${escapeHtml(shortcut.label)} <small>${escapeHtml(`${shortcut.key} ${shortcut.label}`)} · ${escapeHtml(shortcut.actionType)} · ${escapeHtml(shortcut.surface)} · ${escapeHtml(shortcut.dispatchMode)}</small></span>`).join('')}
          </div>
          <pre>:sell WQUAI-WQI 100 @ 5
:buy WQUAI-WQI 100 market_ioc slippage=50bps
:proof trade-000001
:cancel all matcher-local
:deposit WQI 10 prepare owner-wallet-only
:withdraw WQUAI 1 prepare owner-wallet-only
:api create-key bot-mm-1 prepare owner-wallet-signature-required NO_WITHDRAW
:api revoke-key bot-mm-1 prepare owner-wallet-signature-required NO_ADMIN</pre>
          <p class="warning">Matcher-local cancellation does not mutate on-chain NonceManager nonces. Owner-wallet prepare hints remain no wallet/RPC/signing/broadcast/deploy/tx/funds behavior. Delegate/API key hints keep delegate can withdraw false and delegate can admin false.</p>
        </section>

        <article class="panel log-panel">
          <h2>execution log</h2>
          <pre>&gt; wallet connected in mock/dev mode
&gt; resting sell accepted: ${escapeHtml(shortHash(fill.makerOrderHash))}
&gt; order signed locally
&gt; crossing buy accepted: ${escapeHtml(shortHash(fill.takerOrderHash))}
&gt; fill packet created: ${escapeHtml(fill.fillId)}
&gt; mock settlement reference: ${escapeHtml(proof.mockSettlementReference)}
&gt; proof projected: ${escapeHtml(trade.proofUrl)}</pre>
        </article>
      </section>

      <details class="audit-drawer">
        <summary>audit / projection details — mock proof only, no real Quai transaction, no explorer URL, no funds moved</summary>
        <section class="audit-grid">
          <article class="panel proof-panel">
            <h2>proof projection</h2>
            <p class="warning">Mock proof only: no real Quai transaction, no explorer URL, no funds moved.</p>
            <dl class="kv">
              <div><dt>settlement tx</dt><dd><code>${escapeHtml(proofSettlementTx)}</code></dd></div>
              <div><dt>mock reference</dt><dd><code>${escapeHtml(proof.mockSettlementReference)}</code></dd></div>
              <div><dt>block</dt><dd>${escapeHtml(proofBlockNumber)}</dd></div>
              <div><dt>event index</dt><dd>${escapeHtml(proof.eventIndex)}</dd></div>
              <div><dt>proof source</dt><dd>${escapeHtml(proofSource)}</dd></div>
              <div><dt>created from</dt><dd><code>${escapeHtml(proof.createdFromEventId)}</code></dd></div>
              <div><dt>settlementMode</dt><dd>${escapeHtml(proofSettlementMode)}</dd></div>
              <div><dt>maker order</dt><dd><code>${escapeHtml(shortHash(fill.makerOrderHash))}</code></dd></div>
              <div><dt>taker order</dt><dd><code>${escapeHtml(shortHash(fill.takerOrderHash))}</code></dd></div>
            </dl>
            <details>
              <summary>raw proof event</summary>
              <pre>${escapeHtml(proofJson)}</pre>
            </details>
          </article>
          ${auditPanels}
        </section>
      </details>
    </section>
  `;
};
