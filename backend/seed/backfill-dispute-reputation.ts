/**
 * One-time migration: backfill reputation for already-resolved disputes.
 *
 * Usage:  npx ts-node seed/backfill-dispute-reputation.ts
 *
 * Safe to run multiple times — it resets dispute-related reputation first,
 * then recalculates from all resolved disputes.
 */
import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import { Dispute } from '../src/models/Dispute';
import { Deal } from '../src/models/Deal';
import { User } from '../src/models/User';

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Reset all dispute-related reputation fields to 0
  await User.updateMany({}, {
    $set: {
      'reputation.disputesWon': 0,
      'reputation.disputesLost': 0,
      'reputation.disputesTotal': 0,
    },
  });
  console.log('Reset all dispute reputation fields');

  // Find all resolved disputes
  const disputes = await Dispute.find({ status: 'resolved' }).lean();
  console.log(`Found ${disputes.length} resolved dispute(s)`);

  for (const dispute of disputes) {
    const deal = await Deal.findById(dispute.deal).lean();
    if (!deal) {
      console.log(`  Skipping dispute ${dispute._id} — deal not found`);
      continue;
    }

    const decision = dispute.resolution?.decision;
    if (!decision) {
      console.log(`  Skipping dispute ${dispute._id} — no decision`);
      continue;
    }

    const buyerId = deal.buyer;
    const sellerId = deal.seller;

    // Both get disputesTotal +1
    await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesTotal': 1 } });
    await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesTotal': 1 } });

    if (decision === 'release_to_seller') {
      await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesWon': 1, 'reputation.score': 5 } });
      await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesLost': 1, 'reputation.score': -5 } });
      console.log(`  Dispute ${dispute._id} (${deal.dealId}): seller wins`);
    } else if (decision === 'refund_to_buyer') {
      await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesWon': 1, 'reputation.score': 5 } });
      await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesLost': 1, 'reputation.score': -5 } });
      console.log(`  Dispute ${dispute._id} (${deal.dealId}): buyer wins`);
    } else if (decision === 'split') {
      await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesWon': 1 } });
      await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesWon': 1 } });
      console.log(`  Dispute ${dispute._id} (${deal.dealId}): split`);
    } else {
      console.log(`  Dispute ${dispute._id} (${deal.dealId}): custom decision "${decision}", no rep change`);
    }
  }

  console.log('Done!');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
