import { User } from '../../models';
import { BotContext } from '../context';
import { env } from '../../config/env';

export async function userMiddleware(ctx: BotContext, next: () => Promise<void>) {
  if (!ctx.from) return next();

  try {
    const isAdmin = env.ADMIN_TELEGRAM_IDS.includes(ctx.from.id);

    // Upsert user on every interaction
    const user = await User.findOneAndUpdate(
      { telegramId: ctx.from.id },
      {
        telegramId: ctx.from.id,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
        lastActiveAt: new Date(),
        ...(isAdmin ? { role: 'admin' } : {}),
      },
      { upsert: true, new: true }
    );

    ctx.dbUser = user;

    // Block banned users
    if (user.isBanned) {
      await ctx.reply('⛔ Your account has been banned. Contact support for more info.');
      return;
    }
  } catch {
    // Continue even if DB fails
  }

  return next();
}
