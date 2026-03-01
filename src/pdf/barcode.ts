import bwipjs from 'bwip-js';
import { PDFDocument, PDFImage } from 'pdf-lib';

// ============================================
// Barcode Generation — Code 128, 500 DPI
// ============================================
// Generates a PNG barcode image from a 6-digit code.
// The barcode is meant to be embedded ROTATED 90° in the PDF.

/**
 * Generate a Code 128 barcode as a PNG buffer.
 * The PNG is generated in its natural orientation (horizontal).
 * Rotation is handled during PDF embedding.
 *
 * Scale is set for 500 DPI output with includetext=false
 * (barcode text is rendered separately at its own coordinates).
 */
export async function generateBarcodePng(code: string): Promise<Buffer> {
  const pngBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: code,
    scale: 5,
    height: 15,       // bar height in mm (at scale)
    includetext: false,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 0,   // we handle quiet zones ourselves in the PDF
    paddingheight: 0,
  });

  return pngBuffer;
}

/**
 * Embed a barcode PNG into a PDFDocument and return the PDFImage.
 */
export async function embedBarcodePng(
  pdfDoc: PDFDocument,
  pngBuffer: Buffer
): Promise<PDFImage> {
  return await pdfDoc.embedPng(pngBuffer);
}
