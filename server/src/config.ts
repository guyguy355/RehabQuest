import dotenv from 'dotenv';

// Values already present in process.env (e.g. set by the test runner) win over .env.
dotenv.config();

function readInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: readInt('PORT', 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? 'Asia/Jerusalem',
  // Only for local development without an email service: when "true", the
  // forgot-password endpoint returns the reset token in its response.
  exposeDevResetTokens: process.env.DEV_EXPOSE_RESET_TOKENS === 'true' && process.env.NODE_ENV !== 'production',
  authRateLimit: {
    windowMs: readInt('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: readInt('AUTH_RATE_LIMIT_MAX', 30),
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
