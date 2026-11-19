import { createApp } from './app.js';
import { config, getJwtSecret, validateProductionConfig } from './config.js';
import { prisma } from './db.js';
import { emailAdapter } from './services/email.js';
import { runWorkerOnce, WORKER_ID } from './worker/run.js';

// Fail fast on a missing or weak secret instead of failing on the first login,
// and refuse a production configuration that would silently break real users.
getJwtSecret();
validateProductionConfig();

const server = createApp().listen(config.port, () => {
  console.log(`RehabQuest API running on http://localhost:${config.port}${config.clientDistDir ? ' (serving the web app, API under /api)' : ''}`);
  console.log(`Summary drafts: ${config.ai.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY ? `model ${config.ai.model}` : 'rule-based only (no AI provider configured)'}`);
  console.log(`Email: ${emailAdapter().configured ? `provider ${emailAdapter().provider}` : 'not configured (password reset emails will not be sent)'}`);
});

// Optional in-process worker (reminders, missed-activity rules, outbox delivery).
let stopping = false;
let workerTimer: NodeJS.Timeout | null = null;

if (config.workerInProcess) {
  console.log(`[worker] ${WORKER_ID} running in-process every ${config.workerIntervalMs / 1000}s`);
  const tick = async () => {
    if (stopping) return;
    try {
      const summary = await runWorkerOnce();
      if (summary.scheduled || summary.processed || summary.suppressed || summary.rescheduled || summary.failed) console.log('[worker]', JSON.stringify(summary));
    } catch (error) {
      console.error('[worker] pass failed:', error instanceof Error ? error.message : error);
    }
    if (!stopping) workerTimer = setTimeout(tick, config.workerIntervalMs);
  };
  workerTimer = setTimeout(tick, 5_000);
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[api] ${signal} received, shutting down`);
  if (workerTimer) clearTimeout(workerTimer);
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });
  // Do not hang forever on open keep-alive connections.
  setTimeout(() => process.exit(0), 10_000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown(signal));
}
