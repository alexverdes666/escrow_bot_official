import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Deal } from '../../models';
import { getTelegramApi } from '../../services/notification.service';
import { logger } from '../../utils/logger';

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
      .populate('attachments.uploadedBy', 'username firstName')
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

// Proxy attachment file from Telegram
dealRoutes.get('/:dealId/attachments/:attachmentId/file', async (req: AuthRequest, res: Response) => {
  try {
    const deal = await Deal.findOne({ dealId: req.params.dealId });
    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    // Auth: participant or admin
    const userId = req.user!.userId;
    const isParticipant = deal.buyer.toString() === userId || deal.seller.toString() === userId;
    if (!isParticipant && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const attachment = deal.attachments.find(
      (a: any) => a._id?.toString() === req.params.attachmentId
    );
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const telegram = getTelegramApi();
    if (!telegram) {
      res.status(503).json({ error: 'Bot service unavailable' });
      return;
    }

    const fileLink = await telegram.getFileLink(attachment.fileId);
    const url = typeof fileLink === 'string' ? fileLink : fileLink.href;

    // Fetch from Telegram and stream to response
    const fileRes = await globalThis.fetch(url);
    if (!fileRes.ok || !fileRes.body) {
      res.status(502).json({ error: 'Failed to fetch file from Telegram' });
      return;
    }

    if (attachment.mimeType) {
      res.setHeader('Content-Type', attachment.mimeType);
    } else if (attachment.fileType === 'photo') {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    if (attachment.fileName) {
      res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    }
    if (attachment.fileSize) {
      res.setHeader('Content-Length', String(attachment.fileSize));
    }

    // Cache for 1 hour (Telegram file links are valid for ~1h)
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const { Readable } = await import('stream');
    Readable.fromWeb(fileRes.body as any).pipe(res);
  } catch (error) {
    logger.error('File proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy file' });
  }
});
