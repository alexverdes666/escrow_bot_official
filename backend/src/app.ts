import { env } from './config/env';
import { connectDB } from './config/db';
import { logger } from './utils/logger';
import { createExpressApp } from './api';
import { createBot } from './bot';
import { startAutoReleaseJob } from './jobs/autoRelease.job';

async function main() {
  // Connect to MongoDB
  await connectDB();

  // Create Express app
  const app = createExpressApp();

  // Create and launch bot
  const bot = createBot();

  if (env.USE_WEBHOOK) {
    // Webhook mode: Express handles webhook
    const webhookPath = env.WEBHOOK_PATH || '/api/bot/webhook';
    app.use(bot.webhookCallback(webhookPath));

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} (webhook mode)`);
      bot.telegram.setWebhook(`${env.WEBHOOK_DOMAIN}${webhookPath}`);
      logger.info(`Webhook set to ${env.WEBHOOK_DOMAIN}${webhookPath}`);
    });
  } else {
    // Polling mode (development)
    app.listen(env.PORT, () => {
      logger.info(`API server running on port ${env.PORT}`);
    });

    bot.launch();
    logger.info('Bot started in polling mode');
  }

  // Start cron jobs
  startAutoReleaseJob();

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`${signal} received. Shutting down...`);
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
