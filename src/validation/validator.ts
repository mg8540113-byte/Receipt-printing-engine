import { PDFDocument } from 'pdf-lib';
import { getTemplatePdfBytes } from '../pdf/templates';

// ============================================
// PDF Validation — pre-upload checks
// ============================================
// Three mandatory checks before uploading to Storage:
// 1. File size > 0
// 2. Page count === expected limit_count
// 3. Page dimensions === template dimensions

export async function validatePdf(
  pdfBytes: Uint8Array,
  expectedPageCount: number,
  templateType: number
): Promise<void> {
  // Check 1: File size
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('VALIDATION_FAILED: PDF file is empty (0 bytes)');
  }

  // Load generated PDF to inspect structure
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // Check 2: Page count
  if (pages.length !== expectedPageCount) {
    throw new Error(
      `VALIDATION_FAILED: Page count mismatch — expected ${expectedPageCount}, got ${pages.length}`
    );
  }

  // Check 3: Page dimensions match template
  const templateBytes = getTemplatePdfBytes(templateType);
  const templateDoc = await PDFDocument.load(templateBytes);
  const templatePage = templateDoc.getPages()[0];
  const expectedWidth = templatePage.getWidth();
  const expectedHeight = templatePage.getHeight();

  // Tolerance of 0.1 points (floating point safety)
  const TOLERANCE = 0.1;

  const firstPage = pages[0];
  const actualWidth = firstPage.getWidth();
  const actualHeight = firstPage.getHeight();

  if (
    Math.abs(actualWidth - expectedWidth) > TOLERANCE ||
    Math.abs(actualHeight - expectedHeight) > TOLERANCE
  ) {
    throw new Error(
      `VALIDATION_FAILED: Page dimensions mismatch — ` +
      `expected ${expectedWidth.toFixed(1)}×${expectedHeight.toFixed(1)}pt, ` +
      `got ${actualWidth.toFixed(1)}×${actualHeight.toFixed(1)}pt`
    );
  }
}
