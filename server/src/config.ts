import dotenv from 'dotenv';

// Values already present in process.env (e.g. set by the test runner) win over .env.
dotenv.config();

function readInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: readInt('PORT', 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Behind a reverse proxy / PaaS (Render, Fly, nginx) the client IP arrives in X-Forwarded-For.
  // Needed for correct rate limiting. On by default in production, off elsewhere.
  trustProxy: process.env.TRUST_PROXY ? process.env.TRUST_PROXY === 'true' : isProduction,
  // Public URL of the web app (no trailing slash). Used to build links in emails.
  appBaseUrl: (process.env.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  // When set, the API serves the built web app from this directory and mounts the API under /api.
  clientDistDir: process.env.CLIENT_DIST_DIR || null,
  // Run the reminder/outbox worker inside the API process (one service instead of two).
  workerInProcess: process.env.WORKER_IN_PROCESS === 'true',
  workerIntervalMs: readInt('WORKER_INTERVAL_MS', 30_000),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? 'Asia/Jerusalem',
  // How many days back an offline-recorded exercise may still be synced.
  offlineGraceDays: readInt('OFFLINE_GRACE_DAYS', 3),
  // How long a downloaded offline plan snapshot stays usable before the app must reconnect.
  offlineSnapshotHours: readInt('OFFLINE_SNAPSHOT_HOURS', 72),
  // Only for local development without an email service: when "true", the
  // forgot-password endpoint returns the reset token in its response.
  exposeDevResetTokens: process.env.DEV_EXPOSE_RESET_TOKENS === 'true' && !isProduction,
  // 3D exercise demonstrations that no physiotherapist has approved yet are hidden from patients.
  // Preview mode also sends them (labelled as unreviewed). It is on by default outside production
  // and must be switched on explicitly (EXERCISE_DEMO_PREVIEW="true") when NODE_ENV=production.
  exerciseDemoPreview: process.env.EXERCISE_DEMO_PREVIEW ? process.env.EXERCISE_DEMO_PREVIEW === 'true' : !isProduction,
  authRateLimit: {
    windowMs: readInt('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: readInt('AUTH_RATE_LIMIT_MAX', 30),
  },
  email: {
    // "resend": send through Resend (RESEND_API_KEY). "log": print to the server log (development only).
    // "none": emails are not sent at all. Production requires a real provider.
    provider: process.env.EMAIL_PROVIDER ?? (isProduction ? 'none' : 'log'),
    from: process.env.EMAIL_FROM ?? 'RehabQuest <no-reply@rehabquest.localhost>',
    replyTo: process.env.EMAIL_REPLY_TO,
    resendApiKey: process.env.RESEND_API_KEY,
  },
  ai: {
    // "anthropic" enables the model-backed summary; anything else uses the rule-based summary only.
    provider: process.env.AI_SUMMARY_PROVIDER ?? 'none',
    model: process.env.AI_SUMMARY_MODEL ?? 'claude-opus-5-5',
    timeoutMs: readInt('AI_SUMMARY_TIMEOUT_MS', 20_000),
    // Model-backed summaries per therapist per hour. Requests beyond this get the rule-based summary.
    modelHourlyLimit: readInt('AI_SUMMARY_MODEL_HOURLY_LIMIT', 10),
    // All summary requests (model + rule-based) per therapist per hour. Beyond this: HTTP 429.
    totalHourlyLimit: readInt('AI_SUMMARY_TOTAL_HOURLY_LIMIT', 60),
  },
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set to a value of at least 16 characters');
  }

  return secret;
}

/**
 * Refuses to start a production server with a configuration that would silently break
 * real users (no email for password resets, dev-only switches left on, no public URL).
 * Does nothing outside NODE_ENV=production.
 */
export function validateProductionConfig(env: NodeJS.ProcessEnv = process.env, production = config.isProduction) {
  if (!production) return;
  const problems: string[] = [];
  const emailProvider = env.EMAIL_PROVIDER ?? 'none';

  if (!env.DATABASE_URL) problems.push('DATABASE_URL is not set.');
  if (!env.APP_BASE_URL) problems.push('APP_BASE_URL must be the public URL of the app (used in password-reset emails).');
  else if (!/^https:\/\//i.test(env.APP_BASE_URL)) problems.push('APP_BASE_URL must start with https://.');
  if (emailProvider === 'none' || emailProvider === 'log') {
    problems.push('EMAIL_PROVIDER must be a real provider in production (e.g. "resend" with RESEND_API_KEY); otherwise password resets cannot reach users.');
  } else if (emailProvider === 'resend' && !env.RESEND_API_KEY) {
    problems.push('RESEND_API_KEY is required when EMAIL_PROVIDER=resend.');
  }
  if (!env.EMAIL_FROM) problems.push('EMAIL_FROM must be a sender on a domain verified with the email provider.');
  if (env.DEV_EXPOSE_RESET_TOKENS === 'true') problems.push('DEV_EXPOSE_RESET_TOKENS must not be "true" in production.');
  if (!env.CLIENT_DIST_DIR && !env.CORS_ORIGIN) problems.push('CORS_ORIGIN must list the web app origin when the client is hosted separately.');
  if (env.AI_SUMMARY_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) problems.push('ANTHROPIC_API_KEY is required when AI_SUMMARY_PROVIDER=anthropic.');

  if (problems.length > 0) {
    throw new Error(`Refusing to start: production configuration problems\n- ${problems.join('\n- ')}`);
  }
}
