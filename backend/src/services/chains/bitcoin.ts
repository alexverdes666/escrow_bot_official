import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const DERIVATION_BASE = "m/84'/1'/0'/0/"; // testnet uses coin type 1
const DERIVATION_BASE_MAINNET = "m/84'/0'/0'/0/";

function getNetwork(): bitcoin.Network {
  return env.CRYPTO_NETWORK === 'mainnet'
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}

function getApiBase(): string {
  return env.CRYPTO_NETWORK === 'mainnet'
    ? 'https://mempool.space/api'
    : 'https://mempool.space/testnet4/api';
}

export function deriveAddress(mnemonic: string, index: number): { address: string; privateKey: string; publicKey: Buffer } {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, getNetwork());
  const basePath = env.CRYPTO_NETWORK === 'mainnet' ? DERIVATION_BASE_MAINNET : DERIVATION_BASE;
  const child = root.derivePath(basePath + index);

  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: getNetwork(),
  });

  if (!address) throw new Error('Failed to derive BTC address');

  return {
    address,
    privateKey: child.toWIF(),
    publicKey: Buffer.from(child.publicKey),
  };
}

interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
}

export async function getBalance(address: string): Promise<string> {
  const utxos = await fetchUtxos(address);
  const total = utxos.reduce((sum, u) => sum + u.value, 0);
  return total.toString();
}

async function fetchUtxos(address: string): Promise<UTXO[]> {
  const res = await fetch(`${getApiBase()}/address/${address}/utxo`);
  if (!res.ok) throw new Error(`mempool.space UTXO fetch failed: ${res.status}`);
  return res.json() as Promise<UTXO[]>;
}

export async function getRecommendedFee(): Promise<number> {
  const res = await fetch(`${getApiBase()}/v1/fees/recommended`);
  if (!res.ok) return 10; // fallback 10 sat/vB
  const data = await res.json() as { halfHourFee: number };
  return data.halfHourFee;
}

export async function sendTransaction(
  wif: string,
  toAddress: string,
  amountSats: number,
  fromAddress: string
): Promise<string> {
  const network = getNetwork();
  const keyPair = ECPair.fromWIF(wif, network);
  const utxos = await fetchUtxos(fromAddress);

  if (utxos.length === 0) throw new Error('No UTXOs available');

  const feeRate = await getRecommendedFee();
  // Estimate tx size: ~110 vBytes for 1-in 2-out p2wpkh
  const estimatedSize = 110 + (utxos.length - 1) * 68;
  const fee = feeRate * estimatedSize;

  const psbt = new bitcoin.Psbt({ network });

  let inputTotal = 0;
  for (const utxo of utxos) {
    // Fetch raw tx for non-witness UTXO (required for some setups)
    const txHexRes = await fetch(`${getApiBase()}/tx/${utxo.txid}/hex`);
    const txHex = await txHexRes.text();

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(keyPair.publicKey),
          network,
        }).output!,
        value: utxo.value,
      },
    });
    inputTotal += utxo.value;
    if (inputTotal >= amountSats + fee) break;
  }

  if (inputTotal < amountSats + fee) {
    throw new Error(`Insufficient BTC balance. Have ${inputTotal} sats, need ${amountSats + fee}`);
  }

  psbt.addOutput({ address: toAddress, value: amountSats });

  const change = inputTotal - amountSats - fee;
  if (change > 546) { // dust threshold
    psbt.addOutput({ address: fromAddress, value: change });
  }

  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();

  const txHex = psbt.extractTransaction().toHex();

  // Broadcast
  const broadcastRes = await fetch(`${getApiBase()}/tx`, {
    method: 'POST',
    body: txHex,
    headers: { 'Content-Type': 'text/plain' },
  });

  if (!broadcastRes.ok) {
    const err = await broadcastRes.text();
    throw new Error(`BTC broadcast failed: ${err}`);
  }

  const txid = await broadcastRes.text();
  logger.info(`BTC tx sent: ${txid}`);
  return txid;
}

export async function getConfirmations(txHash: string): Promise<number> {
  const res = await fetch(`${getApiBase()}/tx/${txHash}`);
  if (!res.ok) return 0;
  const tx = await res.json() as { status: { confirmed: boolean; block_height?: number } };
  if (!tx.status.confirmed || !tx.status.block_height) return 0;

  const tipRes = await fetch(`${getApiBase()}/blocks/tip/height`);
  const tipHeight = parseInt(await tipRes.text(), 10);
  return tipHeight - tx.status.block_height + 1;
}

export function validateAddress(address: string): boolean {
  try {
    bitcoin.address.toOutputScript(address, getNetwork());
    return true;
  } catch {
    return false;
  }
}

export function formatAmount(sats: string): string {
  return (parseInt(sats, 10) / 1e8).toFixed(8);
}

export function parseAmount(btc: string): string {
  return Math.round(parseFloat(btc) * 1e8).toString();
}
