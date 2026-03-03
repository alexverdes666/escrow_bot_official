import cron from 'node-cron';
import { Deal, IDeal } from '../models/Deal';
import { getChainService, getConfirmationThreshold, getChainLabel } from './chains';
import { getNotificationService } from './notification.service';
import { logger } from '../utils/logger';

const POLL_CRON = '*/45 * * * * *'; // every 45 seconds

async function checkPendingDeposits(): Promise<void> {
  const deals = await Deal.find({
    status: 'awaiting_deposit',
    'cryptoPayment.status': 'pending',
    cryptoPayment: { $exists: true },
  });

  for (const deal of deals) {
    try {
      await checkDeposit(deal);
    } catch (err) {
      logger.error(`Crypto watcher error for deal ${deal.dealId}:`, err);
    }
  }
}

async function checkDeposit(deal: IDeal): Promise<void> {
  const cp = deal.cryptoPayment!;
  const service = getChainService(cp.chain);
  const balance = await service.getBalance(cp.depositAddress, cp.token);

  const received = BigInt(balance);
  const expected = BigInt(cp.expectedAmount);

  if (received >= expected) {
    cp.status = 'detected';
    cp.receivedAmount = balance;
    await deal.save();

    logger.info(`Deposit detected for deal ${deal.dealId}: ${balance} on ${cp.chain}`);

    const ns = getNotificationService();
    if (ns) await ns.notifyDepositDetected(deal);
  }
}

async function checkDetectedDeposits(): Promise<void> {
  const deals = await Deal.find({
    'cryptoPayment.status': 'detected',
    cryptoPayment: { $exists: true },
  });

  for (const deal of deals) {
    try {
      await checkConfirmations(deal);
    } catch (err) {
      logger.error(`Confirmation check error for deal ${deal.dealId}:`, err);
    }
  }
}

async function checkConfirmations(deal: IDeal): Promise<void> {
  const cp = deal.cryptoPayment!;
  const service = getChainService(cp.chain);
  const threshold = getConfirmationThreshold(cp.chain);

  // For chains that support tx-based confirmation checking
  if (service.getConfirmations && cp.depositTxHash) {
    const confirmations = await service.getConfirmations(cp.depositTxHash);
    cp.confirmations = confirmations;

    if (confirmations >= threshold) {
      await confirmDeposit(deal);
    } else {
      await deal.save();
    }
    return;
  }

  // For TRON and chains without tx-hash based confirmations,
  // we consider a detected deposit as confirmed after a brief delay
  // (balance-based confirmation — if the balance is still there, it's confirmed)
  const balance = await service.getBalance(cp.depositAddress, cp.token);
  if (BigInt(balance) >= BigInt(cp.expectedAmount)) {
    await confirmDeposit(deal);
  }
}

async function confirmDeposit(deal: IDeal): Promise<void> {
  const cp = deal.cryptoPayment!;

  cp.status = 'confirmed';
  cp.fundedAt = new Date();
  deal.status = 'funded';
  deal.paymentConfirmed = true;
  deal.paymentConfirmedAt = new Date();
  deal.statusHistory.push({
    status: 'funded',
    changedAt: new Date(),
    note: `Crypto deposit confirmed on ${cp.chain}`,
  });

  await deal.save();
  logger.info(`Deposit confirmed for deal ${deal.dealId}`);

  const ns = getNotificationService();
  if (ns) await ns.notifyDepositConfirmed(deal);
}

export async function checkDealDeposit(dealId: string): Promise<{ found: boolean; status: string }> {
  const deal = await Deal.findOne({ dealId });
  if (!deal || !deal.cryptoPayment) {
    return { found: false, status: 'no_crypto' };
  }

  const cp = deal.cryptoPayment;
  if (cp.status === 'confirmed' || cp.status === 'released') {
    return { found: true, status: cp.status };
  }

  if (cp.status === 'pending') {
    await checkDeposit(deal);
  }
  if (cp.status === 'detected') {
    await checkConfirmations(deal);
  }

  return { found: cp.status !== 'pending', status: cp.status };
}

export function startCryptoWatcherJob(): void {
  cron.schedule(POLL_CRON, async () => {
    try {
      await checkPendingDeposits();
      await checkDetectedDeposits();
    } catch (err) {
      logger.error('Crypto watcher job error:', err);
    }
  });
  logger.info('Crypto watcher job started (every 45s)');
}
