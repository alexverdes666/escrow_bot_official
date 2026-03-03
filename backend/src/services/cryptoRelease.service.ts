import { IDeal, CryptoChain } from '../models/Deal';
import { env } from '../config/env';
import { getChainService, getChainLabel } from './chains';
import { getPrivateKey, getDepositAddress } from './wallet.service';
import { getNotificationService } from './notification.service';
import { logger } from '../utils/logger';

function getFeeWallet(chain: CryptoChain): string | undefined {
  switch (chain) {
    case 'ETH': return env.CRYPTO_FEE_WALLET_ETH;
    case 'BTC': return env.CRYPTO_FEE_WALLET_BTC;
    case 'TRON': return env.CRYPTO_FEE_WALLET_TRON;
  }
}

function calculateFee(amount: string): { fee: string; payout: string } {
  const total = BigInt(amount);
  const feePercent = env.CRYPTO_FEE_PERCENT;
  const fee = total * BigInt(Math.round(feePercent * 100)) / 10000n;
  const payout = total - fee;
  return { fee: fee.toString(), payout: payout.toString() };
}

export async function releaseFunds(deal: IDeal): Promise<void> {
  const cp = deal.cryptoPayment;
  if (!cp) throw new Error('Deal has no crypto payment');
  if (cp.status !== 'confirmed') throw new Error(`Cannot release: crypto status is ${cp.status}`);

  const chain = cp.chain;
  const service = getChainService(chain);
  const privateKey = getPrivateKey(chain, cp.derivationIndex);
  const fromAddress = getDepositAddress(chain, cp.derivationIndex);

  const { fee, payout } = calculateFee(cp.receivedAmount || cp.expectedAmount);

  // Send payout to seller
  const releaseTxHash = await service.sendTransaction(
    privateKey,
    cp.sellerAddress,
    payout,
    chain === 'BTC' ? fromAddress : cp.token
  );

  cp.releaseTxHash = releaseTxHash;
  cp.platformFeeAmount = fee;

  // Send fee to platform wallet (if configured and fee > 0)
  const feeWallet = getFeeWallet(chain);
  if (feeWallet && BigInt(fee) > 0n) {
    try {
      // Re-derive key (needed after first tx changes nonce/UTXOs)
      const feeTxHash = await service.sendTransaction(
        privateKey,
        feeWallet,
        fee,
        chain === 'BTC' ? fromAddress : cp.token
      );
      cp.platformFeeTxHash = feeTxHash;
    } catch (err) {
      logger.error(`Failed to send platform fee for deal ${deal.dealId}:`, err);
      // Non-critical: payout succeeded, fee can be collected later
    }
  }

  cp.status = 'released';
  cp.releasedAt = new Date();
  await deal.save();

  logger.info(`Funds released for deal ${deal.dealId}: ${payout} to ${cp.sellerAddress}`);

  const ns = getNotificationService();
  if (ns) await ns.notifyFundsReleased(deal);
}

export async function refundFunds(deal: IDeal): Promise<void> {
  const cp = deal.cryptoPayment;
  if (!cp) throw new Error('Deal has no crypto payment');
  if (cp.status !== 'confirmed') throw new Error(`Cannot refund: crypto status is ${cp.status}`);

  const chain = cp.chain;
  const service = getChainService(chain);
  const privateKey = getPrivateKey(chain, cp.derivationIndex);
  const fromAddress = getDepositAddress(chain, cp.derivationIndex);

  const refundAmount = cp.receivedAmount || cp.expectedAmount;

  const refundTxHash = await service.sendTransaction(
    privateKey,
    cp.buyerAddress,
    refundAmount,
    chain === 'BTC' ? fromAddress : cp.token
  );

  cp.refundTxHash = refundTxHash;
  cp.status = 'refunded';
  await deal.save();

  logger.info(`Funds refunded for deal ${deal.dealId}: ${refundAmount} to ${cp.buyerAddress}`);

  const ns = getNotificationService();
  if (ns) await ns.notifyFundsRefunded(deal);
}

export async function splitFunds(
  deal: IDeal,
  buyerPercent: number,
  sellerPercent: number
): Promise<void> {
  const cp = deal.cryptoPayment;
  if (!cp) throw new Error('Deal has no crypto payment');
  if (cp.status !== 'confirmed') throw new Error(`Cannot split: crypto status is ${cp.status}`);

  const chain = cp.chain;
  const service = getChainService(chain);
  const privateKey = getPrivateKey(chain, cp.derivationIndex);
  const fromAddress = getDepositAddress(chain, cp.derivationIndex);

  const total = BigInt(cp.receivedAmount || cp.expectedAmount);
  const { fee } = calculateFee(total.toString());
  const afterFee = total - BigInt(fee);

  const sellerAmount = (afterFee * BigInt(sellerPercent)) / 100n;
  const buyerAmount = afterFee - sellerAmount;

  // Send to seller
  if (sellerAmount > 0n) {
    const sellerTx = await service.sendTransaction(
      privateKey,
      cp.sellerAddress,
      sellerAmount.toString(),
      chain === 'BTC' ? fromAddress : cp.token
    );
    cp.releaseTxHash = sellerTx;
  }

  // Send to buyer
  if (buyerAmount > 0n) {
    const buyerTx = await service.sendTransaction(
      privateKey,
      cp.buyerAddress,
      buyerAmount.toString(),
      chain === 'BTC' ? fromAddress : cp.token
    );
    cp.refundTxHash = buyerTx;
  }

  // Send fee to platform
  const feeWallet = getFeeWallet(chain);
  if (feeWallet && BigInt(fee) > 0n) {
    try {
      const feeTx = await service.sendTransaction(
        privateKey,
        feeWallet,
        fee,
        chain === 'BTC' ? fromAddress : cp.token
      );
      cp.platformFeeTxHash = feeTx;
      cp.platformFeeAmount = fee;
    } catch (err) {
      logger.error(`Failed to send platform fee for deal ${deal.dealId}:`, err);
    }
  }

  cp.status = 'released';
  cp.releasedAt = new Date();
  await deal.save();

  logger.info(`Funds split for deal ${deal.dealId}: buyer=${buyerPercent}%, seller=${sellerPercent}%`);
}
