import { getSupabaseClient } from '../db/client';
import { claimJob } from '../db/queries';
import { processJob } from './processor';
import { ENV, JOB } from '../config';
import { logger } from '../logger';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// Claim Loop — Realtime + Polling Fallback
// ============================================

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let isProcessing = false;

// ============================================
// Core claim-and-process loop
// ============================================
// Keeps claiming jobs until none are available.
// isProcessing flag prevents concurrent processing.

async function claimLoop(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      const job = await claimJob(ENV.WORKER_ID);

      if (!job) {
        break; // no pending jobs
      }

      logger.info('JOB_CLAIMED', {
        job_id: job.id,
        template_type: job.template_type,
        offset_start: job.offset_start,
        limit_count: job.limit_count,
      });

      await processJob(job);
    }
  } catch (err) {
    logger.error('CLAIM_LOOP_ERROR', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isProcessing = false;
  }
}

// ============================================
// Start: Realtime subscription + polling
// ============================================

export async function startClaimer(): Promise<void> {
  const supabase = getSupabaseClient();

  // Realtime: listen for INSERT on print_jobs with status=pending
  realtimeChannel = supabase
    .channel('print_jobs_pending')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'print_jobs',
        filter: 'status=eq.pending',
      },
      () => {
        logger.info('REALTIME_NEW_JOB');
        claimLoop();
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'print_jobs',
        filter: 'status=eq.pending',
      },
      () => {
        // Watchdog may reset stuck jobs back to pending
        logger.info('REALTIME_JOB_RESET');
        claimLoop();
      }
    )
    .subscribe((status) => {
      logger.info('REALTIME_STATUS', { status });
    });

  // Polling fallback every 30 seconds (safety net if Realtime drops)
  pollingTimer = setInterval(() => {
    logger.info('POLLING_TICK');
    claimLoop();
  }, JOB.POLL_INTERVAL_MS);

  // Initial check on startup — process any pending jobs
  await claimLoop();
}

// ============================================
// Stop: cleanup on shutdown
// ============================================

export function stopClaimer(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  if (realtimeChannel) {
    getSupabaseClient().removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
