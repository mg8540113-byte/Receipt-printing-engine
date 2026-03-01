import { getSupabaseClient } from './client';
import { logger } from '../logger';

// ============================================
// Types
// ============================================

export interface PrintJob {
  id: string;
  batch_group_id: string;
  group_id: string;
  template_type: number;
  offset_start: number;
  limit_count: number;
  status: string;
  retry_count: number;
  max_retries: number;
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  file_path: string | null;
  pages_generated: number | null;
  error_message: string | null;
  created_at: string;
}

export interface VoucherRow {
  voucher_id: string;
  barcode_code: string;
  title_before: string | null;
  first_name: string;
  last_name: string | null;
  title_after: string | null;
  id_number: string | null;
  phone: string;
  avrech_code: number;
  institution_name: string;
  institution_code: string;
}

// ============================================
// Claim a pending job (atomic via RPC)
// ============================================

export async function claimJob(workerId: string): Promise<PrintJob | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('claim_print_job', {
    p_worker_id: workerId,
  });

  if (error) {
    logger.error('CLAIM_RPC_ERROR', { error: error.message });
    return null;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  const job: PrintJob = Array.isArray(data) ? data[0] : data;
  return job;
}

// ============================================
// Fetch voucher data for a job
// ============================================

export async function fetchVouchers(
  groupId: string,
  templateType: number,
  offsetStart: number,
  limitCount: number
): Promise<VoucherRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('fetch_vouchers_for_print', {
    p_group_id: groupId,
    p_template_type: templateType,
    p_offset_start: offsetStart,
    p_limit_count: limitCount,
  });

  if (error) {
    throw new Error(`Failed to fetch vouchers: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(
      `No vouchers returned for group=${groupId} type=${templateType} offset=${offsetStart} limit=${limitCount}`
    );
  }

  return data as VoucherRow[];
}

// ============================================
// Update job status to completed
// ============================================

export async function markJobCompleted(
  jobId: string,
  filePath: string,
  pagesGenerated: number
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('print_jobs')
    .update({
      status: 'completed',
      file_path: filePath,
      pages_generated: pagesGenerated,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to mark job completed: ${error.message}`);
  }
}

// ============================================
// Update job status to failed
// ============================================

export async function markJobFailed(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('print_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    logger.error('MARK_FAILED_ERROR', { job_id: jobId, error: error.message });
  }
}

// ============================================
// Reset stuck jobs (watchdog RPC)
// ============================================

export async function resetStuckJobs(): Promise<{
  reset_to_pending: number;
  marked_failed: number;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('reset_stuck_jobs');

  if (error) {
    throw new Error(`reset_stuck_jobs RPC failed: ${error.message}`);
  }

  return data as { reset_to_pending: number; marked_failed: number };
}
