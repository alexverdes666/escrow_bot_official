import { Router, Response } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Deal, Dispute, User, AuditLog } from '../../models';
import { getNotificationService } from '../../services/notification.service';
import { releaseFunds, refundFunds, splitFunds } from '../../services/cryptoRelease.service';
import { logger } from '../../utils/logger';

export const adminRoutes = Router();

adminRoutes.use(authMiddleware, adminMiddleware);

// Get all deals
adminRoutes.get('/deals', async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20', sort = '-createdAt' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    const filter: Record<string, unknown> = {};
    if (status) filter.status = { $in: (status as string).split(',') };
    if (search) filter.dealId = { $regex: search, $options: 'i' };

    const [deals, total] = await Promise.all([
      Deal.find(filter)
        .populate('buyer', 'username firstName telegramId')
        .populate('seller', 'username firstName telegramId')
        .sort(sort as string)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Deal.countDocuments(filter),
    ]);

    res.json({
      deals,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// Get all disputes
adminRoutes.get('/disputes', async (req: AuthRequest, res: Response) => {
  try {
    const { status = 'open,under_review' } = req.query;
    const statuses = (status as string).split(',');

    const disputes = await Dispute.find({ status: { $in: statuses } })
      .populate('deal', 'dealId terms.description terms.totalAmount buyer seller')
      .populate('openedBy', 'username firstName')
      .sort('createdAt')
      .lean();

    res.json(disputes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Resolve dispute
adminRoutes.post('/disputes/:disputeId/resolve', async (req: AuthRequest, res: Response) => {
  try {
    const { decision, splitPercent, explanation } = req.body;

    const dispute = await Dispute.findById(req.params.disputeId).populate('deal');
    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    dispute.resolution = {
      decidedBy: req.user!.userId as any,
      decision,
      splitPercent: decision === 'split' ? splitPercent : undefined,
      explanation,
      decidedAt: new Date(),
    };
    dispute.status = 'resolved';
    dispute.resolvedAt = new Date();
    await dispute.save();

    // Update deal status
    await Deal.findByIdAndUpdate(dispute.deal, {
      status: 'resolved',
      $push: {
        statusHistory: {
          status: 'resolved',
          changedBy: req.user!.userId,
          note: `Dispute resolved: ${decision}`,
        },
      },
    });

    // Handle crypto release/refund for disputed crypto deals
    const deal = await Deal.findById(dispute.deal);
    if (deal && deal.cryptoPayment && deal.cryptoPayment.status === 'confirmed') {
      try {
        if (decision === 'release_to_seller') {
          await releaseFunds(deal);
        } else if (decision === 'refund_to_buyer') {
          await refundFunds(deal);
        } else if (decision === 'split' && splitPercent) {
          await splitFunds(deal, splitPercent.buyer || 50, splitPercent.seller || 50);
        }
      } catch (err) {
        logger.error(`Crypto release/refund failed for dispute ${dispute._id}:`, err);
        // Don't fail the resolution — admin can retry manually
      }
    }

    // Update reputation for both parties
    const resolvedDeal = deal || await Deal.findById(dispute.deal);
    if (resolvedDeal) {
      const buyerId = resolvedDeal.buyer;
      const sellerId = resolvedDeal.seller;

      // Both get disputesTotal incremented
      await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesTotal': 1 } });
      await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesTotal': 1 } });

      if (decision === 'release_to_seller') {
        // Seller wins, buyer loses
        await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesWon': 1, 'reputation.score': 5 } });
        await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesLost': 1, 'reputation.score': -5 } });
      } else if (decision === 'refund_to_buyer') {
        // Buyer wins, seller loses
        await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesWon': 1, 'reputation.score': 5 } });
        await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesLost': 1, 'reputation.score': -5 } });
      } else if (decision === 'split') {
        // Split — no clear winner, both get disputesWon (compromise)
        await User.findByIdAndUpdate(buyerId, { $inc: { 'reputation.disputesWon': 1 } });
        await User.findByIdAndUpdate(sellerId, { $inc: { 'reputation.disputesWon': 1 } });
      }
    }

    // Log admin action
    await AuditLog.create({
      action: 'dispute_resolved',
      performedBy: req.user!.userId,
      targetDeal: (dispute.deal as any)._id,
      targetDispute: dispute._id,
      details: { decision, explanation },
    });

    // Notify both parties
    const notificationService = getNotificationService();
    if (notificationService) {
      await notificationService.notifyDisputeResolved(dispute);
    }

    res.json(dispute);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// Confirm payment
adminRoutes.patch('/deals/:dealId/confirm-payment', async (req: AuthRequest, res: Response) => {
  try {
    const deal = await Deal.findOne({ dealId: req.params.dealId });
    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    if (deal.status !== 'active') {
      res.status(400).json({ error: 'Deal must be in active status to confirm payment' });
      return;
    }

    deal.status = 'payment_confirmed';
    deal.paymentConfirmed = true;
    deal.paymentConfirmedAt = new Date();
    deal.paymentConfirmedBy = req.user!.userId as any;
    deal.statusHistory.push({
      status: 'payment_confirmed',
      changedBy: req.user!.userId as any,
      changedAt: new Date(),
      note: 'Payment confirmed by admin',
    });
    await deal.save();

    await AuditLog.create({
      action: 'payment_confirmed',
      performedBy: req.user!.userId,
      targetDeal: deal._id,
    });

    // Notify both parties
    const notificationService = getNotificationService();
    if (notificationService) {
      await notificationService.notifyPaymentConfirmed(deal);
    }

    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Get all users
adminRoutes.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort('-createdAt')
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Ban/unban user
adminRoutes.patch('/users/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { isBanned, banReason, role } = req.body;
    const update: Record<string, unknown> = {};

    if (typeof isBanned === 'boolean') {
      update.isBanned = isBanned;
      update.banReason = isBanned ? banReason : null;
    }
    if (role) update.role = role;

    const user = await User.findByIdAndUpdate(req.params.userId, update, { new: true });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await AuditLog.create({
      action: isBanned ? 'user_banned' : (isBanned === false ? 'user_unbanned' : 'admin_action'),
      performedBy: req.user!.userId,
      targetUser: user._id,
      details: update,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Manual crypto release
adminRoutes.post('/deals/:dealId/release-crypto', async (req: AuthRequest, res: Response) => {
  try {
    const deal = await Deal.findOne({ dealId: req.params.dealId });
    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    if (!deal.cryptoPayment) {
      res.status(400).json({ error: 'Deal does not have crypto payment' });
      return;
    }

    if (deal.cryptoPayment.status !== 'confirmed') {
      res.status(400).json({ error: `Cannot release: crypto status is ${deal.cryptoPayment.status}` });
      return;
    }

    const { action = 'release' } = req.body; // release | refund

    if (action === 'refund') {
      await refundFunds(deal);
    } else {
      await releaseFunds(deal);
    }

    await AuditLog.create({
      action: 'admin_action',
      performedBy: req.user!.userId,
      targetDeal: deal._id,
      details: { action: `manual_crypto_${action}`, dealId: deal.dealId },
    });

    res.json({ success: true, deal });
  } catch (error: any) {
    logger.error(`Manual crypto release failed:`, error);
    res.status(500).json({ error: error.message || 'Failed to release crypto' });
  }
});

// Analytics
adminRoutes.get('/analytics', async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalDeals,
      activeDeals,
      completedDeals,
      openDisputes,
      totalUsers,
      dealsByStatus,
    ] = await Promise.all([
      Deal.countDocuments(),
      Deal.countDocuments({ status: { $in: ['active', 'awaiting_deposit', 'funded', 'payment_confirmed', 'in_progress', 'delivered'] } }),
      Deal.countDocuments({ status: 'completed' }),
      Dispute.countDocuments({ status: { $in: ['open', 'under_review'] } }),
      User.countDocuments(),
      Deal.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    res.json({
      totalDeals,
      activeDeals,
      completedDeals,
      openDisputes,
      totalUsers,
      dealsByStatus: Object.fromEntries(dealsByStatus.map(s => [s._id, s.count])),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
