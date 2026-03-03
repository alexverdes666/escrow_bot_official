import { env } from '../config/env';
import { CryptoChain, CryptoToken } from '../models/Deal';
import { getNextDerivationIndex } from '../models/Counter';
import { getChainService } from './chains';

function getMnemonic(): string {
  if (!env.CRYPTO_MNEMONIC) {
    throw new Error('CRYPTO_MNEMONIC is not configured');
  }
  return env.CRYPTO_MNEMONIC;
}

export async function generateDepositAddress(
  chain: CryptoChain,
  _token?: CryptoToken
): Promise<{ address: string; derivationIndex: number }> {
  const index = await getNextDerivationIndex();
  const service = getChainService(chain);
  const { address } = service.deriveAddress(getMnemonic(), index);
  return { address, derivationIndex: index };
}

export function getPrivateKey(chain: CryptoChain, derivationIndex: number): string {
  const service = getChainService(chain);
  const { privateKey } = service.deriveAddress(getMnemonic(), derivationIndex);
  return privateKey;
}

export function getDepositAddress(chain: CryptoChain, derivationIndex: number): string {
  const service = getChainService(chain);
  const { address } = service.deriveAddress(getMnemonic(), derivationIndex);
  return address;
}

export function validateWalletAddress(chain: CryptoChain, address: string): boolean {
  const service = getChainService(chain);
  return service.validateAddress(address);
}
