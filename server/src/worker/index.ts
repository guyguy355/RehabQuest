/**
 * Background worker: `npm run worker` (loop) or `npm run worker -- --once`.
 * Several workers may run at the same time; the outbox uses row locks and dedupe keys.
 */
import { prisma } from '../db.js';
import { runWorkerOnce, WORKER_ID } from './run.js';

const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 30_000);
const once = process.argv.includes('--once');
let stopping = false;

async function main() {
  console.log(`[worker] ${WORKER_ID} started (${once ? 'single pass' : `every ${intervalMs / 1000}s`})`);
  do {
    try {
      const summary = await runWorkerOnce();
      if (summary.scheduled || summary.processed || summary.suppressed || summary.rescheduled || summary.failed) console.log('[worker]', JSON.stringify(summary));
    } catch (error) {
      console.error('[worker] pass failed:', error instanceof Error ? error.message : error);
    }
    if (!once && !stopping) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (!once && !stopping);
  await prisma.$disconnect();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

void main();
