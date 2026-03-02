import crypto from 'crypto';
import { env } from '../config/env';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const { hash, ...rest } = data;

  // Build data-check-string: key=value pairs sorted alphabetically, joined by \n
  const checkString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${(rest as Record<string, unknown>)[key]}`)
    .join('\n');

  // Secret key = SHA-256 of bot token
  const secretKey = crypto.createHash('sha256').update(env.BOT_TOKEN).digest();

  // HMAC-SHA-256 of data-check-string with secret key
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (hmac !== hash) return false;

  // Check auth_date is not too old (24 hours)
  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > 86400) return false;

  return true;
}
