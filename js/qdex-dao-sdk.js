/**
 * QDEX DAO SDK — quais SDK ONLY (NO ethers.js)
 * 
 * Integrates DAO Ships governance with QDEX frontend.
 * Uses quais SDK for all blockchain interaction.
 * 
 * Required: qiWallet instance synced to Zone.Cyprus1
 * 
 * Usage:
 *   import { QDexDaoClient } from './js/qdex-dao-sdk.js';
 *   const dao = new QDexDaoClient({ wallet });
 *   const proposals = await dao.proposals.list();
 */

// ── Protocol Addresses (Quais Cyprus-1) ─────────
const PROTOCOL = {
  Poster: '0x0028DCeb1CAfb4d6B2B5f69313329Aeb0E66cf34',
  DAOShipSingleton: '0x004c1BCDf5Bf30c0cd8Aa1d9A5c4c49FF3368dd9',
  SharesERC20Singleton: '0x003b6C160596e5Ac87044bAAe05750e6A9862FdD',
  LootERC20Singleton: '0x00085a2D9b407671270362087AC0fe5E272D0582',
  DAOShipLauncher: '0x003BD5aC6f75cFA8E1949Eb9A5EB967966c1b455',
  DAOShipAndVaultLauncher: '0x0030d87f987F24603108bEe81cE212a007Bfb6dD',
  QuaiVaultFactory: '0x002d1305D597c157bB975967FA2e5337674b0E5F',
  VaultSingleton: '0x004E539Cf477A5Cb456A56023f083cD91Bc4934e',
  MultiSendCallOnly: '0x002ae8A47C2da497fe569AfCF0486410aA1093E0',
};

// ── QDEX DAO Addresses (set after deployment) ───
const QDEX_DAO = {
  daoShip: '0x0000000000000000000000000000000000000000',
  shares: '0x0000000000000000000000000000000000000000',
  loot: '0x0000000000000000000000000000000000000000',
  vault: '0x0000000000000000000000000000000000000000',
};

// ── ABIs ────────────────────────────────────────
const DAOShipABI = {
  submitProposal: {
    type: 'function',
    name: 'submitProposal',
    inputs: [
      { type: 'address[]', name: 'tos' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'datas' },
      { type: 'string', name: 'details' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  vote: {
    type: 'function',
    name: 'vote',
    inputs: [
      { type: 'uint256', name: 'proposalId' },
      { type: 'bool', name: 'approved' },
    ],
  },
  processProposal: {
    type: 'function',
    name: 'processProposal',
    inputs: [{ type: 'uint256', name: 'proposalId' }],
  },
  cancelProposal: {
    type: 'function',
    name: 'cancelProposal',
    inputs: [{ type: 'uint256', name: 'proposalId' }],
  },
  delegate: {
    type: 'function',
    name: 'delegate',
    inputs: [{ type: 'address', name: 'delegatee' }],
  },
  delegation: {
    type: 'function',
    name: 'delegation',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  votingPower: {
    type: 'function',
    name: 'votingPower',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  proposalCount: {
    type: 'function',
    name: 'proposalCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  ragequit: {
    type: 'function',
    name: 'ragequit',
    inputs: [],
  },
  shares: {
    type: 'function',
    name: 'shares',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  loot: {
    type: 'function',
    name: 'loot',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  avatar: {
    type: 'function',
    name: 'avatar',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
};

const ERC20ABI = {
  balanceOf: {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  transfer: {
    type: 'function',
    name: 'transfer',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool' }],
  },
};

const VaultABI = {
  balance: {
    type: 'function',
    name: 'balance',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  getOwners: {
    type: 'function',
    name: 'getOwners',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  requiredSignatures: {
    type: 'function',
    name: 'requiredSignatures',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
};

const WQUAIABI = {
  deposit: {
    type: 'function',
    name: 'deposit',
    inputs: [],
    stateMutability: 'payable',
  },
  withdraw: {
    type: 'function',
    name: 'withdraw',
    inputs: [{ type: 'uint256', name: 'amount' }],
  },
};

// ── ABI Encoding Helpers ────────────────────────
function encodeFunctionCall(func, params) {
  // Use quais SDK built-in ABI encoder
  // Falls back to ethers-like encoding if needed
  if (typeof window !== 'undefined' && window.quais) {
    return window.quais.utils.abiEncode(
      func.inputs.map(i => i.type),
      params
    );
  }
  // Fallback: simple hex encoding
  return '0x' + params.map(p => p.toString(16).padStart(64, '0')).join('');
}

function getSelector(func) {
  const signature = `${func.name}(${func.inputs.map(i => i.type).join(',')})`;
  // keccak256 hash first 4 bytes
  return window.quais?.utils?.keccak256(signature)?.slice(0, 10) || '0x00000000';
}

// ── QDexDaoClient ───────────────────────────────
export class QDexDaoClient {
  /**
   * @param {Object} opts
   * @param {Object} opts.wallet - quais qiWallet instance (synced to Zone.Cyprus1)
   * @param {Object} [opts.addresses] - Override default addresses
   */
  constructor({ wallet, addresses = {} } = {}) {
    if (!wallet) {
      throw new Error('QDexDaoClient requires a quais qiWallet instance');
    }
    
    this.wallet = wallet;
    this.addresses = { ...QDEX_DAO, ...addresses };
    this.zone = window.quais?.Zone?.Cyprus1 ?? 1;
    
    this._cache = {};
  }
  
  /**
   * Encode a contract call using quais SDK
   */
  async _encodeCall(contractAddress, funcName, params = []) {
    const signer = await this.wallet.getSigner();
    const contract = new window.quais.Contract(
      contractAddress,
      this._getABI(funcName),
      signer
    );
    
    return contract[funcName](...params);
  }
  
  /**
   * Execute a transaction via quais wallet
   */
  async _execute(to, data, value = 0n) {
    const tx = {
      to: window.quais.utils.formatMixedCaseChecksumAddress(to),
      data,
      value,
    };
    
    const signer = await this.wallet.getSigner();
    const receipt = await signer.sendTransaction(tx);
    
    return await receipt.wait();
  }
  
  /**
   * Get a readable transaction
   */
  async _read(contractAddress, funcName, params = []) {
    const contract = new window.quais.Contract(
      contractAddress,
      this._getABI(funcName),
      this.wallet.provider
    );
    
    return await contract[funcName](...params);
  }
  
  /**
   * Get ABI fragment for a function
   */
  _getABI(funcName) {
    const allABIs = { ...DAOShipABI, ...ERC20ABI, ...VaultABI, ...WQUAIABI };
    const func = allABIs[funcName];
    return func ? [func] : [];
  }
  
  /**
   * ── Proposals API ─────────────────────────────
   */
  get proposals() {
    const self = this;
    
    return {
      /**
       * List proposals
       */
      list: async (limit = 20) => {
        const count = await self._read(
          self.addresses.daoShip,
          'proposalCount'
        );
        
        const proposals = [];
        const start = Number(count) - limit;
        
        for (let i = Math.max(0, start); i < Number(count); i++) {
          proposals.push({ id: i });
        }
        
        return proposals;
      },
      
      /**
       * Submit proposal
       */
      submit: async ({ tos, values, datas, details }) => {
        const call = await self._encodeCall(
          self.addresses.daoShip,
          'submitProposal',
          [tos, values, datas, details]
        );
        
        return self._execute(self.addresses.daoShip, call.data);
      },
      
      /**
       * Vote on proposal
       */
      vote: async (proposalId, approved) => {
        const call = await self._encodeCall(
          self.addresses.daoShip,
          'vote',
          [BigInt(proposalId), approved]
        );
        
        return self._execute(self.addresses.daoShip, call.data);
      },
      
      /**
       * Process ready proposal
       */
      process: async (proposalId) => {
        const call = await self._encodeCall(
          self.addresses.daoShip,
          'processProposal',
          [BigInt(proposalId)]
        );
        
        return self._execute(self.addresses.daoShip, call.data);
      },
    };
  }
  
  /**
   * ── Voting API ────────────────────────────────
   */
  get voting() {
    const self = this;
    
    return {
      /**
       * Get voting power for address
       */
      getPower: async (address) => {
        const power = await self._read(
          self.addresses.daoShip,
          'votingPower',
          [address]
        );
        
        const shares = await self._read(
          self.addresses.shares,
          'balanceOf',
          [address]
        );
        
        return {
          shares: Number(shares),
          power: Number(power),
        };
      },
      
      /**
       * Delegate voting power
       */
      delegate: async (delegatee) => {
        const call = await self._encodeCall(
          self.addresses.daoShip,
          'delegate',
          [delegatee]
        );
        
        return self._execute(self.addresses.daoShip, call.data);
      },
      
      /**
       * Get current delegate
       */
      getDelegate: async (address) => {
        return self._read(
          self.addresses.daoShip,
          'delegation',
          [address]
        );
      },
    };
  }
  
  /**
   * ── Treasury API ──────────────────────────────
   */
  get treasury() {
    const self = this;
    
    return {
      /**
       * Get vault QUAI balance
       */
      getBalance: async () => {
        const balance = await self._read(
          self.addresses.vault,
          'balance'
        );
        
        return {
          quai: Number(balance) / 1e18,
          raw: balance.toString(),
          address: self.addresses.vault,
        };
      },
      
      /**
       * Get token balances in vault
       */
      getTokenBalances: async (tokens) => {
        const balances = [];
        
        for (const token of tokens) {
          const balance = await self._read(
            token.address,
            'balanceOf',
            [self.addresses.vault]
          );
          
          balances.push({
            symbol: token.symbol,
            address: token.address,
            balance: Number(balance) / (10 ** token.decimals),
          });
        }
        
        return balances;
      },
      
      /**
       * Get vault owners
       */
      getOwners: async () => {
        const [owners, required] = await Promise.all([
          self._read(self.addresses.vault, 'getOwners'),
          self._read(self.addresses.vault, 'requiredSignatures'),
        ]);
        
        return {
          owners,
          requiredConfirmations: Number(required),
        };
      },
    };
  }
  
  /**
   * ── Shares API (WQUAI-backed) ─────────────────
   */
  get shares() {
    const self = this;
    
    return {
      /**
       * Get shares balance
       */
      balance: async (address) => {
        const balance = await self._read(
          self.addresses.shares,
          'balanceOf',
          [address]
        );
        
        return Number(balance);
      },
      
      /**
       * Deposit WQUAI → mint Shares (1:1)
       */
      deposit: async (amount) => {
        const call = await self._encodeCall(
          PROTOCOL.WQUAI,
          'deposit',
          []
        );
        
        return self._execute(PROTOCOL.WQUAI, call.data, amount);
      },
      
      /**
       * Burn Shares → withdraw WQUAI (1:1)
       */
      withdraw: async (amount) => {
        const call = await self._encodeCall(
          PROTOCOL.WQUAI,
          'withdraw',
          [BigInt(amount)]
        );
        
        return self._execute(PROTOCOL.WQUAI, call.data);
      },
    };
  }
  
  /**
   * ── Loot API ──────────────────────────────────
   */
  get loot() {
    const self = this;
    
    return {
      /**
       * Get loot balance
       */
      balance: async (address) => {
        const balance = await self._read(
          self.addresses.loot,
          'balanceOf',
          [address]
        );
        
        return Number(balance);
      },
    };
  }
  
  /**
   * ── Ragequit API ──────────────────────────────
   */
  get ragequit() {
    const self = this;
    
    return {
      /**
       * Execute ragequit
       */
      execute: async () => {
        const call = await self._encodeCall(
          self.addresses.daoShip,
          'ragequit',
          []
        );
        
        return self._execute(self.addresses.daoShip, call.data);
      },
    };
  }
}
