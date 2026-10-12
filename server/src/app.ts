import { Prisma } from '@prisma/client';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { HttpError } from './http.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createMessagesRouter } from './routes/messages.routes.js';
import { createPatientRouter } from './routes/patient.routes.js';
import { createTherapistRouter } from './routes/therapist.routes.js';
import type { SummaryModel } from './services/summary/index.js';

export type AppDependencies = {
  /** Overrides the configured summary model (tests inject fakes; null = rule-based only). */
  summaryModel?: SummaryModel | null;
};

export function createApp(deps: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'RehabQuest API' });
  });

  app.use('/auth', createAuthRouter());
  app.use('/patient', createPatientRouter());
  app.use('/therapist', createTherapistRouter({ summaryModel: deps.summaryModel }));
  app.use('/messages', createMessagesRouter());

  app.use((_request, response) => {
    response.status(404).json({ message: 'Route not found', code: 'not_found' });
  });

  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof HttpError) {
      response.status(error.status).json({ message: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
      return;
    }

    // Malformed JSON bodies are a client error, not an authentication failure.
    if (error instanceof SyntaxError && 'status' in error && (error as { status?: number }).status === 400) {
      response.status(400).json({ message: 'Request body must be valid JSON', code: 'invalid_json' });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      response.status(404).json({ message: 'Not found', code: 'not_found' });
      return;
    }

    console.error('[api] unhandled error', error);
    response.status(500).json({ message: 'Something went wrong on our side. Please try again.', code: 'internal_error' });
  });

  return app;
}
