import { PrintJob, fetchVouchers, markJobCompleted, markJobFailed } from '../db/queries';
import { generatePdf } from '../pdf/generator';
import { validatePdf } from '../validation/validator';
import { uploadPdf } from '../storage/uploader';
import { logger } from '../logger';

// ============================================
// Process a single print job end-to-end
// ============================================
// Flow: fetch vouchers → generate PDF → validate → upload → mark completed
// On any error: mark failed with error message (no PII in logs)

export async function processJob(job: PrintJob): Promise<void> {
  const startTime = Date.now();
  const jobMeta = {
    job_id: job.id,
    group_id: job.group_id,
    template_type: job.template_type,
    offset_start: job.offset_start,
    limit_count: job.limit_count,
  };

  logger.info('JOB_PROCESSING_START', jobMeta);

  try {
    // Step 1: Fetch voucher data from DB
    const vouchers = await fetchVouchers(
      job.group_id,
      job.template_type,
      job.offset_start,
      job.limit_count
    );

    logger.info('VOUCHERS_FETCHED', {
      job_id: job.id,
      count: vouchers.length,
    });

    // Step 2: Generate PDF
    const pdfBytes = await generatePdf(job.template_type, vouchers);

    logger.info('PDF_GENERATED', {
      job_id: job.id,
      size_bytes: pdfBytes.length,
    });

    // Step 3: Validate PDF before upload
    await validatePdf(pdfBytes, job.limit_count, job.template_type);

    logger.info('PDF_VALIDATED', { job_id: job.id });

    // Step 4: Upload to Supabase Storage
    const filePath = await uploadPdf(job.id, pdfBytes);

    logger.info('PDF_UPLOADED', {
      job_id: job.id,
      file_path: filePath,
    });

    // Step 5: Mark job as completed
    await markJobCompleted(job.id, filePath, vouchers.length);

    const durationMs = Date.now() - startTime;
    logger.info('JOB_COMPLETED', {
      job_id: job.id,
      pages: vouchers.length,
      size_bytes: pdfBytes.length,
      duration_ms: durationMs,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    logger.error('JOB_FAILED', {
      job_id: job.id,
      error: errorMessage,
      duration_ms: durationMs,
    });

    await markJobFailed(job.id, errorMessage);
  }
}
