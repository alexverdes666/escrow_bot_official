import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export function generateDealId(): string {
  return `ESC-${nanoid()}`;
}
