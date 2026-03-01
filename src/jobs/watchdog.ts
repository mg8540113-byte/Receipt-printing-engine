import { resetStuckJobs } from '../db/queries';
import { JOB } from '../config';
import { logger } from '../logger';

// ============================================
// Watchdog — resets stuck jobs every 5 minutes
// ============================================
// Calls the reset_stuck_jobs RPC which:
// 1. Jobs in_progress > 10 min with retries left → back to pending
// 2. Jobs in_progress > 10 min with retries exhausted → failed

let watchdogTimer: ReturnType<typeof setInterval> | null = null;

async function runWatchdog(): Promise<void> {
  try {
    const result = await resetStuckJobs();

    if (result.reset_to_pending > 0 || result.marked_failed > 0) {
      logger.warn('WATCHDOG_RESET', {
        reset_to_pending: result.reset_to_pending,
        marked_failed: result.marked_failed,
      });
    } else {
      logger.info('WATCHDOG_OK');
    }
  } catch (err) {
    logger.error('WATCHDOG_ERROR', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startWatchdog(): void {
  // Run immediately on startup, then every 5 minutes
  runWatchdog();
  watchdogTimer = setInterval(runWatchdog, JOB.WATCHDOG_INTERVAL_MS);
}

export function stopWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
