/**
 * Quai Wallet Connector
 * 
 * Connects to Quai wallets (Pelagus, MetaMask with Quai network)
 * Supports both standard Ethereum RPC methods and Quai-specific ones:
 * - quai_requestAccounts instead of eth_requestAccounts
 * - quai_accounts instead of eth_accounts  
 * - quai_signTransaction, quai_sendTransaction
 * - Shard-aware (Cyprus-1 on Orchard testnet)
 * 
 * Usage:
 *   const wallet = new QuaiWallet();
 *   await wallet.connect();
 *   const signer = await wallet.getSigner();
 *   const tx = await signer.sendTransaction({...});
 */

class QuaiWallet {
  constructor({ chainId, networkName } = {}) {
    this.provider = window.ethereum || window.quai;
    this.chainId = chainId || 0x3A98; // 15000 = Orchard Cyprus-1
    this.networkName = networkName || 'Quai Orchard Cyprus-1';
    this.accounts = [];
    this.signer = null;
    this._listeners = {};
  }

  /**
   * Check if a Quai-compatible wallet is available
   */
  isWalletAvailable() {
    return !!(this.provider && typeof this.provider.request === 'function');
  }

  /**
   * Connect to wallet, requesting accounts
   * Tries Quai-specific method first, falls back to Ethereum standard
   */
  async connect() {
    if (!this.isWalletAvailable()) {
      throw new Error('No Quai wallet detected. Install Pelagus or add Quai network to MetaMask.');
    }

    let accounts;
    try {
      // Try Quai-specific request method first
      accounts = await this.provider.request({
        method: 'quai_requestAccounts',
      });
    } catch (e) {
      // Fall back to standard Ethereum method
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

    this.accounts = accounts;
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

    // Listen for network changes
    this._onChainChanged = (chainId) => {
      this.chainId = parseInt(chainId, 16);
      this._emit('chainChanged', this.chainId);
    };

    this.provider.on('accountsChanged', this._onAccountsChanged);
    this.provider.on('chainChanged', this._onChainChanged);

    return {
      address: this.accounts[0],
      chainId: this.chainId,
      networkName: this.networkName,
    };
  }

  /**
   * Get current accounts without requesting (read-only)
   */
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

  /**
   * Get signer for the connected account
   */
  getSigner() {
    return this.signer;
  }

  /**
   * Sign a message using the wallet
   */
  async signMessage(message, address) {
    return this.provider.request({
      method: 'personal_sign',
      params: [message, address || this.accounts[0]],
    });
  }

  /**
   * Switch to Quai network
   */
  async switchToQuaiNetwork() {
    const quaiChainId = '0x3A98'; // 15000 hex

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
              chainName: 'Quai Orchard Cyprus-1',
              nativeCurrency: { name: 'QI', symbol: 'QI', decimals: 18 },
              rpcUrls: ['https://orchard.rpc.quai.network/cyprus1'],
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

  /**
   * Disconnect and clean up
   */
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

/**
 * QuaiSigner — wraps wallet provider for signing transactions
 */
class QuaiSigner {
  constructor(provider, address) {
    this.provider = provider;
    this.address = address;
  }

  getAddress() {
    return Promise.resolve(this.address);
  }

  /**
   * Sign a transaction
   */
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

  /**
   * Sign and send a transaction
   */
  async sendTransaction(tx) {
    try {
      return await this.provider.request({
        method: 'quai_sendTransaction',
        params: [tx, this.address],
      });
    } catch (e) {
      // Fall back to eth_sendTransaction
      return await this.provider.request({
        method: 'eth_sendTransaction',
        params: [tx],
      });
    }
  }

  /**
   * Sign a message
   */
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
