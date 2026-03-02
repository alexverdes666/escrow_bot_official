import cron from 'node-cron';
import { Deal, User } from '../models';
import { getNotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

export function startAutoReleaseJob() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();

      // Find delivered deals past auto-release date
      const deals = await Deal.find({
        status: 'delivered',
        'terms.autoReleaseDate': { $lte: now },
      }).populate('buyer seller');

      for (const deal of deals) {
        deal.status = 'completed';
        deal.completedAt = now;
        deal.statusHistory.push({
          status: 'completed',
          changedAt: now,
          note: 'Auto-released after dispute window expired',
        });
        await deal.save();

        // Update reputation
        await User.findByIdAndUpdate(deal.buyer, {
          $inc: { 'reputation.completedDeals': 1, 'reputation.score': 5 },
        });
        await User.findByIdAndUpdate(deal.seller, {
          $inc: { 'reputation.completedDeals': 1, 'reputation.score': 5 },
        });

        // Notify
        const notificationService = getNotificationService();
        if (notificationService) {
          await notificationService.notifyDealCompleted(deal);
        }

        logger.info(`Auto-released deal ${deal.dealId}`);
      }

      if (deals.length > 0) {
        logger.info(`Auto-release job: ${deals.length} deals completed`);
      }
    } catch (error) {
      logger.error('Auto-release job error:', error);
    }
  });

  logger.info('Auto-release cron job started (runs every hour)');
}
