/**
 * QDEX Wallet Integration
 * 
 * Bridges wallet-pill.js QuaiWallet with QDEX trading operations.
 * - Fetches real vault balances via backend API
 * - Signs orders using wallet signer
 * - Executes vault approve/deposit/withdraw ON-CHAIN (client-side)
 * - ONLY works with Quai Network wallets
 * - Rejects non-Quai EVM networks to prevent fund loss
 */

const QUAI_CHAIN_IDS = new Set([15000, 15001, 15002, 100, 101, 102]);

// Solidity keccak256 function selectors
const VAULT_SELECTORS = {
  deposit:   '0xd0e30db0', // deposit(address,uint256)
  withdraw:  '0x2e1a7d4d', // withdraw(address,uint256)
};

const ERC20_SELECTORS = {
  approve:   '0x095ea7b3', // approve(address,uint256)
  allowance: '0xdd62ed3e', // allowance(address,address)
  balanceOf: '0x70a08231', // balanceOf(address)
};

// Zero address for padding
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

function padAddress(addr) {
  return '0x' + addr.toLowerCase().slice(2).padStart(64, '0');
}

function padUint256(value) {
  return '0x' + BigInt(value).toString(16).padStart(64, '0');
}

class QDexWalletIntegration {
  constructor(qdexClient, options = {}) {
    this.client = qdexClient;
    this.wallet = null;
    this.signer = null;
    this.address = null;
    this.chainId = 0x3A98; // Orchard Cyprus-1
    this.vaultConfig = null;
    this._onBalanceUpdate = options.onBalanceUpdate || (() => {});
  }

  /**
   * Validate wallet is on Quai Network before any operation
   */
  async #assertQuaiNetwork() {
    if (!this.wallet) {
      throw new Error('Wallet not connected. Please connect your Quai wallet.');
    }

    const chainId = await this.wallet.provider.request({ method: 'eth_chainId' });
    const num = parseInt(chainId, 16);

    if (!QUAI_CHAIN_IDS.has(num)) {
      throw new Error(
        `NOT ON QUAI NETWORK! Your wallet is on chain ${num}. ` +
        `Only Quai Network is supported. Please switch to Quai Orchard Cyprus-1 (15000) or Mainnet.`
      );
    }

    return num;
  }

  /**
   * Load vault config from backend (ABI + addresses)
   */
  async loadVaultConfig() {
    if (this.vaultConfig) return this.vaultConfig;
    
    const baseUrl = this.client?.baseUrl || 'https://api.bitquai.live';
    try {
      const res = await fetch(`${baseUrl}/v1/vault/config`);
      this.vaultConfig = await res.json();
    } catch {
      // Fallback defaults
      this.vaultConfig = {
        vault: { address: '0x002325d071d57bafd3169f270a71b67a05360abf' },
        tokens: {
          WQUAI: { address: '0x005c46f661baef20671943f2b4c087df3e7ceb13', decimals: 18 },
          WQI:   { address: '0x002b2596ecf05c93a31ff916e8b456df6c77c750', decimals: 18 },
        },
      };
    }
    return this.vaultConfig;
  }

  /**
   * Initialize from wallet-pill.js global
   */
  async init() {
    await this.loadVaultConfig();
    
    if (window.quaiWalletInstance) {
      this.wallet = window.quaiWalletInstance;
      this.signer = window.quaiWalletInstance.getSigner();
      if (this.signer) {
        this.address = this.signer.address;
        await this.#assertQuaiNetwork();
        return true;
      }
    }

    if (window.getWalletSigner) {
      const signer = await window.getWalletSigner();
      if (signer) {
        this.signer = signer;
        this.address = signer.address;
        this.wallet = window.quaiWalletInstance || window.getQuaiWallet();
        if (this.wallet) {
          await this.#assertQuaiNetwork();
        }
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
      rpcUrl: 'https://orchard.rpc.quai.network/cyprus1',
    });

    const result = await this.wallet.connect();
    this.signer = this.wallet.getSigner();
    this.address = result.address;

    // Persist
    try {
      localStorage.setItem('bitquai_wallet', JSON.stringify({
        address: this.address,
        provider: 'quai',
        chainId: result.chainId,
        networkName: result.networkName,
      }));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('bitquai:wallet-connect', {
      detail: { address: this.address, provider: 'quai', chainId: result.chainId }
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
   * Send transaction via user wallet (client-side signing)
   * This is the core method — all vault operations go through here
   */
  async sendVaultTx(to, data, value = '0x0') {
    await this.#assertQuaiNetwork();

    const tx = {
      from: this.address,
      to,
      data,
      value,
    };

    // Try quai_sendTransaction first (Quai native)
    try {
      const txHash = await this.wallet.provider.request({
        method: 'quai_sendTransaction',
        params: [tx],
      });
      return { txHash };
    } catch (e) {
      // Fallback to eth_sendTransaction
      const txHash = await this.wallet.provider.request({
        method: 'eth_sendTransaction',
        params: [tx],
      });
      return { txHash };
    }
  }

  /**
   * Read balance from chain directly (no backend needed)
   */
  async readChainBalance(contract, selector, params = []) {
    const encodedParams = params.map(p => {
      if (typeof p === 'string' && p.startsWith('0x')) return p;
      return padAddress(String(p));
    });

    const data = selector + encodedParams.join('');

    try {
      const result = await this.wallet.provider.request({
        method: 'quai_call',
        params: [{ to: contract, data }, 'latest'],
      });

      return result ? '0x' + result.slice(-64) : '0x0';
    } catch {
      try {
        const result = await this.wallet.provider.request({
          method: 'eth_call',
          params: [{ to: contract, data }, 'latest'],
        });
        return result ? '0x' + result.slice(-64) : '0x0';
      } catch {
        return '0x0';
      }
    }
  }

  /**
   * Get vault balance for connected wallet (real on-chain read)
   */
  async getVaultBalance(tokenSymbol) {
    const config = await this.loadVaultConfig();
    const tokenInfo = config.tokens?.[tokenSymbol];
    if (!this.address || !tokenInfo) {
      return { available: '0', locked: '0', total: '0' };
    }

    const vaultAddr = config.vault.address;
    const ownerPadded = padAddress(this.address);
    const tokenPadded = padAddress(tokenInfo.address);

    // Read total balance from vault
    const totalHex = await this.readChainBalance(
      vaultAddr, '0xfe599c03', // balanceOf(address,address)
      [ownerPadded, tokenPadded]
    );
    const total = BigInt(totalHex).toString();

    // Read available balance
    const availableHex = await this.readChainBalance(
      vaultAddr, '0xb1201747', // availableBalanceOf(address,address)
      [ownerPadded, tokenPadded]
    );
    const available = BigInt(availableHex).toString();

    // Read locked balance
    const lockedHex = await this.readChainBalance(
      vaultAddr, '0xfd721d78', // lockedBalanceOf(address,address)
      [ownerPadded, tokenPadded]
    );
    const locked = BigInt(lockedHex).toString();

    return {
      available,
      locked,
      total,
      source: 'on-chain-read',
    };
  }

  /**
   * Get all vault balances for connected wallet
   */
  async getAllVaultBalances() {
    const config = await this.loadVaultConfig();
    const result = [];

    for (const [symbol] of Object.entries(config.tokens || {})) {
      try {
        const balance = await this.getVaultBalance(symbol);
        result.push({
          token: symbol,
          tokenAddress: config.tokens[symbol].address,
          ...balance,
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
   * Approve token for vault deposit (CLIENT-SIDE — user signs)
   * Sends tx: token.approve(vault, amount)
   */
  async approveToken(tokenSymbol, amount) {
    await this.#assertQuaiNetwork();
    const config = await this.loadVaultConfig();
    const tokenInfo = config.tokens?.[tokenSymbol];
    if (!tokenInfo) throw new Error(`Unknown token: ${tokenSymbol}`);

    const vaultAddr = config.vault.address;
    const weiAmount = this._toWei(amount);

    // Build tx data: approve(address,uint256)
    const data = ERC20_SELECTORS.approve +
      padAddress(vaultAddr) +
      padUint256(weiAmount);

    const result = await this.sendVaultTx(tokenInfo.address, data);

    window.dispatchEvent(new CustomEvent('qdex:vault-approved', {
      detail: { token: tokenSymbol, amount, txHash: result.txHash },
    }));

    return {
      approved: true,
      txHash: result.txHash,
      token: tokenInfo.address,
      amount: weiAmount,
      spender: vaultAddr,
      source: 'client-side-sign',
    };
  }

  /**
   * Deposit tokens to vault (CLIENT-SIDE — user signs)
   * Sends tx: vault.deposit(token, amount)
   */
  async depositToVault(tokenSymbol, amount) {
    await this.#assertQuaiNetwork();
    const config = await this.loadVaultConfig();
    const tokenInfo = config.tokens?.[tokenSymbol];
    if (!tokenInfo) throw new Error(`Unknown token: ${tokenSymbol}`);

    const vaultAddr = config.vault.address;
    const weiAmount = this._toWei(amount);

    // Build tx data: deposit(address,uint256)
    const data = VAULT_SELECTORS.deposit +
      padAddress(tokenInfo.address) +
      padUint256(weiAmount);

    const result = await this.sendVaultTx(vaultAddr, data);

    window.dispatchEvent(new CustomEvent('qdex:vault-deposited', {
      detail: { token: tokenSymbol, amount, txHash: result.txHash },
    }));

    return {
      deposited: true,
      txHash: result.txHash,
      token: tokenInfo.address,
      amount: weiAmount,
      owner: this.address,
      source: 'client-side-sign',
    };
  }

  /**
   * Withdraw tokens from vault (CLIENT-SIDE — user signs)
   * Sends tx: vault.withdraw(token, amount)
   */
  async withdrawFromVault(tokenSymbol, amount) {
    await this.#assertQuaiNetwork();
    const config = await this.loadVaultConfig();
    const tokenInfo = config.tokens?.[tokenSymbol];
    if (!tokenInfo) throw new Error(`Unknown token: ${tokenSymbol}`);

    const vaultAddr = config.vault.address;
    const weiAmount = this._toWei(amount);

    // Build tx data: withdraw(address,uint256)
    const data = VAULT_SELECTORS.withdraw +
      padAddress(tokenInfo.address) +
      padUint256(weiAmount);

    const result = await this.sendVaultTx(vaultAddr, data);

    window.dispatchEvent(new CustomEvent('qdex:vault-withdrawn', {
      detail: { token: tokenSymbol, amount, txHash: result.txHash },
    }));

    return {
      withdrawn: true,
      txHash: result.txHash,
      token: tokenInfo.address,
      amount: weiAmount,
      source: 'client-side-sign',
    };
  }

  /**
   * Check ERC20 allowance
   */
  async checkAllowance(tokenSymbol) {
    const config = await this.loadVaultConfig();
    const tokenInfo = config.tokens?.[tokenSymbol];
    if (!tokenInfo) return '0';

    const vaultAddr = config.vault.address;

    // Read allowance from token contract
    const allowanceHex = await this.readChainBalance(
      tokenInfo.address, ERC20_SELECTORS.allowance,
      [padAddress(this.address), padAddress(vaultAddr)]
    );

    return BigInt(allowanceHex).toString();
  }

  /**
   * Sign order for submission
   */
  async signOrder(order) {
    await this.#assertQuaiNetwork();

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
    // Use BigInt for precision
    const parts = String(amount).split('.');
    const intPart = parts[0] || '0';
    let decPart = (parts[1] || '').padEnd(18, '0').slice(0, 18);
    return (BigInt(intPart) * BigInt('1000000000000000000') + BigInt(decPart)).toString();
  }

  /**
   * Format wei to human-readable
   */
  _fromWei(wei) {
    if (!wei || wei === '0') return '0';
    if (typeof Decimal !== 'undefined') {
      return new Decimal(wei).div(new Decimal(10).pow(18)).toFixed(6);
    }
    const bigint = BigInt(wei);
    const intPart = bigint / BigInt('1000000000000000000');
    const decPart = bigint % BigInt('1000000000000000000');
    const decStr = decPart.toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
    return decStr ? `${intPart}.${decStr}` : `${intPart}`;
  }
}

// Expose globally
window.QDexWalletIntegration = QDexWalletIntegration;
