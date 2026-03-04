import { Telegraf, Markup } from 'telegraf';
import { BotContext, getSession } from '../context';
import { Deal, User } from '../../models';
import { env } from '../../config/env';
import { formatDealListItem, formatDealStatus } from '../utils/formatDeal';
import { websiteButtonRow } from '../utils/safeUrl';
import { createLoginToken } from '../../api/routes/auth.routes';
import { homeKeyboard, homeButtonRow } from '../keyboards';

function helpText(): string {
  return (
    `╔══════════════════════╗\n` +
    `     📖  <b>HELP  CENTER</b>\n` +
    `╚══════════════════════╝\n\n` +

    `┌─── <b>Commands</b> ────────┐\n` +
    `│  /start — Start the bot\n` +
    `│  /home — Main menu\n` +
    `│  /newdeal — New deal\n` +
    `│  /mydeals — Active deals\n` +
    `│  /profile — Your stats\n` +
    `│  /help — This page\n` +
    `│  /cancel — Cancel operation\n` +
    `└───────────────────────┘\n\n` +

    `┌─── <b>In Groups</b> ───────┐\n` +
    `│  <code>/newdeal @username</code>\n` +
    `│  Start a deal with someone\n` +
    `│  directly in a group chat\n` +
    `└───────────────────────┘\n\n` +

    `┌─── <b>Deal Types</b> ──────┐\n` +
    `│  💰 Full Prepay\n` +
    `│     ╰ 100% upfront\n` +
    `│  💳 Partial Prepay\n` +
    `│     ╰ Deposit + remainder\n` +
    `│  📊 Milestone-Based\n` +
    `│     ╰ Pay in stages\n` +
    `│  🤝 No Prepay\n` +
    `│     ╰ Pay on delivery\n` +
    `└───────────────────────┘\n\n` +

    `┌─── <b>Disputes</b> ────────┐\n` +
    `│  ⚖️ Something wrong?\n` +
    `│  Open a dispute and admin\n` +
    `│  will review the evidence.\n` +
    `└───────────────────────┘`
  );
}

function loginText(): string {
  return (
    `╔══════════════════════╗\n` +
    `    🔐  <b>WEBSITE  LOGIN</b>\n` +
    `╚══════════════════════╝\n\n` +
    `Click the button below to log in\nto the dashboard.\n\n` +
    `  ⏱ Expires in <b>5 minutes</b>\n` +
    `  🔑 Single use only`
  );
}

function profileText(
  name: string, rep: any, memberSince: string,
  totalDeals: number, asBuyer: number, asSeller: number,
  completedDeals: number, activeDeals: number,
): string {
  // Build reputation stars (1 star per 10 points, max 5)
  const starCount = Math.min(5, Math.floor(rep.score / 10));
  const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);

  return (
    `╔══════════════════════╗\n` +
    `     👤  <b>PROFILE</b>\n` +
    `╚══════════════════════╝\n\n` +

    `  <b>${name}</b>\n` +
    `  📅 Member since ${memberSince}\n\n` +

    `┌─── <b>Reputation</b> ──────┐\n` +
    `│  ${stars}  <b>${rep.score}</b> pts\n` +
    `└───────────────────────┘\n\n` +

    `┌─── <b>Deal Statistics</b> ──┐\n` +
    `│  📊 Total: <b>${totalDeals}</b>\n` +
    `│     ├ 🛒 Buyer: ${asBuyer}\n` +
    `│     └ 🏪 Seller: ${asSeller}\n` +
    `│  ✅ Completed: <b>${completedDeals}</b>\n` +
    `│  🔄 Active: <b>${activeDeals}</b>\n` +
    `└───────────────────────┘\n\n` +

    `┌─── <b>Dispute Record</b> ──┐\n` +
    `│  ⚖️  Total: <b>${rep.disputesTotal}</b>\n` +
    `│  🏆 Won: <b>${rep.disputesWon}</b>\n` +
    `│  ❌ Lost: <b>${rep.disputesLost}</b>\n` +
    `└───────────────────────┘`
  );
}

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

    // Send welcome GIF
    await ctx.replyWithAnimation(
      'https://media1.tenor.com/m/BN7UwJ61hEoAAAAC/reading-time-victor-pivert.gif',
      {
        caption:
          `╔══════════════════════╗\n` +
          `   🛡  <b>MY ESCROW BOT</b>  🛡\n` +
          `╚══════════════════════╝\n\n` +
          `Welcome! I help you create <b>secure deals</b>\nwith escrow protection.\n\n` +
          `┌─── <b>How it works</b> ───┐\n` +
          `│\n` +
          `│  1️⃣  Create a deal\n` +
          `│  2️⃣  Both parties agree\n` +
          `│  3️⃣  Payment is confirmed\n` +
          `│  4️⃣  Seller delivers\n` +
          `│  5️⃣  Deal completed! 🎉\n` +
          `│\n` +
          `└─────────────────────┘\n\n` +
          `⟫ Choose an option below to get started:`,
        parse_mode: 'HTML',
        ...homeKeyboard(),
      }
    );
  });

  // /help command
  bot.help(async (ctx) => {
    await ctx.replyWithHTML(helpText(),
      Markup.inlineKeyboard([
        [Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')],
        homeButtonRow(),
      ])
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
        `╔══════════════════════╗\n` +
        `     📋  <b>MY  DEALS</b>\n` +
        `╚══════════════════════╝\n\n` +
        `No active deals found.\nCreate your first deal below!`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')],
          homeButtonRow(),
        ])
      );
      return;
    }

    let text =
      `╔══════════════════════╗\n` +
      `     📋  <b>MY  DEALS</b>  (${deals.length})\n` +
      `╚══════════════════════╝\n\n`;
    const buttons: any[][] = [];

    deals.forEach((deal, i) => {
      text += formatDealListItem(deal, ctx.from!.id);
      if (i < deals.length - 1) text += `\n\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n`;
      else text += `\n`;
      buttons.push([
        Markup.button.callback(`📄 ${deal.dealId} — ${formatDealStatus(deal.status)}`, `view:${deal.dealId}`),
      ]);
    });

    text += `\n═══════════════════════`;
    buttons.push([Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')]);
    buttons.push(homeButtonRow());

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
      loginText(),
      Markup.inlineKeyboard([
        [Markup.button.url('🌐 Log In to Website', loginUrl)],
        homeButtonRow(),
      ])
    );
  });

  // /profile command
  bot.command('profile', async (ctx) => {
    if (!ctx.dbUser) {
      await ctx.reply('Please /start the bot first.');
      return;
    }

    const userId = ctx.dbUser._id;

    const [totalDeals, asBuyer, asSeller, completedDeals, activeDeals] = await Promise.all([
      Deal.countDocuments({ $or: [{ buyer: userId }, { seller: userId }] }),
      Deal.countDocuments({ buyer: userId }),
      Deal.countDocuments({ seller: userId }),
      Deal.countDocuments({
        $or: [{ buyer: userId }, { seller: userId }],
        status: 'completed',
      }),
      Deal.countDocuments({
        $or: [{ buyer: userId }, { seller: userId }],
        status: { $nin: ['cancelled', 'completed', 'resolved'] },
      }),
    ]);

    const rep = ctx.dbUser.reputation;
    const memberSince = ctx.dbUser.createdAt
      ? new Date(ctx.dbUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'Unknown';

    const name = ctx.dbUser.username ? `@${ctx.dbUser.username}` : ctx.dbUser.firstName;

    await ctx.replyWithHTML(
      profileText(name, rep, memberSince, totalDeals, asBuyer, asSeller, completedDeals, activeDeals),
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 My Deals', 'cmd:mydeals')],
        ...websiteButtonRow('🌐 View on Website', '/profile'),
        homeButtonRow(),
      ])
    );
  });

  // /cancel command
  bot.command('cancel', async (ctx) => {
    const session = getSession(ctx);
    session.pendingAttachment = undefined;
    session.pendingDisputeEvidence = undefined;
    await ctx.scene.leave();
    await ctx.replyWithHTML(
      `⭕ <b>Operation cancelled.</b>\n\nReturn to the main menu:`,
      Markup.inlineKeyboard([homeButtonRow()])
    );
  });

  // /home command — main menu
  bot.command('home', async (ctx) => {
    await ctx.replyWithHTML(
      `╔══════════════════════╗\n` +
      `    🏠  <b>MAIN  MENU</b>\n` +
      `╚══════════════════════╝\n\n` +
      `⟫ Choose an option:`,
      homeKeyboard()
    );
  });

  // Inline button for home
  bot.action('cmd:home', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `╔══════════════════════╗\n` +
      `    🏠  <b>MAIN  MENU</b>\n` +
      `╚══════════════════════╝\n\n` +
      `⟫ Choose an option:`,
      homeKeyboard()
    );
  });

  // Inline button for /help shortcut
  bot.action('cmd:help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(helpText(),
      Markup.inlineKeyboard([
        [Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')],
        homeButtonRow(),
      ])
    );
  });

  // Inline button for /profile shortcut
  bot.action('cmd:profile', async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.dbUser) {
      await ctx.reply('Please /start the bot first.');
      return;
    }

    const userId = ctx.dbUser._id;

    const [totalDeals, asBuyer, asSeller, completedDeals, activeDeals] = await Promise.all([
      Deal.countDocuments({ $or: [{ buyer: userId }, { seller: userId }] }),
      Deal.countDocuments({ buyer: userId }),
      Deal.countDocuments({ seller: userId }),
      Deal.countDocuments({
        $or: [{ buyer: userId }, { seller: userId }],
        status: 'completed',
      }),
      Deal.countDocuments({
        $or: [{ buyer: userId }, { seller: userId }],
        status: { $nin: ['cancelled', 'completed', 'resolved'] },
      }),
    ]);

    const rep = ctx.dbUser.reputation;
    const memberSince = ctx.dbUser.createdAt
      ? new Date(ctx.dbUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'Unknown';

    const name = ctx.dbUser.username ? `@${ctx.dbUser.username}` : ctx.dbUser.firstName;

    await ctx.replyWithHTML(
      profileText(name, rep, memberSince, totalDeals, asBuyer, asSeller, completedDeals, activeDeals),
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 My Deals', 'cmd:mydeals')],
        ...websiteButtonRow('🌐 View on Website', '/profile'),
        homeButtonRow(),
      ])
    );
  });

  // Inline button for /login shortcut
  bot.action('cmd:login', async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.from) return;

    const frontendUrl = env.FRONTEND_URL;
    if (!frontendUrl || !frontendUrl.startsWith('https')) {
      await ctx.reply('Website login is not available yet.');
      return;
    }

    const token = createLoginToken(ctx.from.id);
    const loginUrl = `${frontendUrl}/login?token=${token}`;

    await ctx.replyWithHTML(
      loginText(),
      Markup.inlineKeyboard([
        [Markup.button.url('🌐 Log In to Website', loginUrl)],
        homeButtonRow(),
      ])
    );
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
      await ctx.replyWithHTML(
        `╔══════════════════════╗\n` +
        `     📋  <b>MY  DEALS</b>\n` +
        `╚══════════════════════╝\n\n` +
        `No active deals found.\nCreate your first deal below!`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🆕 Create New Deal', 'cmd:newdeal')],
          homeButtonRow(),
        ])
      );
      return;
    }

    let text =
      `╔══════════════════════╗\n` +
      `     📋  <b>MY  DEALS</b>  (${deals.length})\n` +
      `╚══════════════════════╝\n\n`;
    const buttons: any[][] = [];

    deals.forEach((deal, i) => {
      text += formatDealListItem(deal, ctx.from!.id);
      if (i < deals.length - 1) text += `\n\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n`;
      else text += `\n`;
      buttons.push([
        Markup.button.callback(`📄 ${deal.dealId} — ${formatDealStatus(deal.status)}`, `view:${deal.dealId}`),
      ]);
    });

    text += `\n═══════════════════════`;
    buttons.push(homeButtonRow());

    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  });
}
