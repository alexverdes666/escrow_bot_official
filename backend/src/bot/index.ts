import { Telegraf, Scenes, session } from 'telegraf';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { initNotificationService } from '../services/notification.service';
import { BotContext } from './context';
import { setupCommands } from './commands';
import { setupCallbacks } from './callbacks';
import { dealCreationScene } from './scenes/dealCreation.scene';
import { disputeScene } from './scenes/dispute.scene';
import { userMiddleware } from './middleware/auth';

export function createBot(): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

  // Initialize notification service with bot instance
  initNotificationService(bot);

  // Scene setup
  const stage = new Scenes.Stage<BotContext>([dealCreationScene, disputeScene]);

  // Middleware — userMiddleware MUST run before stage so ctx.dbUser is set for scene handlers
  bot.use(session());
  bot.use(userMiddleware);
  bot.use(stage.middleware());

  // Commands
  setupCommands(bot);

  // Callbacks (inline keyboard actions)
  setupCallbacks(bot);

  // Set bot command menu
  bot.telegram.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'home', description: 'Main menu' },
    { command: 'newdeal', description: 'Create a new escrow deal' },
    { command: 'mydeals', description: 'View your active deals' },
    { command: 'profile', description: 'View your profile & stats' },
    { command: 'login', description: 'Get website login link' },
    { command: 'help', description: 'Get help' },
    { command: 'cancel', description: 'Cancel current operation' },
  ]).catch(err => logger.error('Failed to set bot commands:', err));

  // Error handler
  bot.catch((err: unknown, ctx: BotContext) => {
    logger.error(`Bot error for ${ctx.updateType}:`, err);
    ctx.reply('An error occurred. Please try again or use /cancel.').catch(() => {});
  });

  logger.info(`Bot @${env.BOT_USERNAME} initialized`);
  return bot;
}
