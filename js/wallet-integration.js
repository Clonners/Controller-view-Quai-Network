/**
 * QDEX Wallet Integration
 * 
 * Bridges wallet-pill.js QuaiWallet with QDEX trading operations.
 * - Fetches real vault balances via backend API
 * - Signs orders using wallet signer
 * - Executes vault approve/deposit/withdraw on-chain
 * - Any Quai wallet (Pelagus, MetaMask with Quai network) works
 */

class QDexWalletIntegration {
  constructor(qdexClient, options = {}) {
    this.client = qdexClient;
    this.wallet = null;
    this.signer = null;
    this.address = null;
    this.chainId = 0x3A98; // Orchard Cyprus-1
    this.tokens = options.tokens || {
      WQUAI: '0x005c46f661baef20671943f2b4c087df3e7ceb13',
      WQI: '0x002b2596ecf05c93a31ff916e8b456df6c77c750',
    };
    this.vaultAddress = options.vaultAddress || null;
    this._onBalanceUpdate = options.onBalanceUpdate || (() => {});
  }

  /**
   * Initialize from wallet-pill.js global
   * Returns true if wallet is connected
   */
  async init() {
    if (window.quaiWalletInstance) {
      this.wallet = window.quaiWalletInstance;
      this.signer = window.quaiWalletInstance.getSigner();
      if (this.signer) {
        this.address = this.signer.address;
        return true;
      }
    }

    if (window.getWalletSigner) {
      const signer = await window.getWalletSigner();
      if (signer) {
        this.signer = signer;
        this.address = signer.address;
        this.wallet = window.quaiWalletInstance || window.getQuaiWallet();
        return true;
      }
    }

    return false;
  }

  /**
   * Connect wallet using QuaiWallet
   */
  async connect() {
    if (!window.QuaiWallet) {
      throw new Error('QuaiWallet SDK not loaded. Reload the page.');
    }

    this.wallet = new QuaiWallet({
      chainId: this.chainId,
      networkName: 'Quai Orchard Cyprus-1',
    });

    const result = await this.wallet.connect();
    this.signer = this.wallet.getSigner();
    this.address = result.address;

    try {
      localStorage.setItem('bitquai_wallet', JSON.stringify({
        address: this.address,
        provider: 'quai',
        chainId: this.chainId,
        networkName: result.networkName,
      }));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('bitquai:wallet-connect', {
      detail: { address: this.address, provider: 'quai', chainId: this.chainId }
    }));

    return result;
  }

  /**
   * Disconnect wallet
   */
  disconnect() {
    if (this.wallet) {
      this.wallet.disconnect();
    }
    this.wallet = null;
    this.signer = null;
    this.address = null;

    try {
      localStorage.removeItem('bitquai_wallet');
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('bitquai:wallet-disconnect'));
  }

  /**
   * Make authenticated request to backend
   */
  async _request(path, options = {}) {
    const baseUrl = this.client.baseUrl || 'https://api.bitquai.live:433';
    const headers = {};
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const body = text.length > 0 ? JSON.parse(text) : null;

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${body?.error || body?.message || 'Request failed'}`);
    }

    return body;
  }

  /**
   * Get vault balance for connected wallet (real on-chain)
   */
  async getVaultBalance(tokenSymbol) {
    const tokenAddress = this.tokens[tokenSymbol];
    if (!this.address || !tokenAddress) {
      return { available: '0', locked: '0', total: '0' };
    }

    try {
      const balanceData = await this._request(
        `/v1/vault/balances/real?owner=${encodeURIComponent(this.address)}&token=${encodeURIComponent(tokenAddress)}`
      );

      return {
        available: balanceData.available || '0',
        locked: balanceData.locked || '0',
        total: balanceData.balance || '0',
        source: balanceData.source || 'real-vault-adapter',
      };
    } catch {
      try {
        const mockData = await this.client.account.balances();
        const token = mockData.balances?.find(b => b.token === tokenSymbol);
        return {
          available: token?.available || '0',
          locked: token?.locked || '0',
          total: token?.total || '0',
          source: 'mock-indexer',
        };
      } catch {
        return { available: '0', locked: '0', total: '0', source: 'error' };
      }
    }
  }

  /**
   * Get all vault balances for connected wallet
   */
  async getAllVaultBalances() {
    const result = [];

    for (const [symbol, address] of Object.entries(this.tokens)) {
      try {
        const balanceData = await this._request(
          `/v1/vault/balances/real?owner=${encodeURIComponent(this.address)}&token=${encodeURIComponent(address)}`
        );
        result.push({
          token: symbol,
          tokenAddress: address,
          available: balanceData.available || '0',
          locked: balanceData.locked || '0',
          total: balanceData.balance || '0',
          source: balanceData.source || 'real-vault-adapter',
        });
      } catch {
        result.push({
          token: symbol,
          available: '0',
          locked: '0',
          total: '0',
          source: 'error',
        });
      }
    }

    return result;
  }

  /**
   * Approve token for vault deposit
   */
  async approveToken(tokenSymbol, amount) {
    if (!this.signer) throw new Error('Wallet not connected');
    const tokenAddress = this.tokens[tokenSymbol];
    if (!tokenAddress) throw new Error(`Unknown token: ${tokenSymbol}`);

    const result = await this._request('/v1/vault/approve', {
      method: 'POST',
      body: { token: tokenAddress, amount: this._toWei(amount) },
    });

    window.dispatchEvent(new CustomEvent('qdex:vault-approved', {
      detail: { token: tokenSymbol, amount, txHash: result.txHash },
    }));

    return result;
  }

  /**
   * Deposit tokens to vault
   */
  async depositToVault(tokenSymbol, amount) {
    if (!this.signer) throw new Error('Wallet not connected');
    const tokenAddress = this.tokens[tokenSymbol];
    if (!tokenAddress) throw new Error(`Unknown token: ${tokenSymbol}`);

    const result = await this._request('/v1/vault/deposits/prepare', {
      method: 'POST',
      body: {
        owner: this.address,
        token: tokenAddress,
        amount: this._toWei(amount),
      },
    });

    window.dispatchEvent(new CustomEvent('qdex:vault-deposited', {
      detail: { token: tokenSymbol, amount, txHash: result.txHash },
    }));

    return result;
  }

  /**
   * Withdraw tokens from vault
   */
  async withdrawFromVault(tokenSymbol, amount) {
    if (!this.signer) throw new Error('Wallet not connected');
    const tokenAddress = this.tokens[tokenSymbol];
    if (!tokenAddress) throw new Error(`Unknown token: ${tokenSymbol}`);

    const result = await this._request('/v1/vault/withdrawals/prepare', {
      method: 'POST',
      body: {
        owner: this.address,
        token: tokenAddress,
        amount: this._toWei(amount),
      },
    });

    window.dispatchEvent(new CustomEvent('qdex:vault-withdrawn', {
      detail: { token: tokenSymbol, amount, txHash: result.txHash },
    }));

    return result;
  }

  /**
   * Sign order for submission
   */
  async signOrder(order) {
    if (!this.signer) throw new Error('Wallet not connected');

    const orderHash = JSON.stringify({
      marketId: order.marketId,
      side: order.side,
      type: order.type,
      amount: order.amount,
      price: order.price,
      owner: this.address,
      nonce: order.nonce,
      expiresAt: order.expiresAt,
      chainId: order.chainId,
      settlementContract: order.settlementContract,
    });

    const signature = await this.signer.signMessage(orderHash);

    return {
      ...order,
      owner: this.address,
      signature: {
        scheme: 'wallet',
        signer: this.address,
        value: signature,
        signedAt: Math.floor(Date.now() / 1000),
      },
    };
  }

  /**
   * Submit signed order to QDEX
   */
  async submitOrder(order) {
    const signedOrder = await this.signOrder(order);
    return this.client.orders.submitSignedOrder(signedOrder);
  }

  /**
   * Convert human-readable amount to wei (18 decimals)
   */
  _toWei(amount) {
    if (typeof Decimal !== 'undefined') {
      return new Decimal(amount).mul(new Decimal(10).pow(18)).toString();
    }
    return (BigInt(Math.floor(amount)) * BigInt('1000000000000000000')).toString();
  }

  /**
   * Format wei to human-readable
   */
  _fromWei(wei) {
    if (!wei || wei === '0') return '0';
    if (typeof Decimal !== 'undefined') {
      return new Decimal(wei).div(new Decimal(10).pow(18)).toNumber().toString();
    }
    return (BigInt(wei) / BigInt('1000000000000000000')).toString();
  }
}

window.QDexWalletIntegration = QDexWalletIntegration;
