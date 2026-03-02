import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Deal } from '../../models';

export const dealRoutes = Router();

dealRoutes.use(authMiddleware);

// List user's deals
dealRoutes.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, role, origin, search, page = '1', limit = '20', sort = '-createdAt' } = req.query;
    const userId = req.user!.userId;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    const filter: Record<string, unknown> = {
      $or: [{ buyer: userId }, { seller: userId }],
    };

    if (status) {
      const statuses = (status as string).split(',');
      filter.status = { $in: statuses };
    }

    if (role === 'buyer') {
      delete filter.$or;
      filter.buyer = userId;
    } else if (role === 'seller') {
      delete filter.$or;
      filter.seller = userId;
    }

    if (origin) {
      filter['origin.type'] = origin;
    }

    if (search) {
      filter.dealId = { $regex: search, $options: 'i' };
    }

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
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// Get single deal
dealRoutes.get('/:dealId', async (req: AuthRequest, res: Response) => {
  try {
    const deal = await Deal.findOne({ dealId: req.params.dealId })
      .populate('buyer', 'username firstName telegramId reputation')
      .populate('seller', 'username firstName telegramId reputation')
      .populate('createdBy', 'username firstName')
      .lean();

    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    // Only allow participants and admins
    const userId = req.user!.userId;
    const isParticipant = deal.buyer._id.toString() === userId || deal.seller._id.toString() === userId;
    if (!isParticipant && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});
