/**
 * Quai Wallet Connector
 * 
 * ONLY allows Quai Network wallets on Quai chains.
 * Rejects MetaMask on non-Quai EVM networks.
 * 
 * Supported wallets:
 * - Pelagus (Quai native)
 * - MetaMask configured with Quai network
 * - Any wallet that reports Quai chain IDs
 * 
 * Quai chain IDs:
 * - 15000 (0x3A98) = Orchard Cyprus-1
 * - 15001 (0x3A99) = Orchard Cyprus-2
 * - 15002 (0x3A9A) = Orchard Cyprus-3
 * - 100   (0x64)   = Mainnet Solana-1
 * - 101   (0x65)   = Mainnet Solana-2
 * - 102   (0x66)   = Mainnet Solana-3
 */

const QUAI_CHAIN_IDS = new Set([
  15000, 15001, 15002, // Orchard testnet
  100, 101, 102,       // Mainnet
]);

const QUAI_RPC_URLS = [
  'https://orchard.rpc.quai.network',
  'https://rpc.quai.network',
  'https://api.bitquai.live',
];

function isQuaiChainId(chainId) {
  const num = parseInt(chainId, 16) || chainId;
  return QUAI_CHAIN_IDS.has(num);
}

function isQuaiProvider(provider) {
  // Check if provider is on a Quai RPC
  const url = provider.connection?.url || provider.host || '';
  return QUAI_RPC_URLS.some(rpc => url.includes(rpc));
}

class QuaiWallet {
  constructor({ chainId, networkName, rpcUrl } = {}) {
    this.provider = window.ethereum || window.quai;
    this.targetChainId = chainId || 0x3A98; // 15000 = Orchard Cyprus-1
    this.targetNetworkName = networkName || 'Quai Orchard Cyprus-1';
    this.targetRpcUrl = rpcUrl || 'https://orchard.rpc.quai.network/cyprus1';
    this.accounts = [];
    this.signer = null;
    this._listeners = {};
  }

  isWalletAvailable() {
    return !!(this.provider && typeof this.provider.request === 'function');
  }

  async connect() {
    if (!this.isWalletAvailable()) {
      throw new Error('No Quai wallet detected. Install Pelagus or add Quai network to MetaMask.');
    }

    // STRICT: Verify we're on a Quai network BEFORE requesting accounts
    const currentChainId = await this.#getCurrentChainId();
    
    if (!isQuaiChainId(currentChainId)) {
      // Try to switch to Quai network
      const switched = await this.switchToQuaiNetwork();
      if (!switched) {
        throw new Error('Could not switch to Quai Network. Please add Quai network to your wallet manually or use Pelagus wallet.');
      }
    }

    let accounts;
    try {
      accounts = await this.provider.request({
        method: 'quai_requestAccounts',
      });
    } catch (e) {
      try {
        accounts = await this.provider.request({
          method: 'eth_requestAccounts',
        });
      } catch (err) {
        throw new Error('User denied wallet connection');
      }
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    // Final chain ID verification AFTER connection
    const finalChainId = await this.#getCurrentChainId();
    if (!isQuaiChainId(finalChainId)) {
      throw new Error('Wallet is not on Quai Network. Please switch to Quai chain.');
    }

    this.accounts = accounts;
    this.chainId = finalChainId;
    this.signer = new QuaiSigner(this.provider, accounts[0]);

    // Listen for account changes
    this._onAccountsChanged = (changed) => {
      this.accounts = changed;
      if (changed.length === 0) {
        this.signer = null;
        this._emit('disconnect');
      } else {
        this.signer = new QuaiSigner(this.provider, changed[0]);
        this._emit('accountsChanged', changed);
      }
    };

    // Listen for network changes - REJECT non-Quai networks
    this._onChainChanged = async (chainId) => {
      const num = parseInt(chainId, 16);
      if (!isQuaiChainId(num)) {
        // Auto-switch back to Quai or disconnect
        await this.switchToQuaiNetwork().catch(() => {
          this._emit('wrongNetwork', num);
          this.signer = null;
          this._emit('disconnect');
        });
      } else {
        this.chainId = num;
        this._emit('chainChanged', this.chainId);
      }
    };

    this.provider.on('accountsChanged', this._onAccountsChanged);
    this.provider.on('chainChanged', this._onChainChanged);

    return {
      address: this.accounts[0],
      chainId: this.chainId,
      networkName: this.targetNetworkName,
    };
  }

  async #getCurrentChainId() {
    try {
      const chainId = await this.provider.request({
        method: 'eth_chainId',
      });
      return parseInt(chainId, 16);
    } catch {
      return this.targetChainId;
    }
  }

  async getAccounts() {
    if (!this.isWalletAvailable()) {
      return [];
    }

    try {
      const accounts = await this.provider.request({
        method: 'quai_accounts',
      });
      return accounts || [];
    } catch (e) {
      try {
        const accounts = await this.provider.request({
          method: 'eth_accounts',
        });
        return accounts || [];
      } catch {
        return [];
      }
    }
  }

  getSigner() {
    return this.signer;
  }

  async signMessage(message, address) {
    // Verify chain before signing
    const chainId = await this.#getCurrentChainId();
    if (!isQuaiChainId(chainId)) {
      throw new Error('Not on Quai Network. Cannot sign.');
    }

    return this.provider.request({
      method: 'personal_sign',
      params: [message, address || this.accounts[0]],
    });
  }

  async switchToQuaiNetwork() {
    const quaiChainId = `0x${this.targetChainId.toString(16).toUpperCase()}`;

    // Try to switch to existing network
    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: quaiChainId }],
      });
      return true;
    } catch (switchError) {
      // Error 4901 means chain not added
      if (switchError.code === 4901) {
        try {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: quaiChainId,
              chainName: this.targetNetworkName,
              nativeCurrency: { name: 'QI', symbol: 'QI', decimals: 18 },
              rpcUrls: [this.targetRpcUrl],
              blockExplorerUrls: ['https://orchard.quaiscan.io'],
            }],
          });
          return true;
        } catch (addError) {
          throw new Error('Failed to add Quai network');
        }
      }
      throw switchError;
    }
  }

  disconnect() {
    if (this.provider) {
      if (this._onAccountsChanged) {
        this.provider.removeListener('accountsChanged', this._onAccountsChanged);
      }
      if (this._onChainChanged) {
        this.provider.removeListener('chainChanged', this._onChainChanged);
      }
    }
    this.accounts = [];
    this.signer = null;
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  _emit(event, data) {
    const listeners = this._listeners[event] || [];
    for (const cb of listeners) {
      try {
        cb(data);
      } catch (e) {
        console.error('Wallet event listener error:', e);
      }
    }
  }
}

class QuaiSigner {
  constructor(provider, address) {
    this.provider = provider;
    this.address = address;
  }

  getAddress() {
    return Promise.resolve(this.address);
  }

  async signTransaction(tx) {
    const signedTx = await this.provider.request({
      method: 'quai_signTransaction',
      params: [tx, this.address],
    });

    if (!signedTx) {
      try {
        return await this.provider.request({
          method: 'eth_signTransaction',
          params: [tx, this.address],
        });
      } catch {
        throw new Error('Transaction signing failed');
      }
    }

    return signedTx;
  }

  async sendTransaction(tx) {
    try {
      return await this.provider.request({
        method: 'quai_sendTransaction',
        params: [tx, this.address],
      });
    } catch (e) {
      return await this.provider.request({
        method: 'eth_sendTransaction',
        params: [tx],
      });
    }
  }

  async signMessage(message) {
    return this.provider.request({
      method: 'personal_sign',
      params: [message, this.address],
    });
  }
}

// Export for use in browser
window.QuaiWallet = QuaiWallet;
window.QuaiSigner = QuaiSigner;
window.isQuaiChainId = isQuaiChainId;
