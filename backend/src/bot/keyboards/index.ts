import { Markup } from 'telegraf';
import { IDealTemplate } from '../../models';

export function roleKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🛒 I\'m the Buyer', 'role:buyer'),
      Markup.button.callback('🏪 I\'m the Seller', 'role:seller'),
    ],
    [Markup.button.callback('❌ Cancel', 'wizard:cancel')],
  ]);
}

export function templateKeyboard(templates: IDealTemplate[]) {
  const rows = templates.map(t =>
    [Markup.button.callback(`${t.emoji} ${t.name}`, `template:${t.slug}`)]
  );
  rows.push([Markup.button.callback('❌ Cancel', 'wizard:cancel')]);
  return Markup.inlineKeyboard(rows);
}

export function currencyKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('USD', 'currency:USD'),
      Markup.button.callback('EUR', 'currency:EUR'),
      Markup.button.callback('USDT', 'currency:USDT'),
    ],
    [
      Markup.button.callback('RUB', 'currency:RUB'),
      Markup.button.callback('GBP', 'currency:GBP'),
      Markup.button.callback('Other', 'currency:other'),
    ],
  ]);
}

export function paymentTypeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💰 Full Prepay', 'paytype:full_prepay')],
    [Markup.button.callback('💳 Partial Prepay', 'paytype:partial_prepay')],
    [Markup.button.callback('📊 Milestone-Based', 'paytype:milestone')],
    [Markup.button.callback('🤝 No Prepay', 'paytype:no_prepay')],
    [Markup.button.callback('❌ Cancel', 'wizard:cancel')],
  ]);
}

export function depositKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('25%', 'deposit:25'),
      Markup.button.callback('30%', 'deposit:30'),
      Markup.button.callback('50%', 'deposit:50'),
    ],
    [
      Markup.button.callback('70%', 'deposit:70'),
      Markup.button.callback('Custom %', 'deposit:custom'),
    ],
  ]);
}

export function deadlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('3 days', 'deadline:3'),
      Markup.button.callback('7 days', 'deadline:7'),
    ],
    [
      Markup.button.callback('14 days', 'deadline:14'),
      Markup.button.callback('30 days', 'deadline:30'),
    ],
    [
      Markup.button.callback('Custom', 'deadline:custom'),
      Markup.button.callback('No deadline', 'deadline:none'),
    ],
  ]);
}

export function autoReleaseKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1 day', 'autorelease:1'),
      Markup.button.callback('3 days', 'autorelease:3'),
    ],
    [
      Markup.button.callback('5 days', 'autorelease:5'),
      Markup.button.callback('7 days', 'autorelease:7'),
    ],
  ]);
}

export function disputeWindowKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1 day', 'disputewin:1'),
      Markup.button.callback('3 days', 'disputewin:3'),
    ],
    [
      Markup.button.callback('5 days', 'disputewin:5'),
      Markup.button.callback('7 days', 'disputewin:7'),
    ],
  ]);
}

export function skipKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Skip', 'wizard:skip')],
  ]);
}

export function confirmDealKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm & Send', 'wizard:confirm'),
      Markup.button.callback('✏️ Edit', 'wizard:edit'),
    ],
    [Markup.button.callback('❌ Cancel', 'wizard:cancel')],
  ]);
}

export function milestoneKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('➕ Add Another', 'milestone:add'),
      Markup.button.callback('✅ Done', 'milestone:done'),
    ],
  ]);
}
