import { Scenes, Markup } from 'telegraf';
import { BotContext, DealCreationState, getSession } from '../context';
import { DealTemplate, User, Deal } from '../../models';
import { generateDealId } from '../../utils/dealId';
import { getNotificationService } from '../../services/notification.service';
import { formatDealSummary } from '../utils/formatDeal';
import {
  roleKeyboard, templateKeyboard, currencyKeyboard, paymentTypeKeyboard,
  depositKeyboard, deadlineKeyboard, autoReleaseKeyboard, disputeWindowKeyboard,
  skipKeyboard, confirmDealKeyboard, milestoneKeyboard,
} from '../keyboards';

export const dealCreationScene = new Scenes.WizardScene<BotContext>(
  'deal-creation',

  // Step 0: Role selection
  async (ctx) => {
    const state = getDealState(ctx);

    // If counterparty is pre-set (from group deep link), skip role selection
    if (state.counterpartyTelegramId) {
      await ctx.replyWithHTML(
        '🤝 <b>New Deal</b>\n\nAre you the buyer or seller in this deal?',
        roleKeyboard()
      );
    } else {
      await ctx.replyWithHTML(
        '🤝 <b>Create New Deal</b>\n\nFirst, are you the <b>buyer</b> or <b>seller</b>?',
        roleKeyboard()
      );
    }
    return ctx.wizard.next();
  },

  // Step 1: Handle role + ask for counterparty
  async (ctx) => {
    // This step handles text input for counterparty username
    const state = getDealState(ctx);

    if (ctx.message && 'text' in ctx.message) {
      const username = ctx.message.text.replace('@', '').trim();

      if (!username) {
        await ctx.reply('Please enter a valid @username:');
        return;
      }

      const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });

      if (!user) {
        await ctx.reply(
          `User @${username} hasn't used this bot yet. They need to /start the bot first.\n\n` +
          `Enter another @username or /cancel:`
        );
        return;
      }

      if (user.telegramId === ctx.from!.id) {
        await ctx.reply('You cannot create a deal with yourself. Enter another @username:');
        return;
      }

      state.counterpartyUsername = user.username;
      state.counterpartyTelegramId = user.telegramId;
      state.counterpartyDbId = user._id.toString();

      // Move to template selection
      const templates = await DealTemplate.find({ isActive: true }).sort('sortOrder');
      await ctx.replyWithHTML(
        '📋 <b>Choose a deal template:</b>\n\nSelect a preset or create custom terms.',
        templateKeyboard(templates)
      );
      return ctx.wizard.next();
    }
  },

  // Step 2: Handle template selection + ask description
  async (ctx) => {
    // Handle description text input
    const state = getDealState(ctx);

    if (ctx.message && 'text' in ctx.message) {
      const description = ctx.message.text.trim();

      if (description.length < 5) {
        await ctx.reply('Description must be at least 5 characters. Please try again:');
        return;
      }

      state.terms.description = description;

      // Ask for amount
      await ctx.replyWithHTML(
        '💵 <b>Enter the total deal amount:</b>\n\n' +
        'Just type the number (e.g., <code>500</code>)\n' +
        'Then select the currency.'
      );
      return ctx.wizard.next();
    }
  },

  // Step 3: Handle amount + ask currency
  async (ctx) => {
    const state = getDealState(ctx);

    if (ctx.message && 'text' in ctx.message) {
      const amount = parseFloat(ctx.message.text.replace(/[,$]/g, '').trim());

      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('Please enter a valid amount greater than 0:');
        return;
      }

      state.terms.totalAmount = amount;

      await ctx.replyWithHTML(
        '💱 <b>Select currency:</b>',
        currencyKeyboard()
      );
      return ctx.wizard.next();
    }
  },

  // Step 4: Handle currency + payment type (if not set by template)
  async (ctx) => {
    const state = getDealState(ctx);

    if (ctx.message && 'text' in ctx.message) {
      // Custom currency input
      state.terms.currency = ctx.message.text.trim().toUpperCase();
      return await askPaymentTypeOrSkip(ctx, state);
    }
  },

  // Step 5: Handle payment type specifics (deposit/milestones)
  async (ctx) => {
    const state = getDealState(ctx);

    if (ctx.message && 'text' in ctx.message) {
      const input = ctx.message.text.trim();

      if (state.awaitingInput === 'deposit') {
        const pct = parseInt(input, 10);
        if (isNaN(pct) || pct < 1 || pct > 99) {
          await ctx.reply('Enter a valid percentage between 1 and 99:');
          return;
        }
        state.terms.depositPercent = pct;
        state.awaitingInput = undefined;
        return await askDeadline(ctx);
      }

      if (state.awaitingInput === 'milestone') {
        // Parse "Title - Amount" format
        const match = input.match(/^(.+?)[\s]*[-–—][\s]*(\d+\.?\d*)$/);
        if (!match) {
          await ctx.reply('Format: <code>Title - Amount</code>\nExample: <code>Phase 1 - 200</code>', { parse_mode: 'HTML' });
          return;
        }

        if (!state.terms.milestones) state.terms.milestones = [];
        state.terms.milestones.push({
          title: match[1].trim(),
          amount: parseFloat(match[2]),
        });

        const total = state.terms.milestones.reduce((s, m) => s + m.amount, 0);
        const remaining = (state.terms.totalAmount || 0) - total;

        let text = `✅ Milestone added!\n\nCurrent milestones:\n`;
        state.terms.milestones.forEach((m, i) => {
          text += `  ${i + 1}. ${m.title} — ${m.amount}\n`;
        });
        text += `\nTotal: ${total} / ${state.terms.totalAmount} ${state.terms.currency}`;

        if (remaining > 0) {
          text += `\nRemaining: ${remaining}`;
          await ctx.replyWithHTML(text, milestoneKeyboard());
        } else {
          state.awaitingInput = undefined;
          await ctx.replyWithHTML(text + '\n\n✅ All milestones covered!');
          return await askDeadline(ctx);
        }
        return;
      }

      if (state.awaitingInput === 'deadline') {
        const days = parseInt(input, 10);
        if (isNaN(days) || days < 1) {
          await ctx.reply('Enter a valid number of days:');
          return;
        }
        state.terms.deliveryDeadlineDays = days;
        state.awaitingInput = undefined;
        return await askAutoRelease(ctx);
      }
    }
  },

  // Step 6: Obligations and conditions
  async (ctx) => {
    const state = getDealState(ctx);

    if (ctx.message && 'text' in ctx.message) {
      const text = ctx.message.text.trim();

      if (state.awaitingInput === 'buyer_obligations') {
        state.terms.buyerObligations = text;
        state.awaitingInput = 'seller_obligations';
        await ctx.replyWithHTML(
          '📝 <b>Seller obligations</b> (what must the seller do?):\n\nType or skip:',
          skipKeyboard()
        );
        return;
      }

      if (state.awaitingInput === 'seller_obligations') {
        state.terms.sellerObligations = text;
        state.awaitingInput = 'custom_conditions';
        await ctx.replyWithHTML(
          '📝 <b>Custom conditions</b> (one per message, or skip):\n\nType a condition or skip:',
          skipKeyboard()
        );
        return;
      }

      if (state.awaitingInput === 'custom_conditions') {
        if (!state.terms.customConditions) state.terms.customConditions = [];
        state.terms.customConditions.push(text);
        await ctx.replyWithHTML(
          `✅ Condition added (${state.terms.customConditions.length} total).\n\nAdd another or finish:`,
          Markup.inlineKeyboard([
            [Markup.button.callback('➕ Add Another', 'conditions:add')],
            [Markup.button.callback('✅ Done', 'conditions:done')],
          ])
        );
        return;
      }
    }
  },

  // Step 7: Review and confirm
  async (ctx) => {
    // This step shows the deal summary - handled by showReview function
  }
);

// --- Callback handlers for the wizard ---

// Role selection
dealCreationScene.action(/^role:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const role = ctx.match[1] as 'buyer' | 'seller';
  const state = getDealState(ctx);
  state.role = role;

  if (state.counterpartyTelegramId) {
    // Counterparty pre-set from group deep link
    const user = await User.findOne({ telegramId: state.counterpartyTelegramId });
    if (user) {
      state.counterpartyUsername = user.username;
      state.counterpartyDbId = user._id.toString();

      const templates = await DealTemplate.find({ isActive: true }).sort('sortOrder');
      await ctx.editMessageText(
        `📋 <b>Choose a deal template:</b>\n\nSelect a preset or create custom terms.`,
        { parse_mode: 'HTML', ...templateKeyboard(templates) }
      );
      ctx.wizard.selectStep(2);
      return;
    }
  }

  const counterLabel = role === 'buyer' ? 'seller' : 'buyer';
  await ctx.editMessageText(
    `You are the <b>${role}</b>.\n\nEnter the @username of the <b>${counterLabel}</b>:`,
    { parse_mode: 'HTML' }
  );
});

// Template selection
dealCreationScene.action(/^template:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const slug = ctx.match[1];
  const state = getDealState(ctx);

  const template = await DealTemplate.findOne({ slug });
  if (template) {
    state.templateSlug = template.slug;
    state.templateName = template.name;

    // Pre-fill defaults from template
    if (template.defaultTerms.paymentType) state.terms.paymentType = template.defaultTerms.paymentType;
    if (template.defaultTerms.depositPercent) state.terms.depositPercent = template.defaultTerms.depositPercent;
    if (template.defaultTerms.autoReleaseDays) state.terms.autoReleaseDays = template.defaultTerms.autoReleaseDays;
    if (template.defaultTerms.disputeWindowDays) state.terms.disputeWindowDays = template.defaultTerms.disputeWindowDays;
    if (template.defaultTerms.deliveryDeadlineDays) state.terms.deliveryDeadlineDays = template.defaultTerms.deliveryDeadlineDays;
    if (template.defaultTerms.buyerObligations) state.terms.buyerObligations = template.defaultTerms.buyerObligations;
    if (template.defaultTerms.sellerObligations) state.terms.sellerObligations = template.defaultTerms.sellerObligations;
    if (template.defaultTerms.customConditions) state.terms.customConditions = template.defaultTerms.customConditions;
  }

  await ctx.editMessageText(
    `✅ Template: <b>${template?.name || slug}</b>\n\n` +
    `📝 <b>Describe what is being sold/bought:</b>`,
    { parse_mode: 'HTML' }
  );
  ctx.wizard.selectStep(2);
});

// Currency selection
dealCreationScene.action(/^currency:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const currency = ctx.match[1];
  const state = getDealState(ctx);

  if (currency === 'other') {
    await ctx.editMessageText('Type the currency code (e.g., BTC, AED):');
    return;
  }

  state.terms.currency = currency;
  await askPaymentTypeOrSkip(ctx, state);
});

// Payment type selection
dealCreationScene.action(/^paytype:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const payType = ctx.match[1];
  const state = getDealState(ctx);
  state.terms.paymentType = payType;

  if (payType === 'partial_prepay') {
    await ctx.editMessageText(
      '💳 <b>Enter deposit percentage:</b>',
      { parse_mode: 'HTML', ...depositKeyboard() }
    );
    ctx.wizard.selectStep(5);
  } else if (payType === 'milestone') {
    state.terms.milestones = [];
    state.awaitingInput = 'milestone';
    await ctx.editMessageText(
      `📊 <b>Add milestones</b>\n\nTotal amount: ${state.terms.totalAmount} ${state.terms.currency}\n\n` +
      `Enter milestone in format:\n<code>Title - Amount</code>\n\nExample: <code>Phase 1 - 200</code>`,
      { parse_mode: 'HTML' }
    );
    ctx.wizard.selectStep(5);
  } else {
    await askDeadline(ctx);
  }
});

// Deposit selection
dealCreationScene.action(/^deposit:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const value = ctx.match[1];
  const state = getDealState(ctx);

  if (value === 'custom') {
    state.awaitingInput = 'deposit';
    await ctx.editMessageText('Enter custom deposit percentage (1-99):');
    ctx.wizard.selectStep(5);
    return;
  }

  state.terms.depositPercent = parseInt(value, 10);
  await askDeadline(ctx);
});

// Milestone actions
dealCreationScene.action('milestone:add', async (ctx) => {
  await ctx.answerCbQuery();
  const state = getDealState(ctx);
  state.awaitingInput = 'milestone';
  await ctx.reply('Enter next milestone:\n<code>Title - Amount</code>', { parse_mode: 'HTML' });
});

dealCreationScene.action('milestone:done', async (ctx) => {
  await ctx.answerCbQuery();
  const state = getDealState(ctx);
  state.awaitingInput = undefined;
  await askDeadline(ctx);
});

// Deadline selection
dealCreationScene.action(/^deadline:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const value = ctx.match[1];
  const state = getDealState(ctx);

  if (value === 'custom') {
    state.awaitingInput = 'deadline';
    await ctx.editMessageText('Enter delivery deadline in days:');
    ctx.wizard.selectStep(5);
    return;
  }

  if (value !== 'none') {
    state.terms.deliveryDeadlineDays = parseInt(value, 10);
  }

  await askAutoRelease(ctx);
});

// Auto-release selection
dealCreationScene.action(/^autorelease:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = getDealState(ctx);
  state.terms.autoReleaseDays = parseInt(ctx.match[1], 10);

  await ctx.editMessageText(
    '⏱ <b>Dispute window</b> (days to open dispute after delivery):',
    { parse_mode: 'HTML', ...disputeWindowKeyboard() }
  );
});

// Dispute window selection
dealCreationScene.action(/^disputewin:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = getDealState(ctx);
  state.terms.disputeWindowDays = parseInt(ctx.match[1], 10);

  // Ask for obligations
  state.awaitingInput = 'buyer_obligations';
  ctx.wizard.selectStep(6);
  await ctx.editMessageText(
    '📝 <b>Buyer obligations</b> (what must the buyer do?):\n\nType or skip:',
    { parse_mode: 'HTML', ...skipKeyboard() }
  );
});

// Skip handler
dealCreationScene.action('wizard:skip', async (ctx) => {
  await ctx.answerCbQuery();
  const state = getDealState(ctx);

  if (state.awaitingInput === 'buyer_obligations') {
    state.awaitingInput = 'seller_obligations';
    await ctx.editMessageText(
      '📝 <b>Seller obligations</b> (what must the seller do?):\n\nType or skip:',
      { parse_mode: 'HTML', ...skipKeyboard() }
    );
  } else if (state.awaitingInput === 'seller_obligations') {
    state.awaitingInput = 'custom_conditions';
    await ctx.editMessageText(
      '📝 <b>Custom conditions</b> (one per message, or skip):',
      { parse_mode: 'HTML', ...skipKeyboard() }
    );
  } else if (state.awaitingInput === 'custom_conditions') {
    state.awaitingInput = undefined;
    await showReview(ctx, state);
  }
});

// Conditions done
dealCreationScene.action('conditions:done', async (ctx) => {
  await ctx.answerCbQuery();
  const state = getDealState(ctx);
  state.awaitingInput = undefined;
  await showReview(ctx, state);
});

dealCreationScene.action('conditions:add', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Type the next condition:');
});

// Confirm deal
dealCreationScene.action('wizard:confirm', async (ctx) => {
  await ctx.answerCbQuery('Creating deal...');
  const state = getDealState(ctx);

  try {
    const creator = ctx.dbUser!;
    const counterparty = await User.findOne({ telegramId: state.counterpartyTelegramId });

    if (!counterparty) {
      await ctx.reply('Error: counterparty not found. Please try again.');
      return ctx.scene.leave();
    }

    const isBuyer = state.role === 'buyer';
    const buyer = isBuyer ? creator : counterparty;
    const seller = isBuyer ? counterparty : creator;

    const dealId = generateDealId();

    const deal = await Deal.create({
      dealId,
      buyer: buyer._id,
      seller: seller._id,
      createdBy: creator._id,
      status: 'pending_agreement',
      templateName: state.templateName || null,
      terms: {
        description: state.terms.description,
        paymentType: state.terms.paymentType || 'custom',
        totalAmount: state.terms.totalAmount,
        currency: state.terms.currency || 'USD',
        depositPercent: state.terms.depositPercent,
        depositAmount: state.terms.depositPercent
          ? (state.terms.totalAmount! * state.terms.depositPercent / 100)
          : undefined,
        milestones: state.terms.milestones,
        deliveryDeadlineDays: state.terms.deliveryDeadlineDays,
        autoReleaseDays: state.terms.autoReleaseDays || 3,
        disputeWindowDays: state.terms.disputeWindowDays || 3,
        buyerObligations: state.terms.buyerObligations,
        sellerObligations: state.terms.sellerObligations,
        customConditions: state.terms.customConditions,
      },
      origin: {
        type: state.originType,
        chatId: state.originChatId,
        chatTitle: state.originChatTitle,
      },
      [`${isBuyer ? 'buyer' : 'seller'}Agreed`]: true,
      [`${isBuyer ? 'buyer' : 'seller'}AgreedAt`]: new Date(),
      statusHistory: [{
        status: 'pending_agreement',
        changedBy: creator._id,
        note: 'Deal created',
      }],
    });

    // Populate for notification
    const populatedDeal = await Deal.findById(deal._id)
      .populate('buyer', 'username firstName telegramId')
      .populate('seller', 'username firstName telegramId');

    await ctx.editMessageText(
      `✅ <b>Deal Created!</b>\n\n` +
      `Deal ID: <b>${dealId}</b>\n` +
      `Sent to @${counterparty.username || counterparty.firstName} for approval.\n\n` +
      `You'll be notified when they respond.`,
      { parse_mode: 'HTML' }
    );

    // Notify counterparty
    const notificationService = getNotificationService();
    if (notificationService && populatedDeal) {
      await notificationService.notifyDealCreated(populatedDeal);
    }
  } catch (error) {
    await ctx.reply('Failed to create deal. Please try again with /newdeal.');
  }

  return ctx.scene.leave();
});

// Cancel wizard
dealCreationScene.action('wizard:cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.editMessageText('❌ Deal creation cancelled.');
  return ctx.scene.leave();
});

// Edit (go back to beginning)
dealCreationScene.action('wizard:edit', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.wizard.selectStep(0);
  await ctx.reply('Let\'s start over. Are you the buyer or seller?', roleKeyboard());
});

// --- Helper functions ---

function getDealState(ctx: BotContext): DealCreationState {
  if (!getSession(ctx).dealCreation) {
    getSession(ctx).dealCreation = {
      terms: {},
      originType: 'private',
      currentStep: 0,
    };
  }
  return getSession(ctx).dealCreation!;
}

async function askPaymentTypeOrSkip(ctx: BotContext, state: DealCreationState) {
  if (state.terms.paymentType && state.terms.paymentType !== 'custom') {
    // Template already set payment type, skip to next relevant step
    if (state.terms.paymentType === 'partial_prepay' && !state.terms.depositPercent) {
      await ctx.reply('💳 <b>Enter deposit percentage:</b>', { parse_mode: 'HTML', ...depositKeyboard() });
      ctx.wizard.selectStep(5);
    } else {
      await askDeadline(ctx);
    }
  } else {
    await ctx.reply(
      '💳 <b>Choose payment structure:</b>',
      { parse_mode: 'HTML', ...paymentTypeKeyboard() }
    );
    ctx.wizard.selectStep(4);
  }
}

async function askDeadline(ctx: BotContext) {
  const state = getDealState(ctx);
  if (state.terms.deliveryDeadlineDays) {
    // Template already set deadline
    await askAutoRelease(ctx);
    return;
  }

  await ctx.reply(
    '⏰ <b>Set delivery deadline:</b>',
    { parse_mode: 'HTML', ...deadlineKeyboard() }
  );
}

async function askAutoRelease(ctx: BotContext) {
  const state = getDealState(ctx);
  if (state.terms.autoReleaseDays && state.terms.disputeWindowDays) {
    // Both already set by template
    state.awaitingInput = 'buyer_obligations';
    ctx.wizard.selectStep(6);
    if (!state.terms.buyerObligations) {
      await ctx.reply(
        '📝 <b>Buyer obligations</b> (what must the buyer do?):\n\nType or skip:',
        { parse_mode: 'HTML', ...skipKeyboard() }
      );
    } else {
      await showReview(ctx, state);
    }
    return;
  }

  await ctx.reply(
    '⏱ <b>Auto-release timer</b> (days after delivery, funds auto-release if no dispute):',
    { parse_mode: 'HTML', ...autoReleaseKeyboard() }
  );
}

async function showReview(ctx: BotContext, state: DealCreationState) {
  const counterparty = await User.findOne({ telegramId: state.counterpartyTelegramId });
  const creator = ctx.dbUser;

  const isBuyer = state.role === 'buyer';
  const buyerInfo = isBuyer ? creator : counterparty;
  const sellerInfo = isBuyer ? counterparty : creator;

  const dealData = {
    templateName: state.templateName,
    terms: state.terms,
    buyer: buyerInfo,
    seller: sellerInfo,
  };

  const summary = formatDealSummary(dealData);

  await ctx.replyWithHTML(summary, confirmDealKeyboard());
  ctx.wizard.selectStep(7);
}
