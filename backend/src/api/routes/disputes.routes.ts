import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Dispute, Deal } from '../../models';
import { getNotificationService, getTelegramApi } from '../../services/notification.service';
import { logger } from '../../utils/logger';

export const disputeRoutes = Router();

disputeRoutes.use(authMiddleware);

// List user's disputes
disputeRoutes.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get deals where user is participant
    const userDeals = await Deal.find({
      $or: [{ buyer: userId }, { seller: userId }],
    }).select('_id');

    const dealIds = userDeals.map(d => d._id);

    const disputes = await Dispute.find({ deal: { $in: dealIds } })
      .populate('deal', 'dealId terms.description terms.totalAmount')
      .populate('openedBy', 'username firstName')
      .sort('-createdAt')
      .lean();

    res.json(disputes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Get single dispute
disputeRoutes.get('/:disputeId', async (req: AuthRequest, res: Response) => {
  try {
    const dispute = await Dispute.findById(req.params.disputeId)
      .populate('deal')
      .populate('openedBy', 'username firstName')
      .populate('evidence.submittedBy', 'username firstName')
      .populate('messages.author', 'username firstName')
      .populate('resolution.decidedBy', 'username firstName')
      .lean();

    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    res.json(dispute);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

// Add evidence
disputeRoutes.post('/:disputeId/evidence', async (req: AuthRequest, res: Response) => {
  try {
    const { type, content, fileName } = req.body;

    const dispute = await Dispute.findByIdAndUpdate(
      req.params.disputeId,
      {
        $push: {
          evidence: {
            submittedBy: req.user!.userId,
            type,
            content,
            fileName,
          },
        },
      },
      { new: true }
    );

    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    res.json(dispute);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add evidence' });
  }
});

// Add message to dispute thread
disputeRoutes.post('/:disputeId/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body;
    const userId = req.user!.userId;

    // Determine role in the dispute
    const dispute = await Dispute.findById(req.params.disputeId).populate('deal');
    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    const deal = dispute.deal as any;
    let authorRole: 'buyer' | 'seller' | 'admin' = 'admin';
    if (deal.buyer.toString() === userId) authorRole = 'buyer';
    else if (deal.seller.toString() === userId) authorRole = 'seller';

    dispute.messages.push({
      author: userId as any,
      authorRole,
      message,
      createdAt: new Date(),
    });

    await dispute.save();
    res.json(dispute);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Close/withdraw dispute (by either party)
disputeRoutes.post('/:disputeId/close', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const dispute = await Dispute.findById(req.params.disputeId).populate('deal');
    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      res.status(400).json({ error: 'Dispute is already closed' });
      return;
    }

    const deal = dispute.deal as any;
    const isBuyer = deal.buyer.toString() === userId;
    const isSeller = deal.seller.toString() === userId;

    if (!isBuyer && !isSeller) {
      res.status(403).json({ error: 'Only deal participants can close a dispute' });
      return;
    }

    // Close the dispute
    dispute.status = 'closed';
    dispute.resolution = {
      decision: 'custom',
      explanation: `Dispute withdrawn by ${isBuyer ? 'buyer' : 'seller'}`,
      decidedBy: userId as any,
      decidedAt: new Date(),
    };
    await dispute.save();

    // Restore deal to delivered status (before dispute)
    deal.status = 'delivered';
    deal.statusHistory.push({
      status: 'delivered',
      changedBy: userId,
      note: 'Dispute closed by participant',
    });
    await deal.save();

    // Notify both parties
    const notificationService = getNotificationService();
    if (notificationService) {
      const { User } = await import('../../models');
      const buyer = await User.findById(deal.buyer);
      const seller = await User.findById(deal.seller);
      if (buyer && seller) {
        const msg = `✅ <b>Dispute Closed — ${deal.dealId}</b>\n\n` +
          `The dispute has been withdrawn by ${isBuyer ? 'the buyer' : 'the seller'}.\n` +
          `The deal is now back to delivered status.`;
        await Promise.all([
          notificationService.sendToUser(buyer.telegramId, msg),
          notificationService.sendToUser(seller.telegramId, msg),
        ]);
      }
    }

    res.json(dispute);
  } catch (error) {
    res.status(500).json({ error: 'Failed to close dispute' });
  }
});

// Proxy evidence file from Telegram
disputeRoutes.get('/:disputeId/evidence/:evidenceId/file', async (req: AuthRequest, res: Response) => {
  try {
    const dispute = await Dispute.findById(req.params.disputeId).populate('deal');
    if (!dispute) {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    // Auth: deal participant or admin
    const deal = dispute.deal as any;
    const userId = req.user!.userId;
    const isParticipant = deal.buyer.toString() === userId || deal.seller.toString() === userId;
    if (!isParticipant && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const evidence = dispute.evidence.find(
      (e: any) => e._id?.toString() === req.params.evidenceId
    );
    if (!evidence || (evidence.type !== 'image' && evidence.type !== 'document')) {
      res.status(404).json({ error: 'File evidence not found' });
      return;
    }

    const telegram = getTelegramApi();
    if (!telegram) {
      res.status(503).json({ error: 'Bot service unavailable' });
      return;
    }

    // content stores the Telegram file_id for image/document evidence
    const fileLink = await telegram.getFileLink(evidence.content);
    const url = typeof fileLink === 'string' ? fileLink : fileLink.href;

    const fileRes = await globalThis.fetch(url);
    if (!fileRes.ok || !fileRes.body) {
      res.status(502).json({ error: 'Failed to fetch file from Telegram' });
      return;
    }

    if (evidence.mimeType) {
      res.setHeader('Content-Type', evidence.mimeType);
    } else if (evidence.type === 'image') {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    if (evidence.fileName) {
      res.setHeader('Content-Disposition', `inline; filename="${evidence.fileName}"`);
    }
    if (evidence.fileSize) {
      res.setHeader('Content-Length', String(evidence.fileSize));
    }

    res.setHeader('Cache-Control', 'private, max-age=3600');

    const { Readable } = await import('stream');
    Readable.fromWeb(fileRes.body as any).pipe(res);
  } catch (error) {
    logger.error('Evidence file proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy file' });
  }
});
