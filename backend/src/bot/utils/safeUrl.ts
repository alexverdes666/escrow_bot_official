import { Markup } from 'telegraf';

const FRONTEND_URL = process.env.FRONTEND_URL || '';
const isHttps = FRONTEND_URL.startsWith('https');

/**
 * Returns a URL button row for Telegram inline keyboards, but only if the URL is HTTPS.
 * Telegram rejects http:// URLs in inline keyboard buttons.
 */
export function websiteButtonRow(label: string, path: string = ''): ReturnType<typeof Markup.button.url>[][] {
  if (!isHttps) return [];
  return [[Markup.button.url(label, `${FRONTEND_URL}${path}`)]];
}

/**
 * Returns a raw inline keyboard button object for HTTPS URLs, or empty array.
 * Used in raw reply_markup objects (not Markup builder).
 */
export function websiteButton(label: string, path: string = ''): Array<{ text: string; url: string }> {
  if (!isHttps) return [];
  return [{ text: label, url: `${FRONTEND_URL}${path}` }];
}
