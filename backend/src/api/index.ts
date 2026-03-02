import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../config/env';
import { authRoutes } from './routes/auth.routes';
import { dealRoutes } from './routes/deals.routes';
import { disputeRoutes } from './routes/disputes.routes';
import { adminRoutes } from './routes/admin.routes';
import { templateRoutes } from './routes/templates.routes';
import { userRoutes } from './routes/users.routes';
import { errorMiddleware } from './middleware/errorMiddleware';

export function createExpressApp() {
  const app = express();

  // Global middleware
  app.use(helmet());
  app.use(cors({
    origin: [env.FRONTEND_URL, 'http://localhost:3001'],
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/deals', dealRoutes);
  app.use('/api/disputes', disputeRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/users', userRoutes);

  // Error handler
  app.use(errorMiddleware);

  return app;
}
