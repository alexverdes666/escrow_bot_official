import { Telegraf, Context } from 'telegraf';
import { User, IDeal, IDispute } from '../models';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const FRONTEND_URL = process.env.FRONTEND_URL || '';
const isHttps = FRONTEND_URL.startsWith('https');

let notificationServiceInstance: NotificationService | null = null;

export class NotificationService {
  private bot: Telegraf<any>;

  constructor(bot: Telegraf<any>) {
    this.bot = bot;
  }

  getTelegram() {
    return this.bot.telegram;
  }

  async sendToUser(telegramId: number, message: string, extra?: object): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (error) {
      logger.error(`Failed to send message to ${telegramId}:`, error);
    }
  }

  async sendPhotoToUser(telegramId: number, fileId: string, caption?: string): Promise<void> {
    try {
      await this.bot.telegram.sendPhoto(telegramId, fileId, {
        caption,
        parse_mode: 'HTML',
      });
    } catch (error) {
      logger.error(`Failed to send photo to ${telegramId}:`, error);
    }
  }

  async sendDocumentToUser(telegramId: number, fileId: string, caption?: string): Promise<void> {
    try {
      await this.bot.telegram.sendDocument(telegramId, fileId, {
        caption,
        parse_mode: 'HTML',
      });
    } catch (error) {
      logger.error(`Failed to send document to ${telegramId}:`, error);
    }
  }

  async notifyDealCreated(deal: any): Promise<void> {
    const seller = await User.findById(deal.seller);
    const buyer = await User.findById(deal.buyer);
    if (!seller || !buyer) return;

    const createdById = deal.createdBy._id?.toString() || deal.createdBy.toString();
    const buyerId = deal.buyer._id?.toString() || deal.buyer.toString();
    const counterparty = createdById === buyerId ? seller : buyer;
    const creator = createdById === buyerId ? buyer : seller;

    await this.sendToUser(
      counterparty.telegramId,
      `📩 <b>New Deal Proposal</b>\n\n` +
      `From: @${creator.username || creator.firstName}\n` +
      `Deal: <b>${deal.dealId}</b>\n` +
      `Description: ${deal.terms.description}\n` +
      `Amount: <b>${deal.terms.totalAmount} ${deal.terms.currency}</b>\n` +
      `Type: ${deal.terms.paymentType.replace(/_/g, ' ')}\n\n` +
      `Use the buttons below to accept or decline.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ I Agree', callback_data: `agree:${deal.dealId}` },
              { text: '❌ Decline', callback_data: `decline:${deal.dealId}` },
            ],
            ...(isHttps ? [[{ text: '🌐 View on Website', url: `${FRONTEND_URL}/deals/${deal.dealId}` }]] : []),
          ],
        },
      }
    );
  }

  async notifyDealAgreed(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller) return;

    const msg = `✅ <b>Deal ${deal.dealId} is now active!</b>\n\n` +
      `Both parties have agreed. Waiting for payment confirmation from admin.\n` +
      `Amount: <b>${deal.terms.totalAmount} ${deal.terms.currency}</b>`;

    await Promise.all([
      this.sendToUser(buyer.telegramId, msg),
      this.sendToUser(seller.telegramId, msg),
    ]);
  }

  async notifyPaymentConfirmed(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller) return;

    const msg = `💰 <b>Payment Confirmed for ${deal.dealId}</b>\n\n` +
      `Admin has confirmed payment receipt.\n` +
      `Seller, you can now proceed with delivery.`;

    await Promise.all([
      this.sendToUser(buyer.telegramId, msg),
      this.sendToUser(seller.telegramId, msg, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📦 Mark as Delivered', callback_data: `deliver:${deal.dealId}` },
          ]],
        },
      }),
    ]);
  }

  async notifyDelivery(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller) return;

    await this.sendToUser(
      buyer.telegramId,
      `📦 <b>Delivery Notification — ${deal.dealId}</b>\n\n` +
      `@${seller.username || seller.firstName} has marked the deal as delivered.\n` +
      `Please confirm delivery or open a dispute within ${deal.terms.disputeWindowDays} days.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm Delivery', callback_data: `confirm:${deal.dealId}` },
              { text: '⚖️ Open Dispute', callback_data: `dispute:${deal.dealId}` },
            ],
          ],
        },
      }
    );

    await this.sendToUser(
      seller.telegramId,
      `📦 <b>Delivery marked for ${deal.dealId}</b>\n\n` +
      `Waiting for buyer confirmation. Auto-release in ${deal.terms.autoReleaseDays} days if no dispute.`
    );
  }

  async notifyDealCompleted(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller) return;

    const msg = `🎉 <b>Deal ${deal.dealId} Completed!</b>\n\n` +
      `The deal has been successfully completed.\n` +
      `Amount: ${deal.terms.totalAmount} ${deal.terms.currency}`;

    await Promise.all([
      this.sendToUser(buyer.telegramId, msg),
      this.sendToUser(seller.telegramId, msg),
    ]);
  }

  async notifyDisputeOpened(dispute: any, deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller) return;

    const msg = `⚖️ <b>Dispute Opened — ${deal.dealId}</b>\n\n` +
      `Reason: ${dispute.reason}\n\n` +
      `The deal is now frozen. Please submit evidence on the website.`;

    const extra = isHttps ? {
      reply_markup: {
        inline_keyboard: [[
          { text: '🌐 Submit Evidence', url: `${FRONTEND_URL}/disputes/${dispute._id}` },
        ]],
      },
    } : undefined;

    await Promise.all([
      this.sendToUser(buyer.telegramId, msg, extra),
      this.sendToUser(seller.telegramId, msg, extra),
    ]);
  }

  async notifyDepositAddress(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    if (!buyer || !deal.cryptoPayment) return;

    const cp = deal.cryptoPayment;
    const feePercent = env.CRYPTO_ENABLED ? env.CRYPTO_FEE_PERCENT : 2;
    const msg = `💰 <b>Deposit Address for ${deal.dealId}</b>\n\n` +
      `Send exactly <b>${cp.expectedAmountHuman}</b> to:\n\n` +
      `<code>${cp.depositAddress}</code>\n\n` +
      `Chain: <b>${cp.chain}</b>${cp.token ? ` (${cp.token})` : ''}\n` +
      `Network: <b>${cp.network}</b>\n` +
      `Platform fee: <b>${feePercent}%</b> (deducted on release)\n\n` +
      `⚠️ Send the exact amount. The system will detect your deposit automatically.`;

    await this.sendToUser(buyer.telegramId, msg, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 Check Payment', callback_data: `check_payment:${deal.dealId}` },
        ]],
      },
    });

    // Also notify seller
    const seller = await User.findById(deal.seller);
    if (seller) {
      await this.sendToUser(
        seller.telegramId,
        `⏳ <b>Deal ${deal.dealId} — Awaiting Deposit</b>\n\n` +
        `Buyer has been given the deposit address. Waiting for crypto payment of ${cp.expectedAmountHuman}.`
      );
    }
  }

  async notifyDepositDetected(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller || !deal.cryptoPayment) return;

    const msg = `⏳ <b>Deposit Detected — ${deal.dealId}</b>\n\n` +
      `We detected a payment of ${deal.cryptoPayment.expectedAmountHuman}.\n` +
      `Waiting for blockchain confirmations...`;

    await Promise.all([
      this.sendToUser(buyer.telegramId, msg),
      this.sendToUser(seller.telegramId, msg),
    ]);
  }

  async notifyDepositConfirmed(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller || !deal.cryptoPayment) return;

    await this.sendToUser(
      buyer.telegramId,
      `✅ <b>Payment Confirmed — ${deal.dealId}</b>\n\n` +
      `Your crypto deposit has been confirmed on-chain.\n` +
      `Funds are now held in escrow. Seller, proceed with delivery.`
    );

    await this.sendToUser(
      seller.telegramId,
      `💰 <b>Payment Confirmed — ${deal.dealId}</b>\n\n` +
      `Buyer's crypto deposit is confirmed. Funds are in escrow.\n` +
      `You can now proceed with delivery.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📦 Mark as Delivered', callback_data: `deliver:${deal.dealId}` },
          ]],
        },
      }
    );
  }

  async notifyFundsReleased(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller || !deal.cryptoPayment) return;

    const cp = deal.cryptoPayment;

    const feeInfo = cp.platformFeeAmount
      ? `\nPlatform fee: <b>${cp.platformFeeAmount}</b> (${env.CRYPTO_FEE_PERCENT}%)`
      : '';

    await this.sendToUser(
      seller.telegramId,
      `💸 <b>Funds Released — ${deal.dealId}</b>\n\n` +
      `Crypto funds have been sent to your wallet.\n` +
      `TxHash: <code>${cp.releaseTxHash}</code>\n` +
      `Address: <code>${cp.sellerAddress}</code>${feeInfo}`
    );

    await this.sendToUser(
      buyer.telegramId,
      `✅ <b>Deal ${deal.dealId} — Funds Released</b>\n\n` +
      `Crypto escrow funds have been released to the seller.${feeInfo}`
    );
  }

  async notifyFundsRefunded(deal: any): Promise<void> {
    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller || !deal.cryptoPayment) return;

    const cp = deal.cryptoPayment;

    await this.sendToUser(
      buyer.telegramId,
      `💸 <b>Funds Refunded — ${deal.dealId}</b>\n\n` +
      `Crypto funds have been refunded to your wallet.\n` +
      `TxHash: <code>${cp.refundTxHash}</code>\n` +
      `Address: <code>${cp.buyerAddress}</code>`
    );

    await this.sendToUser(
      seller.telegramId,
      `ℹ️ <b>Deal ${deal.dealId} — Funds Refunded</b>\n\n` +
      `Crypto escrow funds have been refunded to the buyer.`
    );
  }

  async notifyDisputeResolved(dispute: any): Promise<void> {
    const deal = await (dispute.deal._id ? Promise.resolve(dispute.deal) :
      (await import('../models')).Deal.findById(dispute.deal).populate('buyer seller'));

    if (!deal) return;

    const buyer = await User.findById(deal.buyer);
    const seller = await User.findById(deal.seller);
    if (!buyer || !seller) return;

    const decisionText: Record<string, string> = {
      release_to_seller: 'Funds released to seller',
      refund_to_buyer: 'Funds refunded to buyer',
      split: `Split: Buyer ${dispute.resolution.splitPercent?.buyer}% / Seller ${dispute.resolution.splitPercent?.seller}%`,
      custom: 'Custom resolution',
    };

    const msg = `⚖️ <b>Dispute Resolved — ${deal.dealId}</b>\n\n` +
      `Decision: <b>${decisionText[dispute.resolution.decision] || 'Resolved'}</b>\n` +
      `${dispute.resolution.explanation ? `Explanation: ${dispute.resolution.explanation}` : ''}`;

    await Promise.all([
      this.sendToUser(buyer.telegramId, msg),
      this.sendToUser(seller.telegramId, msg),
    ]);
  }
}

export function initNotificationService(bot: Telegraf<any>): NotificationService {
  notificationServiceInstance = new NotificationService(bot);
  return notificationServiceInstance;
}

export function getNotificationService(): NotificationService | null {
  return notificationServiceInstance;
}

export function getTelegramApi() {
  return notificationServiceInstance?.getTelegram() ?? null;
}
