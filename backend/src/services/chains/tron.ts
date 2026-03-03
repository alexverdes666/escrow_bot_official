import { TronWeb } from 'tronweb';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const bip32 = BIP32Factory(ecc);
const DERIVATION_BASE = "m/44'/195'/0'/0/";

const USDT_CONTRACTS: Record<string, string> = {
  mainnet: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  testnet: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', // Nile testnet USDT
};

function getTronWeb(privateKey?: string): TronWeb {
  const fullHost = env.TRON_API_URL || (
    env.CRYPTO_NETWORK === 'mainnet'
      ? 'https://api.trongrid.io'
      : 'https://nile.trongrid.io'
  );

  const headers: Record<string, string> = {};
  if (env.TRON_API_KEY) {
    headers['TRON-PRO-API-KEY'] = env.TRON_API_KEY;
  }

  return new TronWeb({
    fullHost,
    headers,
    privateKey: privateKey || undefined,
  });
}

function getUsdtContract(): string {
  return env.USDT_TRC20_CONTRACT || USDT_CONTRACTS[env.CRYPTO_NETWORK] || USDT_CONTRACTS.testnet;
}

export function deriveAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const child = root.derivePath(DERIVATION_BASE + index);

  if (!child.privateKey) throw new Error('Failed to derive TRON private key');

  const privateKeyHex = Buffer.from(child.privateKey).toString('hex');
  const tronWeb = getTronWeb();
  const address = tronWeb.address.fromPrivateKey(privateKeyHex);

  if (!address) throw new Error('Failed to derive TRON address');

  return { address, privateKey: privateKeyHex };
}

export async function getTrxBalance(address: string): Promise<string> {
  const tronWeb = getTronWeb();
  const balance = await tronWeb.trx.getBalance(address);
  return balance.toString();
}

export async function getUsdtBalance(address: string): Promise<string> {
  const tronWeb = getTronWeb();
  const contract = await tronWeb.contract().at(getUsdtContract());
  const balance = await contract.methods.balanceOf(address).call();
  return balance.toString();
}

export async function getBalance(address: string, token?: string): Promise<string> {
  if (token === 'USDT') {
    return getUsdtBalance(address);
  }
  return getTrxBalance(address);
}

export async function sendTrx(privateKey: string, to: string, amountSun: string): Promise<string> {
  const tronWeb = getTronWeb(privateKey);
  const tx = await tronWeb.trx.sendTransaction(to, parseInt(amountSun, 10));

  if (!tx.result) {
    throw new Error('TRX send failed: ' + JSON.stringify(tx));
  }

  logger.info(`TRX tx sent: ${tx.txid}`);
  return tx.txid;
}

export async function sendUsdt(privateKey: string, to: string, amount: string): Promise<string> {
  const tronWeb = getTronWeb(privateKey);
  const contract = await tronWeb.contract().at(getUsdtContract());

  const tx = await contract.methods.transfer(to, amount).send({
    feeLimit: 100_000_000, // 100 TRX fee limit
  });

  logger.info(`USDT-TRC20 tx sent: ${tx}`);
  return tx;
}

export async function sendTransaction(privateKey: string, to: string, amount: string, token?: string): Promise<string> {
  if (token === 'USDT') {
    return sendUsdt(privateKey, to, amount);
  }
  return sendTrx(privateKey, to, amount);
}

export function validateAddress(address: string): boolean {
  return TronWeb.isAddress(address);
}

export function formatAmount(sun: string, token?: string): string {
  if (token === 'USDT') {
    // USDT has 6 decimals
    return (parseInt(sun, 10) / 1e6).toFixed(6);
  }
  // TRX has 6 decimals (sun)
  return (parseInt(sun, 10) / 1e6).toFixed(6);
}

export function parseAmount(human: string, token?: string): string {
  if (token === 'USDT') {
    return Math.round(parseFloat(human) * 1e6).toString();
  }
  return Math.round(parseFloat(human) * 1e6).toString();
}
