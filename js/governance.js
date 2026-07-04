/**
 * Governance Dashboard — Live Data
 *
 * Connects governance.html to QDEX DAO on-chain data via qdex-dao-sdk.js.
 * Graceful fallback: if DAO is not deployed (0x00... addresses), shows
 * a clear "Not Deployed" state instead of empty zeros.
 *
 * Uses shared wallet-pill.js for wallet connection.
 */

(function () {
  'use strict';

  // ── DAO Addresses (mirrored from qdex-dao-sdk.js QDEX_DAO) ────
  const QDEX_DAO = {
    daoShip: '0x0000000000000000000000000000000000000000',
    shares: '0x0000000000000000000000000000000000000000',
    loot: '0x0000000000000000000000000000000000000000',
    vault: '0x0000000000000000000000000000000000000000',
  };

  function isZero(addr) {
    return !addr || /^0x0+$/.test(addr.toLowerCase());
  }

  function isDaoDeployed() {
    return !isZero(QDEX_DAO.daoShip) && !isZero(QDEX_DAO.shares);
  }

  function shortAddr(addr) {
    if (!addr) return '—';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  function fmt(num, decimals = 2) {
    try {
      return Number(num).toFixed(decimals);
    } catch { return '0.00'; }
  }

  // ── DOM Helpers ─────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function setLoading(id) {
    const el = $(id);
    if (el) el.innerHTML = '<div class="empty-state"><div class="icon">⟳</div><p>Loading...</p></div>';
  }

  function setNotDeployed() {
    // Proposals list
    const pl = $('#proposalsList');
    if (pl) {
      pl.innerHTML = `
        <div class="empty-state">
          <div class="icon">🏗️</div>
          <p>DAO not yet deployed</p>
          <p style="margin-top:8px;font-size:11px;">The QDEX Protocol DAO has not been deployed to Orchard Cyprus-1 yet. When deployed, proposals, voting, and treasury will appear here.</p>
          <a href="https://github.com/Clonners/Controller-view-Quai-Network" target="_blank" rel="noopener" style="margin-top:16px;padding:8px 16px;background:var(--accent);color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Deploy Guide →</a>
        </div>`;
    }
    // Count
    const count = $('.panel-header .count');
    if (count) count.textContent = 'pending deploy';
    // Voting power
    const vpValues = $$('.voting-power .value');
    vpValues.forEach(el => { el.textContent = '—'; });
    // Treasury
    const treasuryAmounts = $$('.treasury-token .amount');
    treasuryAmounts.forEach(el => { el.textContent = '—'; });
    // Status indicator
    const statusDot = $('.status-dot');
    if (statusDot) { statusDot.className = 'status-dot mock'; }
    const statusText = $('.topbar-status span');
    if (statusText) statusText.textContent = 'Not Deployed';
  }

  // ── RPC Read (no wallet needed) ─────────────────────────────
  async function rpcCall(data, chainId) {
    try {
      const res = await fetch('https://orchard.rpc.quai.network/cyprus1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'quai_call',
          params: [{ to: data.to, data: data.data }, 'latest'],
          chainId,
        }),
      });
      const json = await res.json();
      return json.result || '0x';
    } catch {
      try {
        const res = await fetch('https://orchard.rpc.quai.network/cyprus1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: data.to, data: data.data }, 'latest'],
          }),
        });
        const json = await res.json();
        return json.result || '0x';
      } catch { return '0x'; }
    }
  }

  function pad32(val) {
    if (typeof val === 'string' && val.startsWith('0x')) {
      return '0x' + val.slice(2).padStart(64, '0');
    }
    return '0x' + BigInt(val).toString(16).padStart(64, '0');
  }

  // ── Read Proposal Count ─────────────────────────────────────
  async function readProposalCount() {
    if (isZero(QDEX_DAO.daoShip)) return 0;
    // proposalCount() selector
    const selector = '0x5c975ab0'; // proposalCount()
    const result = await rpcCall({
      to: QDEX_DAO.daoShip,
      data: selector,
    });
    try {
      return Number(BigInt(result || '0x0'));
    } catch { return 0; }
  }

  // ── Read Shares Balance ─────────────────────────────────────
  async function readSharesBalance(address) {
    if (isZero(QDEX_DAO.shares) || !address) return 0;
    const selector = '0x70a08231'; // balanceOf(address)
    const result = await rpcCall({
      to: QDEX_DAO.shares,
      data: selector + pad32(address).slice(2),
    });
    try {
      return Number(BigInt(result || '0x0'));
    } catch { return 0; }
  }

  // ── Read Voting Power ───────────────────────────────────────
  async function readVotingPower(address) {
    if (isZero(QDEX_DAO.daoShip) || !address) return 0;
    // votingPower(address) selector
    const selector = '0x6c17a03a';
    const result = await rpcCall({
      to: QDEX_DAO.daoShip,
      data: selector + pad32(address).slice(2),
    });
    try {
      return Number(BigInt(result || '0x0'));
    } catch { return 0; }
  }

  // ── Read Loot Balance ───────────────────────────────────────
  async function readLootBalance(address) {
    if (isZero(QDEX_DAO.loot) || !address) return 0;
    const selector = '0x70a08231';
    const result = await rpcCall({
      to: QDEX_DAO.loot,
      data: selector + pad32(address).slice(2),
    });
    try {
      return Number(BigInt(result || '0x0'));
    } catch { return 0; }
  }

  // ── Read Vault Balance (QUAI) ───────────────────────────────
  async function readVaultBalance() {
    if (isZero(QDEX_DAO.vault)) return 0;
    const selector = '0xc5f9ddcf'; // balance()
    const result = await rpcCall({
      to: QDEX_DAO.vault,
      data: selector,
    });
    try {
      return Number(BigInt(result || '0x0')) / 1e18;
    } catch { return 0; }
  }

  // ── Update UI ───────────────────────────────────────────────
  function updateProposals(count) {
    const pl = $('#proposalsList');
    const countEl = $('.panel-header .count');
    if (!pl) return;

    if (countEl) countEl.textContent = `${count} proposal${count !== 1 ? 's' : ''}`;

    if (count === 0) {
      pl.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          <p>No proposals yet</p>
          <p style="margin-top:8px;font-size:11px;">Submit the first proposal to start governance</p>
        </div>`;
      return;
    }

    // Show proposals list (basic for now, detailed view on click)
    let html = '';
    for (let i = count - 1; i >= Math.max(0, count - 20); i--) {
      html += `
        <div class="proposal-item" data-id="${i}">
          <div class="id">Proposal #${i}</div>
          <div class="meta">
            <span class="status-badge voting">Active</span>
          </div>
        </div>`;
    }
    pl.innerHTML = html;

    // Click handler for proposal detail
    pl.querySelectorAll('.proposal-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        loadProposalDetail(parseInt(id));
      });
    });
  }

  function loadProposalDetail(id) {
    // TODO: Fetch proposal details from chain
    console.log('[Governance] Loading proposal', id);
  }

  function updateVotingPower(shares, power, loot) {
    const values = $$('.voting-power .value');
    if (values[0]) values[0].textContent = fmt(shares / 1e18, 4);
    if (values[1]) values[1].textContent = fmt(power / 1e18, 4);
    if (values[2]) values[2].textContent = fmt(loot / 1e18, 4);
  }

  function updateTreasury(quaiBalance) {
    const amounts = $$('.treasury-token .amount');
    if (amounts[0]) amounts[0].textContent = fmt(quaiBalance, 4);
    // WQI and USDT would need separate token reads
    if (amounts[1]) amounts[1].textContent = '—';
    if (amounts[2]) amounts[2].textContent = '—';
  }

  function updateWalletUI(address) {
    const walletBtn = $('#walletBtn');
    if (!walletBtn) return;

    if (address) {
      walletBtn.textContent = shortAddr(address);
      walletBtn.onclick = function (e) {
        e.preventDefault();
        if (confirm(`Disconnect ${shortAddr(address)}?`)) {
          window.dispatchEvent(new CustomEvent('bitquai:wallet-disconnect'));
          window.location.reload();
        }
      };
    } else {
      walletBtn.textContent = 'Connect Wallet';
      walletBtn.onclick = function (e) {
        e.preventDefault();
        connectWalletGovernance();
      };
    }
  }

  async function connectWalletGovernance() {
    if (window.QuaiWallet) {
      try {
        const wallet = new QuaiWallet({
          chainId: 0x3A98,
          networkName: 'Quai Orchard Cyprus-1',
          rpcUrl: 'https://orchard.rpc.quai.network/cyprus1',
        });
        const result = await wallet.connect();
        window.quaiWalletInstance = wallet;
        updateWalletUI(result.address);
        window.dispatchEvent(new CustomEvent('bitquai:wallet-connect', { detail: result }));
        // Refresh data with wallet address
        refreshWithAddress(result.address);
      } catch (err) {
        console.warn('[Governance] Wallet connect failed:', err);
      }
    } else {
      alert('QuaiWallet not loaded. Please use a Quai wallet (Pelagus or MetaMask with Quai network).');
    }
  }

  async function refreshWithAddress(address) {
    if (!isDaoDeployed()) return;
    try {
      const [shares, power, loot] = await Promise.all([
        readSharesBalance(address),
        readVotingPower(address),
        readLootBalance(address),
      ]);
      updateVotingPower(shares, power, loot);
    } catch (err) {
      console.warn('[Governance] Failed to read balances:', err);
    }
  }

  // ── Tab Switching ───────────────────────────────────────────
  function initTabs() {
    $$('.topbar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.topbar-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
  }

  // ── Navigation ──────────────────────────────────────────────
  function initNavigation() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
      });
    });
  }

  // ── Delegate Button ─────────────────────────────────────────
  function initDelegate() {
    const btn = $('.delegate-btn');
    const input = $('.delegate-input');
    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
      if (!isDaoDeployed()) {
        alert('DAO not yet deployed');
        return;
      }
      const address = input.value.trim();
      if (!address || !address.startsWith('0x') || address.length < 40) {
        alert('Enter a valid Quai address');
        return;
      }

      const wallet = window.quaiWalletInstance;
      if (!wallet) {
        alert('Connect wallet first');
        return;
      }

      try {
        // delegate(address) selector: 0x35a2e7da
        const selector = '0x35a2e7da';
        const data = selector + pad32(address).slice(2);

        const txHash = await wallet.provider.request({
          method: 'quai_sendTransaction',
          params: [{
            from: wallet.accounts[0],
            to: QDEX_DAO.daoShip,
            data,
          }],
        });

        if (!txHash) {
          await wallet.provider.request({
            method: 'eth_sendTransaction',
            params: [{
              from: wallet.accounts[0],
              to: QDEX_DAO.daoShip,
              data,
            }],
          });
        }

        alert('Delegation transaction sent!');
        input.value = '';
      } catch (err) {
        console.warn('[Governance] Delegation failed:', err);
        alert('Delegation failed: ' + (err.message || err));
      }
    });
  }

  // ── Status Dot Update ───────────────────────────────────────
  function updateStatus() {
    const dot = $('.status-dot');
    const text = $('.topbar-status span');
    if (isDaoDeployed()) {
      if (dot) dot.className = 'status-dot'; // green
      if (text) text.textContent = 'Orchard Cyprus-1';
    } else {
      if (dot) dot.className = 'status-dot mock'; // yellow
      if (text) text.textContent = 'Not Deployed';
    }
  }

  // ── Main Init ───────────────────────────────────────────────
  async function init() {
    initTabs();
    initNavigation();
    initDelegate();

    // Check wallet connection
    const wallet = window.getQuaiWallet?.();
    if (wallet && wallet.accounts?.[0]) {
      updateWalletUI(wallet.accounts[0]);
    }

    // Check DAO deployment
    if (!isDaoDeployed()) {
      setNotDeployed();
      updateStatus();
      return;
    }

    updateStatus();

    // Load on-chain data
    try {
      const [proposalCount, vaultBalance] = await Promise.all([
        readProposalCount(),
        readVaultBalance(),
      ]);

      updateProposals(proposalCount);
      updateTreasury(vaultBalance);

      if (wallet?.accounts?.[0]) {
        refreshWithAddress(wallet.accounts[0]);
      }
    } catch (err) {
      console.warn('[Governance] Init failed:', err);
    }

    // Listen for wallet connect/disconnect
    window.addEventListener('bitquai:wallet-connect', (e) => {
      updateWalletUI(e.detail?.address);
      if (e.detail?.address) {
        refreshWithAddress(e.detail.address);
      }
    });

    window.addEventListener('bitquai:wallet-disconnect', () => {
      updateWalletUI(null);
      updateVotingPower(0, 0, 0);
    });

    // Auto-refresh every 30s
    setInterval(async () => {
      if (!isDaoDeployed()) return;
      try {
        const [count, vault] = await Promise.all([
          readProposalCount(),
          readVaultBalance(),
        ]);
        updateProposals(count);
        updateTreasury(vault);
        const w = window.getQuaiWallet?.();
        if (w?.accounts?.[0]) refreshWithAddress(w.accounts[0]);
      } catch { /* silent */ }
    }, 30000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
