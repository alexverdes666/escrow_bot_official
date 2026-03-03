import { ethers, HDNodeWallet } from 'ethers';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const DERIVATION_BASE = "m/44'/60'/0'/0/";

function getProvider(): ethers.JsonRpcProvider {
  const defaultUrl = env.CRYPTO_NETWORK === 'mainnet'
    ? 'https://eth-mainnet.g.alchemy.com/v2/demo'
    : 'https://rpc.sepolia.org';
  return new ethers.JsonRpcProvider(env.ETH_RPC_URL || defaultUrl);
}

export function deriveAddress(mnemonic: string, index: number): { address: string; privateKey: string } {
  const wallet = HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(mnemonic),
    DERIVATION_BASE + index
  );
  return { address: wallet.address, privateKey: wallet.privateKey };
}

export async function getBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return balance.toString();
}

export async function sendTransaction(privateKey: string, to: string, amountWei: string): Promise<string> {
  const provider = getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction({
    to,
    value: BigInt(amountWei),
  });

  logger.info(`ETH tx sent: ${tx.hash}`);
  await tx.wait(1);
  return tx.hash;
}

export async function getConfirmations(txHash: string): Promise<number> {
  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return 0;
  const currentBlock = await provider.getBlockNumber();
  return currentBlock - receipt.blockNumber + 1;
}

export function validateAddress(address: string): boolean {
  return ethers.isAddress(address);
}

export function formatAmount(wei: string): string {
  return ethers.formatEther(wei);
}

export function parseAmount(ether: string): string {
  return ethers.parseEther(ether).toString();
}
