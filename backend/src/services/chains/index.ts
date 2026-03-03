import * as ethereum from './ethereum';
import * as bitcoinChain from './bitcoin';
import * as tron from './tron';
import { CryptoChain, CryptoToken } from '../../models/Deal';

export interface ChainService {
  deriveAddress(mnemonic: string, index: number): { address: string; privateKey: string };
  getBalance(address: string, token?: string): Promise<string>;
  sendTransaction(privateKey: string, to: string, amount: string, extra?: string): Promise<string>;
  validateAddress(address: string): boolean;
  formatAmount(raw: string, token?: string): string;
  parseAmount(human: string, token?: string): string;
  getConfirmations?(txHash: string): Promise<number>;
}

export function getChainService(chain: CryptoChain): ChainService {
  switch (chain) {
    case 'ETH':
      return {
        deriveAddress: ethereum.deriveAddress,
        getBalance: ethereum.getBalance,
        sendTransaction: ethereum.sendTransaction,
        validateAddress: ethereum.validateAddress,
        formatAmount: ethereum.formatAmount,
        parseAmount: ethereum.parseAmount,
        getConfirmations: ethereum.getConfirmations,
      };
    case 'BTC':
      return {
        deriveAddress: (mnemonic, index) => {
          const result = bitcoinChain.deriveAddress(mnemonic, index);
          return { address: result.address, privateKey: result.privateKey };
        },
        getBalance: bitcoinChain.getBalance,
        sendTransaction: (privateKey, to, amount, fromAddress) => {
          if (!fromAddress) throw new Error('BTC sendTransaction requires fromAddress as 4th arg');
          return bitcoinChain.sendTransaction(privateKey, to, parseInt(amount, 10), fromAddress);
        },
        validateAddress: bitcoinChain.validateAddress,
        formatAmount: bitcoinChain.formatAmount,
        parseAmount: bitcoinChain.parseAmount,
        getConfirmations: bitcoinChain.getConfirmations,
      };
    case 'TRON':
      return {
        deriveAddress: tron.deriveAddress,
        getBalance: tron.getBalance,
        sendTransaction: (privateKey, to, amount, token) => {
          return tron.sendTransaction(privateKey, to, amount, token);
        },
        validateAddress: tron.validateAddress,
        formatAmount: tron.formatAmount,
        parseAmount: tron.parseAmount,
      };
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

export function getChainLabel(chain: CryptoChain, token?: CryptoToken): string {
  if (chain === 'TRON' && token === 'USDT') return 'USDT (TRC-20)';
  if (chain === 'TRON') return 'TRX';
  return chain;
}

export function getConfirmationThreshold(chain: CryptoChain): number {
  switch (chain) {
    case 'ETH': return 3;
    case 'BTC': return 1;
    case 'TRON': return 19;
    default: return 3;
  }
}
