import { getSupabaseClient } from '../db/client';
import { STORAGE } from '../config';
import { logger } from '../logger';

// ============================================
// Supabase Storage Upload — Idempotent
// ============================================
// Uploads PDF to: print-files/jobs/{institutionCode}_{templateType}_{batchNumber}.pdf
// Uses upsert=true so retries overwrite the previous file.

export async function uploadPdf(
  jobId: string,
  pdfBytes: Uint8Array,
  institutionCode: string,
  templateType: number,
  batchNumber: number
): Promise<string> {
  const supabase = getSupabaseClient();
  const fileName = `${institutionCode}_${templateType}_${batchNumber}.pdf`;
  const filePath = `${STORAGE.PATH_PREFIX}/${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE.BUCKET)
    .upload(filePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true, // idempotent: retry overwrites old file
    });

  if (error) {
    throw new Error(`Storage upload failed for ${filePath}: ${error.message}`);
  }

  return filePath;
}
