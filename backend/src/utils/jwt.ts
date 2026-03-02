import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface TokenPayload {
  userId: string;
  telegramId: number;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string & jwt.SignOptions['expiresIn'],
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
