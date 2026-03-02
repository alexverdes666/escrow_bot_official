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

  let text = `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 <b>DEAL SUMMARY</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (deal.dealId) text += `<b>Deal ID:</b> ${deal.dealId}\n`;
  if (deal.templateName) text += `<b>Template:</b> ${deal.templateName}\n`;
  text += `<b>Payment:</b> ${payTypeLabels[terms.paymentType] || terms.paymentType}\n\n`;

  const buyerName = deal.buyer?.username ? `@${deal.buyer.username}` : deal.buyer?.firstName || 'TBD';
  const sellerName = deal.seller?.username ? `@${deal.seller.username}` : deal.seller?.firstName || 'TBD';

  text += `<b>Buyer:</b> ${buyerName}\n`;
  text += `<b>Seller:</b> ${sellerName}\n\n`;

  text += `<b>Description:</b> ${terms.description}\n`;
  text += `<b>Amount:</b> ${terms.totalAmount} ${terms.currency}\n`;

  if (terms.paymentType === 'partial_prepay' && terms.depositPercent) {
    const depositAmt = (terms.totalAmount * terms.depositPercent / 100).toFixed(2);
    text += `<b>Deposit:</b> ${terms.depositPercent}% (${depositAmt} ${terms.currency})\n`;
  }

  if (terms.milestones && terms.milestones.length > 0) {
    text += `\n<b>Milestones:</b>\n`;
    terms.milestones.forEach((m: any, i: number) => {
      text += `  ${i + 1}. ${m.title} — ${m.amount} ${terms.currency}\n`;
    });
  }

  text += `\n`;
  if (terms.deliveryDeadlineDays) text += `<b>Delivery:</b> ${terms.deliveryDeadlineDays} days\n`;
  text += `<b>Auto-release:</b> ${terms.autoReleaseDays} days after delivery\n`;
  text += `<b>Dispute window:</b> ${terms.disputeWindowDays} days\n`;

  if (terms.buyerObligations) text += `\n<b>Buyer obligations:</b> ${terms.buyerObligations}\n`;
  if (terms.sellerObligations) text += `\n<b>Seller obligations:</b> ${terms.sellerObligations}\n`;

  if (terms.customConditions && terms.customConditions.length > 0) {
    text += `\n<b>Conditions:</b>\n`;
    terms.customConditions.forEach((c: string) => {
      text += `  • ${c}\n`;
    });
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━`;

  return text;
}

export function formatDealStatus(status: string): string {
  const statusLabels: Record<string, string> = {
    draft: '📝 Draft',
    pending_agreement: '⏳ Pending Agreement',
    active: '✅ Active',
    payment_confirmed: '💰 Payment Confirmed',
    in_progress: '🔄 In Progress',
    delivered: '📦 Delivered',
    completed: '🎉 Completed',
    disputed: '⚖️ Disputed',
    cancelled: '❌ Cancelled',
    resolved: '✅ Resolved',
  };
  return statusLabels[status] || status;
}

export function formatDealListItem(deal: any, userTelegramId: number): string {
  const role = deal.buyer?.telegramId === userTelegramId ? 'Buyer' : 'Seller';
  const counterparty = role === 'Buyer'
    ? (deal.seller?.username ? `@${deal.seller.username}` : deal.seller?.firstName)
    : (deal.buyer?.username ? `@${deal.buyer.username}` : deal.buyer?.firstName);

  return `${formatDealStatus(deal.status)} <b>${deal.dealId}</b>\n` +
    `  ${deal.terms.description?.substring(0, 50)}...\n` +
    `  ${deal.terms.totalAmount} ${deal.terms.currency} | ${role} | with ${counterparty}`;
}
