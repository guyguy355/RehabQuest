import { Prisma } from '@prisma/client';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { HttpError } from './http.js';
import { createAuthoringRouter } from './routes/authoring.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createPatientCareRouter, createPreferencesRouter, createTherapistCareRouter } from './routes/care.routes.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { createMessagesRouter } from './routes/messages.routes.js';
import { createNotificationsRouter } from './routes/notifications.routes.js';
import { createReviewsRouter } from './routes/reviews.routes.js';
import { createPatientRouter } from './routes/patient.routes.js';
import { createTherapistRouter } from './routes/therapist.routes.js';
import type { SummaryModel } from './services/summary/index.js';

export type AppDependencies = {
  /** Overrides the configured summary model (tests inject fakes; null = rule-based only). */
  summaryModel?: SummaryModel | null;
  /**
   * Directory with the built web app. When set, the app is served from "/" and the API
   * lives under "/api" (same origin, no CORS). Defaults to CLIENT_DIST_DIR.
   */
  clientDistDir?: string | null;
};

/** Browser hardening. The CSP only matters when the API serves the web app itself. */
function securityHeaders(servesClient: boolean) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  return (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (config.isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (servesClient) response.setHeader('Content-Security-Policy', csp);
    next();
  };
}

function createApiRouter(deps: AppDependencies) {
  const api = express.Router();

  api.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'RehabQuest API' });
  });

  api.use('/auth', createAuthRouter());
  api.use('/patient', createPatientRouter());
  api.use('/therapist', createAuthoringRouter());
  api.use('/therapist', createTherapistRouter({ summaryModel: deps.summaryModel }));
  api.use('/therapist', createReviewsRouter());
  api.use('/therapist', createTherapistCareRouter());
  api.use('/patient', createPatientCareRouter());
  api.use('/me', requireAuth, createPreferencesRouter());
  api.use('/messages', createMessagesRouter());
  api.use('/', createNotificationsRouter());

  api.use((_request, response) => {
    response.status(404).json({ message: 'Route not found', code: 'not_found' });
  });

  return api;
}

export function createApp(deps: AppDependencies = {}) {
  const app = express();
  const clientDistDir = deps.clientDistDir === undefined ? config.clientDistDir : deps.clientDistDir;
  const indexHtml = clientDistDir ? path.join(clientDistDir, 'index.html') : null;

  if (indexHtml && !fs.existsSync(indexHtml)) {
    throw new Error(`CLIENT_DIST_DIR is set but ${indexHtml} does not exist. Build the client first (npm run build in client/).`);
  }

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(securityHeaders(Boolean(indexHtml)));
  app.use(cors({ origin: config.corsOrigin.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  // Load balancers and uptime monitors can always reach the health check at the root.
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'RehabQuest API' });
  });

  const api = createApiRouter(deps);
  app.use('/api', api);

  if (indexHtml && clientDistDir) {
    // Same-origin deployment: static app files, then the SPA fallback for navigation requests.
    // Hashed build assets are immutable; index.html and the service worker must revalidate.
    app.use(
      express.static(clientDistDir, {
        index: false,
        setHeaders(response, filePath) {
          const name = path.basename(filePath);
          if (filePath.includes(`${path.sep}assets${path.sep}`)) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (name === 'index.html' || name === 'sw.js' || name.endsWith('.webmanifest')) response.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/^(?!\/api(?:\/|$)).*/, (request, response, next) => {
      if (request.method !== 'GET' || !request.accepts('html')) {
        next();
        return;
      }
      response.setHeader('Cache-Control', 'no-cache');
      response.sendFile(indexHtml);
    });
  } else {
    // Separate web origin (development, tests, split hosting): the API also answers at "/".
    app.use('/', api);
  }

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
