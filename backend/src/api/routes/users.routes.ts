import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { User, Deal } from '../../models';

export const userRoutes = Router();

userRoutes.use(authMiddleware);

// Get own profile
userRoutes.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).lean();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get deal stats
    const [totalDeals, asbuyer, asSeller] = await Promise.all([
      Deal.countDocuments({ $or: [{ buyer: user._id }, { seller: user._id }] }),
      Deal.countDocuments({ buyer: user._id }),
      Deal.countDocuments({ seller: user._id }),
    ]);

    res.json({ ...user, stats: { totalDeals, asbuyer, asSeller } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get public user profile
userRoutes.get('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username firstName photoUrl reputation createdAt')
      .lean();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});
