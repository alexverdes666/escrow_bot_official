import { Telegraf, Markup } from 'telegraf';
import { BotContext, getSession } from '../context';
import { Deal, User, AuditLog, Dispute } from '../../models';
import { getNotificationService } from '../../services/notification.service';
import { formatDealSummary, formatDealStatus } from '../utils/formatDeal';
import { websiteButtonRow } from '../utils/safeUrl';
import { env } from '../../config/env';
import { generateDepositAddress, validateWalletAddress } from '../../services/wallet.service';
import { getChainService, getChainLabel } from '../../services/chains';
import { checkDealDeposit } from '../../services/cryptoWatcher.service';
import { releaseFunds } from '../../services/cryptoRelease.service';
import { logger } from '../../utils/logger';

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

    // Show agree/decline for pending deals where this user hasn't agreed yet
    if (deal.status === 'pending_agreement') {
      const hasAgreed = (isBuyer && deal.buyerAgreed) || (isSeller && deal.sellerAgreed);
      if (!hasAgreed && (isBuyer || isSeller)) {
        buttons.push([
          Markup.button.callback('✅ I Agree', `agree:${dealId}`),
          Markup.button.callback('❌ Decline', `decline:${dealId}`),
        ]);
      }
    }

    if (deal.status === 'awaiting_deposit') {
      if (isBuyer) {
        buttons.push([Markup.button.callback('🔄 Check Payment', `check_payment:${dealId}`)]);
      }
    }

    if (deal.status === 'funded' || deal.status === 'payment_confirmed' || deal.status === 'in_progress') {
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

    // Attachment buttons for active deal states
    const attachmentStatuses = ['pending_agreement', 'active', 'awaiting_deposit', 'funded', 'payment_confirmed', 'in_progress', 'delivered', 'disputed'];
    if (attachmentStatuses.includes(deal.status) && (isBuyer || isSeller)) {
      const attachCount = deal.attachments?.length || 0;
      buttons.push([
        Markup.button.callback('📎 Attach File', `attach:${dealId}`),
        Markup.button.callback(`📂 Files (${attachCount})`, `attachments:${dealId}`),
      ]);
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
      // Check if this is a crypto deal that needs seller wallet
      const isCryptoDeal = env.CRYPTO_ENABLED && deal.cryptoPayment;
      // Note: cryptoPayment is set when deal is created with a crypto chain

      if (isCryptoDeal) {
        // If the current user is the seller, ask for wallet address
        if (isSeller) {
          await ctx.editMessageText(
            `✅ <b>You agreed to deal ${dealId}!</b>\n\n` +
            `This is a crypto escrow deal. Please provide your wallet address to receive payment.\n\n` +
            `Chain: <b>${deal.cryptoPayment!.chain}</b>${deal.cryptoPayment!.token ? ` (${deal.cryptoPayment!.token})` : ''}\n\n` +
            `Reply with your wallet address:`,
            { parse_mode: 'HTML' }
          );
          // Store that we're awaiting seller wallet for this deal
          getSession(ctx).pendingSellerWallet = dealId;
          return;
        }
        // If buyer agreed second, ask seller for wallet via notification
        await ctx.editMessageText(
          `✅ <b>You agreed to deal ${dealId}!</b>\n\n` +
          `Both parties have agreed. Waiting for seller to provide wallet address.`,
          { parse_mode: 'HTML' }
        );

        const populatedDeal = await Deal.findById(deal._id)
          .populate('buyer', 'username firstName telegramId')
          .populate('seller', 'username firstName telegramId');

        const notificationService = getNotificationService();
        if (notificationService && populatedDeal) {
          const seller = await User.findById(deal.seller);
          if (seller) {
            await notificationService.sendToUser(
              seller.telegramId,
              `✅ <b>Deal ${dealId} is now active!</b>\n\n` +
              `Both parties agreed. This is a crypto escrow deal.\n` +
              `Please provide your ${deal.cryptoPayment!.chain} wallet address to receive payment.\n\n` +
              `Reply with your wallet address:`,
              {
                reply_markup: {
                  inline_keyboard: [[
                    { text: '🔑 Provide Wallet', callback_data: `wallet:${dealId}` },
                  ]],
                },
              }
            );
          }
        }
      } else {
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

    if (!['funded', 'payment_confirmed', 'in_progress'].includes(deal.status)) {
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

    // Release crypto funds if applicable
    if (deal.cryptoPayment && deal.cryptoPayment.status === 'confirmed') {
      try {
        await releaseFunds(deal);
        await ctx.editMessageText(
          `🎉 <b>Deal ${dealId} Completed!</b>\n\n` +
          `Delivery confirmed. Crypto funds are being released to the seller.`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        logger.error(`Crypto release failed for ${dealId}:`, err);
        await ctx.editMessageText(
          `🎉 <b>Deal ${dealId} Completed!</b>\n\n` +
          `Delivery confirmed. Crypto release encountered an error — admin will handle manually.`,
          { parse_mode: 'HTML' }
        );
      }
    } else {
      await ctx.editMessageText(
        `🎉 <b>Deal ${dealId} Completed!</b>\n\nDelivery confirmed. Both parties have been notified.`,
        { parse_mode: 'HTML' }
      );
    }

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

  // Seller provides wallet address for crypto deal
  bot.action(/^wallet:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];

    // Store that we're awaiting seller wallet for this deal
    getSession(ctx).pendingSellerWallet = dealId;

    await ctx.editMessageText(
      `🔑 <b>Provide your wallet address for deal ${dealId}</b>\n\n` +
      `Reply with your wallet address:`,
      { parse_mode: 'HTML' }
    );
  });

  // --- Attachment callbacks ---

  // User clicks "Attach File" button
  bot.action(/^attach:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId });
    if (!deal) {
      await ctx.reply('Deal not found.');
      return;
    }

    const userId = ctx.dbUser?._id?.toString();
    const isParticipant = deal.buyer.toString() === userId || deal.seller.toString() === userId;
    if (!isParticipant) {
      await ctx.reply('You are not a participant in this deal.');
      return;
    }

    getSession(ctx).pendingAttachment = dealId;
    await ctx.reply(
      `📎 <b>Attach a file to deal ${dealId}</b>\n\n` +
      `Send a photo or document now.\nUse /cancel to abort.`,
      { parse_mode: 'HTML' }
    );
  });

  // List all deal attachments
  bot.action(/^attachments:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];

    const deal = await Deal.findOne({ dealId })
      .populate('attachments.uploadedBy', 'username firstName')
      .lean();

    if (!deal) {
      await ctx.reply('Deal not found.');
      return;
    }

    const attachments = deal.attachments || [];
    if (attachments.length === 0) {
      await ctx.reply(
        `📂 <b>No attachments for ${dealId}</b>\n\nNo files have been attached yet.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📎 Attach File', `attach:${dealId}`)],
            [Markup.button.callback('◀️ Back to Deal', `view:${dealId}`)],
          ]),
        }
      );
      return;
    }

    let text = `📂 <b>Attachments for ${dealId}</b> (${attachments.length})\n\n`;
    const buttons: any[][] = [];

    attachments.forEach((att: any, i: number) => {
      const uploader = att.uploadedBy?.username || att.uploadedBy?.firstName || 'Unknown';
      const icon = att.fileType === 'photo' ? '🖼' : '📄';
      const name = att.fileName || (att.fileType === 'photo' ? 'Photo' : 'Document');
      const date = new Date(att.uploadedAt).toLocaleDateString();
      text += `${i + 1}. ${icon} <b>${name}</b>\n   By @${uploader} · ${date}\n\n`;
      buttons.push([
        Markup.button.callback(`${icon} View: ${name.slice(0, 20)}`, `viewfile:${dealId}:${att._id}`),
      ]);
    });

    buttons.push([
      Markup.button.callback('📎 Attach More', `attach:${dealId}`),
      Markup.button.callback('◀️ Back to Deal', `view:${dealId}`),
    ]);

    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  });

  // View a specific attachment
  bot.action(/^viewfile:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const dealId = ctx.match[1];
    const attId = ctx.match[2];

    const deal = await Deal.findOne({ dealId });
    if (!deal) {
      await ctx.reply('Deal not found.');
      return;
    }

    const attachment = deal.attachments.find((a: any) => a._id?.toString() === attId);
    if (!attachment) {
      await ctx.reply('Attachment not found.');
      return;
    }

    const caption = attachment.caption || attachment.fileName || undefined;
    if (attachment.fileType === 'photo') {
      await ctx.replyWithPhoto(attachment.fileId, { caption });
    } else {
      await ctx.replyWithDocument(attachment.fileId, { caption });
    }
  });

  // Initiate dispute evidence file submission
  bot.action(/^dispute_evidence:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const disputeId = ctx.match[1];

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      await ctx.reply('Dispute not found.');
      return;
    }

    getSession(ctx).pendingDisputeEvidence = disputeId;
    await ctx.reply(
      `⚖️ <b>Submit Evidence</b>\n\n` +
      `Send a photo or document as evidence for this dispute.\nUse /cancel to abort.`,
      { parse_mode: 'HTML' }
    );
  });

  // Helper: notify counterparty about new attachment
  async function notifyAttachment(deal: any, uploaderId: string, attachment: any) {
    const notificationService = getNotificationService();
    if (!notificationService) return;

    const isBuyerUploader = deal.buyer.toString() === uploaderId;
    const counterpartyDoc = await User.findById(isBuyerUploader ? deal.seller : deal.buyer);
    if (!counterpartyDoc) return;

    const uploaderDoc = await User.findById(uploaderId);
    const uploaderName = uploaderDoc?.username || uploaderDoc?.firstName || 'Someone';
    const icon = attachment.fileType === 'photo' ? '🖼' : '📄';
    const fileName = attachment.fileName || (attachment.fileType === 'photo' ? 'Photo' : 'Document');

    await notificationService.sendToUser(
      counterpartyDoc.telegramId,
      `${icon} <b>New Attachment — ${deal.dealId}</b>\n\n` +
      `@${uploaderName} attached: <b>${fileName}</b>`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📂 View Attachments', callback_data: `attachments:${deal.dealId}` },
          ]],
        },
      }
    );
  }

  // Handle photo uploads
  bot.on('photo', async (ctx, next) => {
    const session = getSession(ctx);

    // Deal attachment
    if (session.pendingAttachment) {
      const dealId = session.pendingAttachment;
      const deal = await Deal.findOne({ dealId });
      if (!deal) {
        session.pendingAttachment = undefined;
        await ctx.reply('Deal not found. Upload cancelled.');
        return;
      }

      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // largest size
      const attachment = {
        fileId: photo.file_id,
        fileUniqueId: photo.file_unique_id,
        fileType: 'photo' as const,
        fileSize: photo.file_size,
        uploadedBy: ctx.dbUser!._id,
        uploadedAt: new Date(),
        caption: ctx.message.caption || undefined,
        dealStage: deal.status,
      };

      deal.attachments.push(attachment);
      await deal.save();
      session.pendingAttachment = undefined;

      await ctx.reply(
        `✅ Photo attached to deal <b>${dealId}</b>`,
        { parse_mode: 'HTML' }
      );

      await notifyAttachment(deal, ctx.dbUser!._id.toString(), attachment);
      return;
    }

    // Dispute evidence
    if (session.pendingDisputeEvidence) {
      const disputeId = session.pendingDisputeEvidence;
      const dispute = await Dispute.findById(disputeId);
      if (!dispute) {
        session.pendingDisputeEvidence = undefined;
        await ctx.reply('Dispute not found. Upload cancelled.');
        return;
      }

      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      dispute.evidence.push({
        submittedBy: ctx.dbUser!._id,
        type: 'image',
        content: photo.file_id,
        fileUniqueId: photo.file_unique_id,
        fileSize: photo.file_size,
        submittedAt: new Date(),
      });
      await dispute.save();
      session.pendingDisputeEvidence = undefined;

      await ctx.reply(
        `✅ Photo evidence submitted for dispute on deal <b>${dispute.dealId}</b>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    return next();
  });

  // Handle document uploads
  bot.on('document', async (ctx, next) => {
    const session = getSession(ctx);

    // Deal attachment
    if (session.pendingAttachment) {
      const dealId = session.pendingAttachment;
      const deal = await Deal.findOne({ dealId });
      if (!deal) {
        session.pendingAttachment = undefined;
        await ctx.reply('Deal not found. Upload cancelled.');
        return;
      }

      const doc = ctx.message.document;
      const attachment = {
        fileId: doc.file_id,
        fileUniqueId: doc.file_unique_id,
        fileType: 'document' as const,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
        uploadedBy: ctx.dbUser!._id,
        uploadedAt: new Date(),
        caption: ctx.message.caption || undefined,
        dealStage: deal.status,
      };

      deal.attachments.push(attachment);
      await deal.save();
      session.pendingAttachment = undefined;

      await ctx.reply(
        `✅ Document <b>${doc.file_name || 'file'}</b> attached to deal <b>${dealId}</b>`,
        { parse_mode: 'HTML' }
      );

      await notifyAttachment(deal, ctx.dbUser!._id.toString(), attachment);
      return;
    }

    // Dispute evidence
    if (session.pendingDisputeEvidence) {
      const disputeId = session.pendingDisputeEvidence;
      const dispute = await Dispute.findById(disputeId);
      if (!dispute) {
        session.pendingDisputeEvidence = undefined;
        await ctx.reply('Dispute not found. Upload cancelled.');
        return;
      }

      const doc = ctx.message.document;
      dispute.evidence.push({
        submittedBy: ctx.dbUser!._id,
        type: 'document',
        content: doc.file_id,
        fileName: doc.file_name,
        fileUniqueId: doc.file_unique_id,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
        submittedAt: new Date(),
      });
      await dispute.save();
      session.pendingDisputeEvidence = undefined;

      await ctx.reply(
        `✅ Document evidence submitted for dispute on deal <b>${dispute.dealId}</b>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    return next();
  });

  // Handle text messages for seller wallet address
  bot.on('text', async (ctx, next) => {
    const session = getSession(ctx);

    // Guard: if waiting for attachment, remind user to send a file
    if (session.pendingAttachment) {
      await ctx.reply(
        'Please send a photo or document, or use /cancel to abort.',
      );
      return;
    }

    // Guard: if waiting for dispute evidence, remind user to send a file
    if (session.pendingDisputeEvidence) {
      await ctx.reply(
        'Please send a photo or document as evidence, or use /cancel to abort.',
      );
      return;
    }

    const pendingDealId = session.pendingSellerWallet;

    if (!pendingDealId) return next();

    const walletAddress = ctx.message.text.trim();
    const deal = await Deal.findOne({ dealId: pendingDealId });

    if (!deal || !deal.cryptoPayment) {
      session.pendingSellerWallet = undefined;
      return next();
    }

    const isSeller = deal.seller.toString() === ctx.dbUser?._id?.toString();
    if (!isSeller) {
      session.pendingSellerWallet = undefined;
      return next();
    }

    // Validate wallet address
    if (!validateWalletAddress(deal.cryptoPayment.chain, walletAddress)) {
      await ctx.reply(`Invalid ${deal.cryptoPayment.chain} wallet address. Please try again:`);
      return;
    }

    // Save seller wallet and generate deposit address
    deal.cryptoPayment.sellerAddress = walletAddress;

    const chainService = getChainService(deal.cryptoPayment.chain);
    const { address, derivationIndex } = await generateDepositAddress(
      deal.cryptoPayment.chain,
      deal.cryptoPayment.token
    );

    deal.cryptoPayment.depositAddress = address;
    deal.cryptoPayment.derivationIndex = derivationIndex;
    deal.status = 'awaiting_deposit';
    deal.statusHistory.push({
      status: 'awaiting_deposit',
      changedBy: ctx.dbUser!._id,
      changedAt: new Date(),
      note: 'Deposit address generated, awaiting crypto payment',
    });

    await deal.save();
    session.pendingSellerWallet = undefined;

    await ctx.reply(
      `✅ <b>Wallet address saved!</b>\n\n` +
      `Deposit address has been generated. The buyer has been notified.`,
      { parse_mode: 'HTML' }
    );

    // Notify buyer with deposit address
    const notificationService = getNotificationService();
    if (notificationService) {
      await notificationService.notifyDepositAddress(deal);
    }

    await AuditLog.create({
      action: 'admin_action',
      performedBy: ctx.dbUser!._id,
      targetDeal: deal._id,
      details: { action: 'crypto_deposit_address_generated', address },
    });
  });

  // Manual check payment
  bot.action(/^check_payment:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Checking...');
    const dealId = ctx.match[1];

    try {
      const result = await checkDealDeposit(dealId);

      if (result.status === 'confirmed' || result.status === 'released') {
        await ctx.reply(`✅ Payment for deal ${dealId} is confirmed!`);
      } else if (result.status === 'detected') {
        await ctx.reply(`⏳ Payment detected for deal ${dealId}, waiting for confirmations...`);
      } else {
        await ctx.reply(
          `No deposit detected yet for deal ${dealId}.\n` +
          `Please make sure you sent the exact amount to the correct address.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Check Again', callback_data: `check_payment:${dealId}` },
              ]],
            },
          }
        );
      }
    } catch (err) {
      logger.error(`Check payment error for ${dealId}:`, err);
      await ctx.reply('Error checking payment. Please try again later.');
    }
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
