import { IDeal } from '../../models';

export function formatDealSummary(deal: any): string {
  const terms = deal.terms;
  const payTypeLabels: Record<string, string> = {
    full_prepay: '💰 Full Prepay',
    partial_prepay: '💳 Partial Prepay',
    milestone: '📊 Milestone-Based',
    no_prepay: '🤝 No Prepay',
    custom: '✏️ Custom',
  };

  const buyerName = deal.buyer?.username ? `@${deal.buyer.username}` : deal.buyer?.firstName || 'TBD';
  const sellerName = deal.seller?.username ? `@${deal.seller.username}` : deal.seller?.firstName || 'TBD';

  let text = ``;
  text += `╔══════════════════════╗\n`;
  text += `    📋  <b>DEAL  SUMMARY</b>\n`;
  text += `╚══════════════════════╝\n\n`;

  if (deal.dealId) text += `🔖 <b>ID:</b>  <code>${deal.dealId}</code>\n`;
  if (deal.templateName) text += `📑 <b>Template:</b>  ${deal.templateName}\n`;
  text += `💳 <b>Payment:</b>  ${payTypeLabels[terms.paymentType] || terms.paymentType}\n`;
  text += `\n`;

  text += `┌─── <b>Participants</b> ───┐\n`;
  text += `│  🛒  <b>Buyer:</b>  ${buyerName}\n`;
  text += `│  🏪  <b>Seller:</b>  ${sellerName}\n`;
  text += `└───────────────────┘\n\n`;

  text += `📝 <b>Description</b>\n`;
  text += `<blockquote>${terms.description}</blockquote>\n`;
  text += `💵 <b>Amount:</b>  <b>${terms.totalAmount} ${terms.currency}</b>\n`;

  if (terms.paymentType === 'partial_prepay' && terms.depositPercent) {
    const depositAmt = (terms.totalAmount * terms.depositPercent / 100).toFixed(2);
    text += `💲 <b>Deposit:</b>  ${terms.depositPercent}% (${depositAmt} ${terms.currency})\n`;
  }

  if (terms.milestones && terms.milestones.length > 0) {
    text += `\n┌─── <b>Milestones</b> ───┐\n`;
    terms.milestones.forEach((m: any, i: number) => {
      text += `│  ${i + 1}. ${m.title} — <b>${m.amount} ${terms.currency}</b>\n`;
    });
    text += `└────────────────────┘\n`;
  }

  text += `\n`;
  text += `⏱ <b>Timelines</b>\n`;
  if (terms.deliveryDeadlineDays) text += `  ◈ Delivery: <b>${terms.deliveryDeadlineDays} days</b>\n`;
  text += `  ◈ Auto-release: <b>${terms.autoReleaseDays} days</b> after delivery\n`;
  text += `  ◈ Dispute window: <b>${terms.disputeWindowDays} days</b>\n`;

  if (terms.buyerObligations) {
    text += `\n📌 <b>Buyer obligations</b>\n`;
    text += `<blockquote>${terms.buyerObligations}</blockquote>`;
  }
  if (terms.sellerObligations) {
    text += `\n📌 <b>Seller obligations</b>\n`;
    text += `<blockquote>${terms.sellerObligations}</blockquote>`;
  }

  if (terms.customConditions && terms.customConditions.length > 0) {
    text += `\n📜 <b>Conditions</b>\n`;
    terms.customConditions.forEach((c: string) => {
      text += `  ◇ ${c}\n`;
    });
  }

  text += `\n═══════════════════════`;

  return text;
}

export function formatDealStatus(status: string): string {
  const statusLabels: Record<string, string> = {
    draft: '📝 Draft',
    pending_agreement: '🔸 Pending Agreement',
    active: '🟢 Active',
    awaiting_deposit: '🟡 Awaiting Deposit',
    funded: '💎 Funded',
    payment_confirmed: '💰 Payment Confirmed',
    pending_review: '🔍 Pending Review',
    in_progress: '🔵 In Progress',
    delivered: '📦 Delivered',
    completed: '🟣 Completed',
    disputed: '🔴 Disputed',
    cancelled: '⭕ Cancelled',
    resolved: '🟢 Resolved',
  };
  return statusLabels[status] || status;
}

export function formatDealListItem(deal: any, userTelegramId: number): string {
  const role = deal.buyer?.telegramId === userTelegramId ? 'Buyer' : 'Seller';
  const roleIcon = role === 'Buyer' ? '🛒' : '🏪';
  const counterparty = role === 'Buyer'
    ? (deal.seller?.username ? `@${deal.seller.username}` : deal.seller?.firstName)
    : (deal.buyer?.username ? `@${deal.buyer.username}` : deal.buyer?.firstName);

  const desc = deal.terms.description?.substring(0, 45) || 'No description';

  return `${formatDealStatus(deal.status)}  <b>${deal.dealId}</b>\n` +
    `  ├ <i>${desc}${desc.length >= 45 ? '...' : ''}</i>\n` +
    `  ├ 💵 <b>${deal.terms.totalAmount} ${deal.terms.currency}</b>\n` +
    `  └ ${roleIcon} ${role} ↔ ${counterparty}`;
}
