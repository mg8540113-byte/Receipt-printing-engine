import { ENV } from './config';
import { logger } from './logger';
import { loadAllAssets } from './pdf/templates';
import { getSupabaseClient } from './db/client';
import { startClaimer, stopClaimer } from './jobs/claimer';
import { startWatchdog, stopWatchdog } from './jobs/watchdog';

async function main(): Promise<void> {
  logger.info('WORKER_STARTING', { worker_id: ENV.WORKER_ID });

  // Verify Supabase connection
  const supabase = getSupabaseClient();
  const { error: pingError } = await supabase
    .from('print_jobs')
    .select('id')
    .limit(1);

  if (pingError) {
    logger.error('SUPABASE_CONNECTION_FAILED', { error: pingError.message });
    process.exit(1);
  }
  logger.info('SUPABASE_CONNECTED');

  // Load fonts + templates into memory (once)
  await loadAllAssets();
  logger.info('ASSETS_LOADED');

  // Start watchdog (every 5 minutes)
  startWatchdog();
  logger.info('WATCHDOG_STARTED');

  // Start claim loop (Realtime + polling)
  await startClaimer();
  logger.info('CLAIMER_STARTED');

  logger.info('WORKER_READY');
}

// Graceful shutdown
function shutdown(): void {
  logger.info('WORKER_SHUTTING_DOWN');
  stopClaimer();
  stopWatchdog();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  logger.error('WORKER_FATAL', { error: String(err) });
  process.exit(1);
});
