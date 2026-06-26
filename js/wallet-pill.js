/**
 * Wallet Pill — Shared wallet connection for the topnav pill
 * Loads on all pages: index.html, mining.html, controller_view.html, qdex.html
 *
 * Uses localStorage to persist wallet state across pages.
 * On QDEX page, delegates to qdex.js for actual balance/orderbook logic.
 * On other pages, just shows connected state.
 */

(function () {
  const STORAGE_KEY = 'bitquai_wallet';

  function shortAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  function loadWallet() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function saveWallet(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function clearWallet() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function updatePill(wallet) {
    const btn = document.querySelector('.navlinks .wallet-btn');
    if (!btn) return;

    if (wallet && wallet.address) {
      btn.className = 'wallet-btn connected';
      btn.href = '#';
      btn.title = wallet.address;
      btn.textContent = shortAddress(wallet.address);
      btn.onclick = function (e) {
        e.preventDefault();
        if (confirm('Disconnect wallet ' + shortAddress(wallet.address) + '?')) {
          clearWallet();
          updatePill(null);
          window.dispatchEvent(new CustomEvent('bitquai:wallet-disconnect'));
          location.reload();
        }
      };
    } else {
      btn.className = 'wallet-btn';
      btn.href = '#';
      btn.title = 'Connect your wallet';
      btn.textContent = 'Connect Wallet';
      btn.onclick = function (e) {
        e.preventDefault();
        connectWallet();
      };
    }
  }

  async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts && accounts.length > 0) {
          const wallet = {
            address: accounts[0],
            provider: 'metamask',
          };
          saveWallet(wallet);
          updatePill(wallet);
          window.dispatchEvent(new CustomEvent('bitquai:wallet-connect', { detail: wallet }));

          // Listen for account changes
          window.ethereum.on('accountsChanged', function (changed) {
            if (changed.length === 0) {
              clearWallet();
              updatePill(null);
              window.dispatchEvent(new CustomEvent('bitquai:wallet-disconnect'));
            } else {
              const wallet = { address: changed[0], provider: 'metamask' };
              saveWallet(wallet);
              updatePill(wallet);
              window.dispatchEvent(new CustomEvent('bitquai:wallet-connect', { detail: wallet }));
            }
          });
        }
      } catch (err) {
        console.warn('Wallet connect failed:', err);
      }
    } else {
      alert(
        'MetaMask not detected. Install MetaMask or a compatible wallet to connect.\n\nhttps://metamask.io/download/'
      );
    }
  }

  // On page load: restore wallet from localStorage and update pill
  function init() {
    const saved = loadWallet();
    if (saved && saved.address) {
      updatePill(saved);
      // Dispatch event for other scripts (e.g., qdex.js) to pick up
      window.dispatchEvent(new CustomEvent('bitquai:wallet-restored', { detail: saved }));
    } else {
      updatePill(null);
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
