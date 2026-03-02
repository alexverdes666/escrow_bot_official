import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Dispute, Deal } from '../../models';

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
