import { Router, Request, Response } from 'express';
import { DealTemplate } from '../../models';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/authMiddleware';

export const templateRoutes = Router();

// Public: list active templates
templateRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await DealTemplate.find({ isActive: true })
      .sort('sortOrder')
      .lean();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Admin: create template
templateRoutes.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const template = await DealTemplate.create(req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Admin: update template
templateRoutes.patch('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const template = await DealTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Admin: list ALL templates (including inactive)
templateRoutes.get('/all', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const templates = await DealTemplate.find().sort('sortOrder').lean();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Admin: delete (soft) template
templateRoutes.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const template = await DealTemplate.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});
