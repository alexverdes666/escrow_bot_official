import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
}
