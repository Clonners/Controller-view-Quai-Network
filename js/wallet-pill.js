/**
 * Wallet Pill — Shared wallet connection for the topnav pill
 * Loads on all pages: index.html, mining.html, controller_view.html, qdex.html
 *
 * ONLY connects Quai Network wallets (Pelagus, MetaMask with Quai network).
 * Rejects non-Quai EVM networks to prevent fund loss.
 */

(function () {
  const STORAGE_KEY = 'bitquai_wallet';
  const QUAI_CHAIN_IDS = [15000, 15001, 15002, 100, 101, 102]; // Orchard + Mainnet

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
      // Validate it's still a Quai wallet
      if (wallet.chainId && !QUAI_CHAIN_IDS.includes(wallet.chainId)) {
        // Wrong network stored — clear it
        clearWallet();
        updatePill(null);
        return;
      }

      btn.className = 'wallet-btn connected';
      btn.href = '#';
      btn.title = `${wallet.address} (Quai ${wallet.networkName || 'Orchard'})`;
      btn.textContent = shortAddress(wallet.address);
      btn.onclick = function (e) {
        e.preventDefault();
        if (confirm('Disconnect wallet ' + shortAddress(wallet.address) + '?')) {
          disconnectWallet();
          clearWallet();
          updatePill(null);
          window.dispatchEvent(new CustomEvent('bitquai:wallet-disconnect'));
          location.reload();
        }
      };
    } else {
      btn.className = 'wallet-btn';
      btn.href = '#';
      btn.title = 'Connect your Quai wallet (Pelagus or MetaMask)';
      btn.textContent = 'Connect Wallet';
      btn.onclick = function (e) {
        e.preventDefault();
        connectWallet();
      };
    }
  }

  let quaiWallet = null;

  async function connectWallet() {
    if (!window.QuaiWallet) {
      console.warn('QuaiWallet SDK not loaded');
      alert('QuaiWallet SDK not available. Please reload the page.');
      return;
    }

    try {
      quaiWallet = new QuaiWallet({
        chainId: 0x3A98, // 15000 = Orchard Cyprus-1
        networkName: 'Quai Orchard Cyprus-1',
        rpcUrl: 'https://orchard.rpc.quai.network/cyprus1',
      });

      const result = await quaiWallet.connect();

      if (!result || !result.address) {
        throw new Error('No wallet address returned');
      }

      // STRICT: Final validation
      if (!QUAI_CHAIN_IDS.includes(result.chainId)) {
        throw new Error('Not on Quai Network. Connection rejected.');
      }

      const walletData = {
        address: result.address,
        provider: 'quai',
        chainId: result.chainId,
        networkName: result.networkName,
      };

      saveWallet(walletData);
      updatePill(walletData);
      window.quaiWalletInstance = quaiWallet;
      window.dispatchEvent(new CustomEvent('bitquai:wallet-connect', { detail: walletData }));

      // Listen for account changes
      quaiWallet.on('accountsChanged', (accounts) => {
        const walletData = { address: accounts[0], provider: 'quai', chainId: quaiWallet.chainId };
        saveWallet(walletData);
        updatePill(walletData);
        window.dispatchEvent(new CustomEvent('bitquai:wallet-connect', { detail: walletData }));
      });

      quaiWallet.on('disconnect', () => {
        clearWallet();
        updatePill(null);
        window.dispatchEvent(new CustomEvent('bitquai:wallet-disconnect'));
      });

      // WRONG NETWORK handler
      quaiWallet.on('wrongNetwork', (chainId) => {
        console.warn('[Wallet] Wrong network detected:', chainId);
        clearWallet();
        updatePill(null);
        window.dispatchEvent(new CustomEvent('bitquai:wallet-wrong-network', { detail: { chainId } }));
        alert('You switched to a non-Quai network. Wallet disconnected for safety.');
      });

    } catch (err) {
      console.warn('Wallet connect failed:', err);
      if (err.message.includes('Quai')) {
        alert(err.message);
      } else {
        alert('Wallet connection failed: ' + err.message);
      }
    }
  }

  function disconnectWallet() {
    if (quaiWallet) {
      quaiWallet.disconnect();
      quaiWallet = null;
    }
  }

  // Expose global API for other scripts
  window.getQuaiWallet = function () {
    return quaiWallet;
  };

  window.getWalletSigner = async function () {
    if (!quaiWallet) {
      const saved = loadWallet();
      if (saved && saved.address) {
        try {
          quaiWallet = new QuaiWallet({
            chainId: 0x3A98,
            networkName: 'Quai Orchard Cyprus-1',
          });
          const accounts = await quaiWallet.getAccounts();
          if (accounts && accounts.length > 0) {
            // Validate chain
            const chainId = await quaiWallet.provider.request({ method: 'eth_chainId' });
            if (!QUAI_CHAIN_IDS.includes(parseInt(chainId, 16))) {
              throw new Error('Not on Quai Network');
            }
            quaiWallet.accounts = accounts;
            quaiWallet.signer = new QuaiSigner(window.ethereum, accounts[0]);
            return quaiWallet.getSigner();
          }
        } catch (e) {
          console.warn('Failed to restore wallet signer:', e);
          clearWallet();
        }
      }
      return null;
    }
    return quaiWallet.getSigner();
  };

  // On page load: restore wallet from localStorage with validation
  function init() {
    const saved = loadWallet();
    if (saved && saved.address) {
      // Validate stored wallet is Quai
      if (!QUAI_CHAIN_IDS.includes(saved.chainId)) {
        clearWallet();
        updatePill(null);
        return;
      }

      updatePill(saved);
      window.dispatchEvent(new CustomEvent('bitquai:wallet-restored', { detail: saved }));

      // Try to restore QuaiWallet connection silently
      if (window.QuaiWallet) {
        try {
          quaiWallet = new QuaiWallet({
            chainId: 0x3A98,
            networkName: 'Quai Orchard Cyprus-1',
          });
          quaiWallet.getAccounts().then((accounts) => {
            if (accounts && accounts.length > 0) {
              quaiWallet.accounts = accounts;
              quaiWallet.signer = new QuaiSigner(window.ethereum, accounts[0]);
              window.dispatchEvent(new CustomEvent('bitquai:wallet-restored', { detail: saved }));
            }
          }).catch(() => {
            clearWallet();
            updatePill(null);
          });
        } catch (e) {
          console.warn('Failed to restore wallet connection:', e);
        }
      }
    } else {
      updatePill(null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
