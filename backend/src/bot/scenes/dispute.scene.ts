import { Scenes, Markup } from 'telegraf';
import { BotContext, getSession } from '../context';
import { Deal, Dispute } from '../../models';
import { getNotificationService } from '../../services/notification.service';
import { formatDealStatus } from '../utils/formatDeal';
import { websiteButtonRow } from '../utils/safeUrl';

export const disputeScene = new Scenes.WizardScene<BotContext>(
  'dispute',

  // Step 0: Select deal to dispute
  async (ctx) => {
    if (!ctx.dbUser) {
      await ctx.reply('Please /start the bot first.');
      return ctx.scene.leave();
    }

    // Check if a deal was pre-selected via callback
    if (getSession(ctx).dispute?.dealId) {
      await ctx.replyWithHTML(
        `⚖️ <b>Open Dispute for ${getSession(ctx).dispute!.dealId}</b>\n\n` +
        `Please describe the reason for your dispute (minimum 10 characters):`,
      );
      return ctx.wizard.next();
    }

    const deals = await Deal.find({
      $or: [{ buyer: ctx.dbUser._id }, { seller: ctx.dbUser._id }],
      status: { $in: ['active', 'payment_confirmed', 'in_progress', 'delivered'] },
    }).lean();

    if (deals.length === 0) {
      await ctx.reply('You have no active deals to dispute.');
      return ctx.scene.leave();
    }

    const buttons = deals.map(deal => [
      Markup.button.callback(
        `${formatDealStatus(deal.status)} ${deal.dealId}`,
        `dispute_select:${deal.dealId}`
      ),
    ]);
    buttons.push([Markup.button.callback('❌ Cancel', 'wizard:cancel')]);

    await ctx.replyWithHTML(
      '⚖️ <b>Open Dispute</b>\n\nSelect which deal to dispute:',
      Markup.inlineKeyboard(buttons)
    );
    return ctx.wizard.next();
  },

  // Step 1: Get reason
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      const reason = ctx.message.text.trim();

      if (reason.length < 10) {
        await ctx.reply('Please provide more details (minimum 10 characters):');
        return;
      }

      const sess = getSession(ctx);
      if (!sess.dispute) sess.dispute = {};
      sess.dispute.reason = reason;

      await ctx.replyWithHTML(
        `⚖️ <b>Confirm Dispute</b>\n\n` +
        `Deal: <b>${sess.dispute.dealId}</b>\n` +
        `Reason: ${reason}\n\n` +
        `⚠️ This will <b>freeze</b> the deal. Are you sure?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('⚖️ Open Dispute', 'dispute:confirm'),
            Markup.button.callback('❌ Cancel', 'wizard:cancel'),
          ],
        ])
      );
      return ctx.wizard.next();
    }
  },

  // Step 2: Confirmation handler (handled by action below)
  async () => {},
);

// Deal selection for dispute
disputeScene.action(/^dispute_select:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const dealId = ctx.match[1];

  const sess = getSession(ctx);
  if (!sess.dispute) sess.dispute = {};
  sess.dispute.dealId = dealId;

  await ctx.editMessageText(
    `⚖️ <b>Open Dispute for ${dealId}</b>\n\n` +
    `Please describe the reason for your dispute (minimum 10 characters):`,
    { parse_mode: 'HTML' }
  );
});

// Confirm dispute
disputeScene.action('dispute:confirm', async (ctx) => {
  await ctx.answerCbQuery('Opening dispute...');

  const { dealId, reason } = getSession(ctx).dispute || {};
  if (!dealId || !reason) {
    await ctx.reply('Error: missing data. Please try again.');
    return ctx.scene.leave();
  }

  try {
    const deal = await Deal.findOne({ dealId });
    if (!deal) {
      await ctx.reply('Deal not found.');
      return ctx.scene.leave();
    }

    const userId = ctx.dbUser!._id;
    const isBuyer = deal.buyer.toString() === userId.toString();

    // Create dispute
    const dispute = await Dispute.create({
      deal: deal._id,
      dealId: deal.dealId,
      openedBy: userId,
      openedByRole: isBuyer ? 'buyer' : 'seller',
      reason,
    });

    // Update deal status
    deal.status = 'disputed';
    deal.statusHistory.push({
      status: 'disputed',
      changedBy: userId,
      changedAt: new Date(),
      note: `Dispute opened: ${reason}`,
    });
    await deal.save();

    await ctx.editMessageText(
      `⚖️ <b>Dispute Opened</b>\n\n` +
      `Deal: ${dealId}\n` +
      `Status: FROZEN\n\n` +
      `Please submit evidence on the website. Both parties and admin have been notified.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...websiteButtonRow('🌐 Submit Evidence', `/disputes/${dispute._id}`),
        ]),
      }
    );

    // Notify all parties
    const notificationService = getNotificationService();
    if (notificationService) {
      await notificationService.notifyDisputeOpened(dispute, deal);
    }
  } catch {
    await ctx.reply('Failed to open dispute. Please try again.');
  }

  return ctx.scene.leave();
});

// Cancel
disputeScene.action('wizard:cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.editMessageText('❌ Dispute cancelled.');
  return ctx.scene.leave();
});
