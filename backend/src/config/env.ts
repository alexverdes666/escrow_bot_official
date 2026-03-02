import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BACKEND_URL: z.string().url(),
  MONGODB_URI: z.string().min(1),
  BOT_TOKEN: z.string().min(1),
  BOT_USERNAME: z.string().min(1),
  USE_WEBHOOK: z.string().transform(v => v === 'true').default('false'),
  WEBHOOK_DOMAIN: z.string().optional(),
  WEBHOOK_PATH: z.string().default('/api/bot/webhook'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url(),
  ADMIN_TELEGRAM_IDS: z.string().default('').transform(v =>
    v ? v.split(',').map(id => parseInt(id.trim(), 10)).filter(Boolean) : []
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
