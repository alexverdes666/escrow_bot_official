import { Router, Request, Response } from 'express';
import { verifyTelegramAuth } from '../../utils/telegramAuth';
import { signToken } from '../../utils/jwt';
import { User } from '../../models';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { env } from '../../config/env';

export const authRoutes = Router();

// --- One-time login token store (bot-based login) ---
const loginTokens = new Map<string, { telegramId: number; expiresAt: number }>();

export function createLoginToken(telegramId: number): string {
  // Generate random token
  const token = Array.from({ length: 32 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))
  ).join('');

  // 5 minute expiry
  loginTokens.set(token, { telegramId, expiresAt: Date.now() + 5 * 60 * 1000 });

  // Cleanup expired tokens
  for (const [key, val] of loginTokens) {
    if (val.expiresAt < Date.now()) loginTokens.delete(key);
  }

  return token;
}

// Telegram Login Widget authentication
authRoutes.post('/telegram', async (req: Request, res: Response) => {
  try {
    const authData = req.body;

    if (!verifyTelegramAuth(authData)) {
      res.status(401).json({ error: 'Invalid Telegram authentication' });
      return;
    }

    // Upsert user
    const isAdmin = env.ADMIN_TELEGRAM_IDS.includes(authData.id);
    const user = await User.findOneAndUpdate(
      { telegramId: authData.id },
      {
        telegramId: authData.id,
        firstName: authData.first_name,
        lastName: authData.last_name,
        username: authData.username,
        photoUrl: authData.photo_url,
        lastActiveAt: new Date(),
        ...(isAdmin ? { role: 'admin' } : {}),
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

// Bot-based login: exchange one-time token for JWT
authRoutes.post('/bot-login', async (req: Request, res: Response) => {
  try {
    const { token: oneTimeToken } = req.body;

    if (!oneTimeToken) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    const entry = loginTokens.get(oneTimeToken);
    if (!entry || entry.expiresAt < Date.now()) {
      loginTokens.delete(oneTimeToken);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Token is valid — delete it (one-time use)
    loginTokens.delete(oneTimeToken);

    const user = await User.findOne({ telegramId: entry.telegramId });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const jwt = signToken({
      userId: user._id.toString(),
      telegramId: user.telegramId,
      role: user.role,
    });

    res.json({ token: jwt, user });
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
