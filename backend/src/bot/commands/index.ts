import { Telegraf, Markup } from 'telegraf';
import { BotContext, getSession } from '../context';
import { Deal, User } from '../../models';
import { env } from '../../config/env';
import { formatDealListItem, formatDealStatus } from '../utils/formatDeal';
import { websiteButtonRow } from '../utils/safeUrl';
import { createLoginToken } from '../../api/routes/auth.routes';

export function setupCommands(bot: Telegraf<BotContext>) {
  // /start command
  bot.start(async (ctx) => {
    const payload = ctx.startPayload;

    // Handle deep links from groups: start=deal_{counterpartyTgId}_{groupChatId}
    if (payload && payload.startsWith('deal_')) {
      const parts = payload.split('_');
      if (parts.length >= 3) {
        const counterpartyTgId = parseInt(parts[1], 10);
        const groupChatId = parseInt(parts[2], 10);

        // Store origin info in session and enter deal creation scene
        getSession(ctx).dealCreation = {
          counterpartyTelegramId: counterpartyTgId,
          originType: 'group',
          originChatId: groupChatId,
          originChatTitle: parts[3] || undefined,
          terms: {},
          currentStep: 0,
        };

        return ctx.scene.enter('deal-creation');
      }
    }

    await ctx.replyWithHTML(
      `👋 <b>Welcome to My Escrow Bot!</b>\n\n` +
      `I help buyers and sellers create secure deals with escrow protection.\n\n` +
      `<b>How it works:</b>\n` +
      `1. Create a deal with /newdeal\n` +
      `2. Both parties agree to terms\n` +
      `3. Payment is confirmed by admin\n` +
      `4. Seller delivers, buyer confirms\n` +
      `5. Deal completed! 🎉\n\n` +
      `<b>Commands:</b>\n` +
      `/newdeal — Create a new deal\n` +
      `/mydeals — View your active deals\n` +
      `/help — Get help\n\n` +
      `You can also use me in groups! Just type:\n` +
      `<code>/newdeal @username</code>`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')],
        [Markup.button.callback('📋 My Deals', 'cmd:mydeals')],
        ...websiteButtonRow('🌐 Open Website'),
      ])
    );
  });

  // /help command
  bot.help(async (ctx) => {
    await ctx.replyWithHTML(
      `📖 <b>Help — My Escrow Bot</b>\n\n` +
      `<b>Commands:</b>\n` +
      `/start — Start the bot\n` +
      `/newdeal — Create a new escrow deal\n` +
      `/mydeals — View your active deals\n` +
      `/cancel — Cancel current operation\n` +
      `/help — Show this help message\n\n` +
      `<b>In Groups:</b>\n` +
      `<code>/newdeal @username</code> — Start a deal with someone in the group\n\n` +
      `<b>Deal Types:</b>\n` +
      `💰 Full Prepay — 100% upfront\n` +
      `💳 Partial Prepay — Deposit + remainder\n` +
      `📊 Milestone — Pay in stages\n` +
      `🤝 No Prepay — Pay on delivery\n\n` +
      `<b>Disputes:</b>\n` +
      `If something goes wrong, you can open a dispute. Admin will review evidence and decide.\n\n` +
      `Questions? Visit the website or contact the admin.`
    );
  });

  // /newdeal command
  bot.command('newdeal', async (ctx) => {
    // Check if in group and has @username arg
    const chatType = ctx.chat?.type;
    const args = ctx.message.text.split(' ').slice(1);

    if (chatType === 'group' || chatType === 'supergroup') {
      if (args.length === 0) {
        await ctx.reply(
          'In groups, use: /newdeal @username\n\nOr start a deal in private chat with me.',
          Markup.inlineKeyboard([
            [Markup.button.url('Start Private Chat', `https://t.me/${env.BOT_USERNAME}`)],
          ])
        );
        return;
      }

      const targetUsername = args[0].replace('@', '');
      const targetUser = await User.findOne({ username: targetUsername });

      if (!targetUser) {
        await ctx.reply(
          `User @${targetUsername} hasn't used this bot yet. They need to /start the bot first.`
        );
        return;
      }

      // Generate deep link to redirect to private chat
      const groupTitle = ctx.chat && 'title' in ctx.chat ? ctx.chat.title : '';
      const deepLinkPayload = `deal_${targetUser.telegramId}_${ctx.chat!.id}_${encodeURIComponent(groupTitle || '')}`;

      await ctx.replyWithHTML(
        `🤝 <b>Deal with @${targetUsername}</b>\n\n` +
        `Continue in private chat to set up deal terms.`,
        Markup.inlineKeyboard([
          [Markup.button.url('📝 Set Up Deal', `https://t.me/${env.BOT_USERNAME}?start=${deepLinkPayload}`)],
        ])
      );
      return;
    }

    // Private chat: enter deal creation wizard
    getSession(ctx).dealCreation = {
      terms: {},
      originType: 'private',
      currentStep: 0,
    };
    return ctx.scene.enter('deal-creation');
  });

  // /mydeals command
  bot.command('mydeals', async (ctx) => {
    if (!ctx.dbUser) {
      await ctx.reply('Please /start the bot first.');
      return;
    }

    const deals = await Deal.find({
      $or: [{ buyer: ctx.dbUser._id }, { seller: ctx.dbUser._id }],
      status: { $nin: ['cancelled', 'completed', 'resolved'] },
    })
      .populate('buyer', 'username firstName telegramId')
      .populate('seller', 'username firstName telegramId')
      .sort('-updatedAt')
      .limit(10)
      .lean();

    if (deals.length === 0) {
      await ctx.replyWithHTML(
        'You have no active deals.\n\nUse /newdeal to create one!',
        Markup.inlineKeyboard([
          [Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')],
        ])
      );
      return;
    }

    let text = `📋 <b>Your Active Deals</b>\n\n`;
    const buttons: any[][] = [];

    deals.forEach(deal => {
      text += formatDealListItem(deal, ctx.from!.id) + '\n\n';
      buttons.push([
        Markup.button.callback(`📄 ${deal.dealId}`, `view:${deal.dealId}`),
      ]);
    });

    buttons.push([Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')]);

    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  });

  // /login command — generates a one-time login link for the website
  bot.command('login', async (ctx) => {
    if (!ctx.from) return;

    const frontendUrl = env.FRONTEND_URL;
    if (!frontendUrl || !frontendUrl.startsWith('https')) {
      await ctx.reply('Website login is not available yet.');
      return;
    }

    const token = createLoginToken(ctx.from.id);
    const loginUrl = `${frontendUrl}/login?token=${token}`;

    await ctx.replyWithHTML(
      `🔐 <b>Website Login</b>\n\n` +
      `Click the button below to log in to the dashboard.\n` +
      `This link expires in <b>5 minutes</b> and can only be used once.`,
      Markup.inlineKeyboard([
        [Markup.button.url('🌐 Log In to Website', loginUrl)],
      ])
    );
  });

  // /cancel command
  bot.command('cancel', async (ctx) => {
    const session = getSession(ctx);
    session.pendingAttachment = undefined;
    session.pendingDisputeEvidence = undefined;
    await ctx.scene.leave();
    await ctx.reply('Operation cancelled. Use /newdeal to start again.');
  });

  // Inline button for /newdeal shortcut
  bot.action('cmd:newdeal', async (ctx) => {
    await ctx.answerCbQuery();
    getSession(ctx).dealCreation = {
      terms: {},
      originType: 'private',
      currentStep: 0,
    };
    return ctx.scene.enter('deal-creation');
  });

  // Inline button for /mydeals shortcut
  bot.action('cmd:mydeals', async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.dbUser) return;

    const deals = await Deal.find({
      $or: [{ buyer: ctx.dbUser._id }, { seller: ctx.dbUser._id }],
      status: { $nin: ['cancelled', 'completed', 'resolved'] },
    })
      .populate('buyer', 'username firstName telegramId')
      .populate('seller', 'username firstName telegramId')
      .sort('-updatedAt')
      .limit(10)
      .lean();

    if (deals.length === 0) {
      await ctx.editMessageText('You have no active deals.\n\nUse /newdeal to create one!');
      return;
    }

    let text = `📋 <b>Your Active Deals</b>\n\n`;
    const buttons: any[][] = [];

    deals.forEach(deal => {
      text += formatDealListItem(deal, ctx.from!.id) + '\n\n';
      buttons.push([
        Markup.button.callback(`📄 ${deal.dealId}`, `view:${deal.dealId}`),
      ]);
    });

    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  });
}
