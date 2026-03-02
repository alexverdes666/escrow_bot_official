import { Telegraf, Context } from 'telegraf';
import { User, IDeal, IDispute } from '../models';
import { logger } from '../utils/logger';

const FRONTEND_URL = process.env.FRONTEND_URL || '';
const isHttps = FRONTEND_URL.startsWith('https');

let notificationServiceInstance: NotificationService | null = null;

export class NotificationService {
  private bot: Telegraf<any>;

  constructor(bot: Telegraf<any>) {
    this.bot = bot;
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

  async notifyDealCreated(deal: any): Promise<void> {
    const seller = await User.findById(deal.seller);
    const buyer = await User.findById(deal.buyer);
    if (!seller || !buyer) return;

    const counterparty = deal.createdBy.toString() === deal.buyer.toString() ? seller : buyer;
    const creator = deal.createdBy.toString() === deal.buyer.toString() ? buyer : seller;

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
