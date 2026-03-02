import { Router, Request, Response } from 'express';
import { verifyTelegramAuth } from '../../utils/telegramAuth';
import { signToken } from '../../utils/jwt';
import { User } from '../../models';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

export const authRoutes = Router();

// Telegram Login Widget authentication
authRoutes.post('/telegram', async (req: Request, res: Response) => {
  try {
    const authData = req.body;

    if (!verifyTelegramAuth(authData)) {
      res.status(401).json({ error: 'Invalid Telegram authentication' });
      return;
    }

    // Upsert user
    const user = await User.findOneAndUpdate(
      { telegramId: authData.id },
      {
        telegramId: authData.id,
        firstName: authData.first_name,
        lastName: authData.last_name,
        username: authData.username,
        photoUrl: authData.photo_url,
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const token = signToken({
      userId: user._id.toString(),
      telegramId: user.telegramId,
      role: user.role,
    });

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
authRoutes.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});
