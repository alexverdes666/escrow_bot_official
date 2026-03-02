import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { DealTemplate } from '../src/models/DealTemplate';

const templates = [
  {
    name: 'Full Prepay',
    slug: 'full_prepay',
    emoji: '💰',
    description: 'Buyer pays 100% upfront. Funds held until delivery is confirmed.',
    sortOrder: 1,
    defaultTerms: {
      paymentType: 'full_prepay',
      autoReleaseDays: 3,
      disputeWindowDays: 3,
      deliveryDeadlineDays: 7,
      buyerObligations: 'Pay the full amount before work begins.',
      sellerObligations: 'Deliver the agreed service/product within the deadline.',
    },
  },
  {
    name: 'Partial Prepay',
    slug: 'partial_prepay',
    emoji: '💳',
    description: 'Buyer pays a deposit upfront, remainder on delivery.',
    sortOrder: 2,
    defaultTerms: {
      paymentType: 'partial_prepay',
      depositPercent: 50,
      autoReleaseDays: 3,
      disputeWindowDays: 3,
      deliveryDeadlineDays: 14,
      buyerObligations: 'Pay deposit before work begins. Pay remainder upon delivery confirmation.',
      sellerObligations: 'Begin work after deposit. Deliver within the deadline.',
    },
  },
  {
    name: 'Milestone-Based',
    slug: 'milestone',
    emoji: '📊',
    description: 'Payment released in stages as milestones are completed.',
    sortOrder: 3,
    defaultTerms: {
      paymentType: 'milestone',
      autoReleaseDays: 3,
      disputeWindowDays: 5,
      deliveryDeadlineDays: 30,
      buyerObligations: 'Confirm milestone completion within the dispute window.',
      sellerObligations: 'Deliver each milestone on time with proof of completion.',
    },
  },
  {
    name: 'No Prepay (Pay on Delivery)',
    slug: 'no_prepay',
    emoji: '🤝',
    description: 'Buyer pays only after delivery is confirmed. No upfront payment.',
    sortOrder: 4,
    defaultTerms: {
      paymentType: 'no_prepay',
      autoReleaseDays: 3,
      disputeWindowDays: 3,
      deliveryDeadlineDays: 7,
      buyerObligations: 'Pay the agreed amount within 24 hours of confirming delivery.',
      sellerObligations: 'Deliver the agreed service/product within the deadline.',
    },
  },
  {
    name: 'Affiliate Traffic Deal',
    slug: 'affiliate_traffic',
    emoji: '📢',
    description: 'For affiliate traffic sales, lead generation, and CPA campaigns.',
    sortOrder: 5,
    defaultTerms: {
      paymentType: 'full_prepay',
      autoReleaseDays: 5,
      disputeWindowDays: 5,
      deliveryDeadlineDays: 14,
      buyerObligations: 'Pay upfront. Provide tracking links and campaign requirements.',
      sellerObligations: 'Deliver agreed traffic volume/leads within deadline. Provide tracking proof.',
      customConditions: [
        'Traffic must meet agreed quality standards.',
        'Seller must provide real-time tracking access.',
        'Fraudulent or bot traffic is grounds for full refund.',
      ],
    },
  },
  {
    name: 'Freelance Service',
    slug: 'freelance',
    emoji: '💻',
    description: 'For freelance work: design, development, writing, marketing, etc.',
    sortOrder: 6,
    defaultTerms: {
      paymentType: 'partial_prepay',
      depositPercent: 30,
      autoReleaseDays: 3,
      disputeWindowDays: 5,
      deliveryDeadlineDays: 14,
      buyerObligations: 'Provide clear project requirements. Pay deposit before work begins.',
      sellerObligations: 'Deliver work matching the agreed specifications within deadline.',
      customConditions: [
        'Up to 2 revision rounds included.',
        'Major scope changes require new agreement.',
      ],
    },
  },
  {
    name: 'Custom Deal',
    slug: 'custom',
    emoji: '✏️',
    description: 'Create a deal with fully custom terms. Define everything yourself.',
    sortOrder: 7,
    defaultTerms: {
      paymentType: 'custom',
      autoReleaseDays: 3,
      disputeWindowDays: 3,
    },
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    for (const tpl of templates) {
      await DealTemplate.findOneAndUpdate(
        { slug: tpl.slug },
        tpl,
        { upsert: true, new: true }
      );
      console.log(`  Seeded template: ${tpl.name}`);
    }

    console.log('All templates seeded successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
