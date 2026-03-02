import { Telegraf, Markup } from 'telegraf';
import { BotContext, getSession } from '../context';
import { Deal, User, AuditLog } from '../../models';
import { getNotificationService } from '../../services/notification.service';
import { formatDealSummary, formatDealStatus } from '../utils/formatDeal';
import { websiteButtonRow } from '../utils/safeUrl';

export function setupCallbacks(bot: Telegraf<BotContext>) {
  // View deal detail
  bot.action(/^view:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId })
      .populate('buyer', 'username firstName telegramId')
      .populate('seller', 'username firstName telegramId')
      .lean();

    if (!deal) {
      await ctx.reply('Deal not found.');
      return;
    }

    const summary = formatDealSummary(deal);
    const status = formatDealStatus(deal.status);
    const text = `${summary}\n\n<b>Status:</b> ${status}`;

    // Build action buttons based on status and user role
    const buttons: any[][] = [];
    const userId = ctx.dbUser?._id?.toString();
    const isBuyer = (deal.buyer as any)._id?.toString() === userId;
    const isSeller = (deal.seller as any)._id?.toString() === userId;

    if (deal.status === 'payment_confirmed' || deal.status === 'in_progress') {
      if (isSeller) {
        buttons.push([Markup.button.callback('📦 Mark Delivered', `deliver:${dealId}`)]);
      }
    }

    if (deal.status === 'delivered') {
      if (isBuyer) {
        buttons.push([
          Markup.button.callback('✅ Confirm Delivery', `confirm:${dealId}`),
          Markup.button.callback('⚖️ Dispute', `dispute:${dealId}`),
        ]);
      }
    }

    if (['active', 'payment_confirmed', 'in_progress', 'delivered'].includes(deal.status)) {
      buttons.push([Markup.button.callback('⚖️ Open Dispute', `dispute:${dealId}`)]);
    }

    if (['draft', 'pending_agreement', 'active'].includes(deal.status)) {
      buttons.push([Markup.button.callback('❌ Cancel Deal', `cancel:${dealId}`)]);
    }

    buttons.push(...websiteButtonRow('🌐 View on Website', `/deals/${dealId}`));

    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  });

  // Agree to deal
  bot.action(/^agree:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Processing...');
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId });
    if (!deal) {
      await ctx.reply('Deal not found.');
      return;
    }

    if (deal.status !== 'pending_agreement') {
      await ctx.reply(`This deal is no longer pending. Current status: ${formatDealStatus(deal.status)}`);
      return;
    }

    const userId = ctx.dbUser?._id?.toString();
    const isBuyer = deal.buyer.toString() === userId;
    const isSeller = deal.seller.toString() === userId;

    if (!isBuyer && !isSeller) {
      await ctx.reply('You are not a participant in this deal.');
      return;
    }

    if (isBuyer) {
      deal.buyerAgreed = true;
      deal.buyerAgreedAt = new Date();
    } else {
      deal.sellerAgreed = true;
      deal.sellerAgreedAt = new Date();
    }

    // If both agreed, activate the deal
    if (deal.buyerAgreed && deal.sellerAgreed) {
      deal.status = 'active';
      deal.statusHistory.push({
        status: 'active',
        changedBy: ctx.dbUser!._id,
        changedAt: new Date(),
        note: 'Both parties agreed',
      });
    }

    await deal.save();

    if (deal.status === 'active') {
      await ctx.editMessageText(
        `✅ <b>You agreed to deal ${dealId}!</b>\n\n` +
        `Both parties have now agreed. The deal is <b>active</b>.\n` +
        `Waiting for admin to confirm payment.`,
        { parse_mode: 'HTML' }
      );

      // Notify both parties
      const populatedDeal = await Deal.findById(deal._id)
        .populate('buyer', 'username firstName telegramId')
        .populate('seller', 'username firstName telegramId');

      const notificationService = getNotificationService();
      if (notificationService && populatedDeal) {
        await notificationService.notifyDealAgreed(populatedDeal);
      }
    } else {
      await ctx.editMessageText(
        `✅ <b>You agreed to deal ${dealId}!</b>\n\nWaiting for the other party to agree.`,
        { parse_mode: 'HTML' }
      );
    }

    await AuditLog.create({
      action: 'deal_agreed',
      performedBy: ctx.dbUser!._id,
      targetDeal: deal._id,
    });
  });

  // Decline deal
  bot.action(/^decline:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId });
    if (!deal || deal.status !== 'pending_agreement') {
      await ctx.reply('Deal not found or no longer pending.');
      return;
    }

    deal.status = 'cancelled';
    deal.cancelledAt = new Date();
    deal.cancelledBy = ctx.dbUser!._id;
    deal.cancelReason = 'Declined by counterparty';
    deal.statusHistory.push({
      status: 'cancelled',
      changedBy: ctx.dbUser!._id,
      changedAt: new Date(),
      note: 'Declined by counterparty',
    });
    await deal.save();

    await ctx.editMessageText(
      `❌ <b>Deal ${dealId} declined.</b>\n\nThe other party has been notified.`,
      { parse_mode: 'HTML' }
    );

    // Notify creator
    const creator = await User.findById(deal.createdBy);
    if (creator) {
      const notificationService = getNotificationService();
      if (notificationService) {
        await notificationService.sendToUser(
          creator.telegramId,
          `❌ <b>Deal ${dealId} Declined</b>\n\n@${ctx.dbUser?.username || ctx.from!.first_name} has declined the deal.`
        );
      }
    }

    await AuditLog.create({
      action: 'deal_rejected',
      performedBy: ctx.dbUser!._id,
      targetDeal: deal._id,
    });
  });

  // Mark as delivered (seller)
  bot.action(/^deliver:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Processing...');
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId });
    if (!deal) {
      await ctx.reply('Deal not found.');
      return;
    }

    if (!['payment_confirmed', 'in_progress'].includes(deal.status)) {
      await ctx.reply(`Cannot mark as delivered. Current status: ${formatDealStatus(deal.status)}`);
      return;
    }

    const isSeller = deal.seller.toString() === ctx.dbUser?._id?.toString();
    if (!isSeller) {
      await ctx.reply('Only the seller can mark a deal as delivered.');
      return;
    }

    deal.status = 'delivered';
    deal.deliveredAt = new Date();

    // Set auto-release date
    const autoReleaseDate = new Date();
    autoReleaseDate.setDate(autoReleaseDate.getDate() + (deal.terms.autoReleaseDays || 3));
    deal.terms.autoReleaseDate = autoReleaseDate;

    deal.statusHistory.push({
      status: 'delivered',
      changedBy: ctx.dbUser!._id,
      changedAt: new Date(),
      note: 'Marked as delivered by seller',
    });
    await deal.save();

    await ctx.editMessageText(
      `📦 <b>Deal ${dealId} marked as delivered!</b>\n\n` +
      `Buyer has been notified. Auto-release in ${deal.terms.autoReleaseDays} days if no dispute.`,
      { parse_mode: 'HTML' }
    );

    // Notify buyer
    const populatedDeal = await Deal.findById(deal._id)
      .populate('buyer', 'username firstName telegramId')
      .populate('seller', 'username firstName telegramId');

    const notificationService = getNotificationService();
    if (notificationService && populatedDeal) {
      await notificationService.notifyDelivery(populatedDeal);
    }

    await AuditLog.create({
      action: 'deal_delivered',
      performedBy: ctx.dbUser!._id,
      targetDeal: deal._id,
    });
  });

  // Confirm delivery (buyer)
  bot.action(/^confirm:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Processing...');
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId });
    if (!deal || deal.status !== 'delivered') {
      await ctx.reply('Deal not found or not in delivered status.');
      return;
    }

    const isBuyer = deal.buyer.toString() === ctx.dbUser?._id?.toString();
    if (!isBuyer) {
      await ctx.reply('Only the buyer can confirm delivery.');
      return;
    }

    deal.status = 'completed';
    deal.completedAt = new Date();
    deal.statusHistory.push({
      status: 'completed',
      changedBy: ctx.dbUser!._id,
      changedAt: new Date(),
      note: 'Delivery confirmed by buyer',
    });
    await deal.save();

    // Update reputation
    await User.findByIdAndUpdate(deal.buyer, { $inc: { 'reputation.completedDeals': 1, 'reputation.score': 5 } });
    await User.findByIdAndUpdate(deal.seller, { $inc: { 'reputation.completedDeals': 1, 'reputation.score': 5 } });

    await ctx.editMessageText(
      `🎉 <b>Deal ${dealId} Completed!</b>\n\nDelivery confirmed. Both parties have been notified.`,
      { parse_mode: 'HTML' }
    );

    const populatedDeal = await Deal.findById(deal._id)
      .populate('buyer', 'username firstName telegramId')
      .populate('seller', 'username firstName telegramId');

    const notificationService = getNotificationService();
    if (notificationService && populatedDeal) {
      await notificationService.notifyDealCompleted(populatedDeal);
    }

    await AuditLog.create({
      action: 'deal_completed',
      performedBy: ctx.dbUser!._id,
      targetDeal: deal._id,
    });
  });

  // Open dispute
  bot.action(/^dispute:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];

    getSession(ctx).dispute = { dealId };
    return ctx.scene.enter('dispute');
  });

  // Cancel deal
  bot.action(/^cancel:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId });
    if (!deal) {
      await ctx.reply('Deal not found.');
      return;
    }

    if (!['draft', 'pending_agreement', 'active'].includes(deal.status)) {
      await ctx.reply(`Cannot cancel. Current status: ${formatDealStatus(deal.status)}`);
      return;
    }

    const isParticipant = deal.buyer.toString() === ctx.dbUser?._id?.toString() ||
                          deal.seller.toString() === ctx.dbUser?._id?.toString();

    if (!isParticipant) {
      await ctx.reply('You are not a participant in this deal.');
      return;
    }

    deal.status = 'cancelled';
    deal.cancelledAt = new Date();
    deal.cancelledBy = ctx.dbUser!._id;
    deal.cancelReason = 'Cancelled by participant';
    deal.statusHistory.push({
      status: 'cancelled',
      changedBy: ctx.dbUser!._id,
      changedAt: new Date(),
      note: `Cancelled by ${ctx.dbUser?.username || 'participant'}`,
    });
    await deal.save();

    await ctx.editMessageText(
      `❌ <b>Deal ${dealId} Cancelled</b>\n\nThe other party has been notified.`,
      { parse_mode: 'HTML' }
    );

    await AuditLog.create({
      action: 'deal_cancelled',
      performedBy: ctx.dbUser!._id,
      targetDeal: deal._id,
    });
  });
}
