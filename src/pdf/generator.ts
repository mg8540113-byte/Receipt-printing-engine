import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from 'pdf-lib';
import { VoucherRow } from '../db/queries';
import { VOUCHER_EXPIRY, FONT_SIZE, FIELD_COORDS, BARCODE } from '../config';
import { embedFontsInDocument, embedTemplatePage } from './templates';
import { FIELD_CONFIGS, FieldConfig, mmToPt, getBoxWidthPt } from './fields';
import { processRtl } from './rtl';
import { generateBarcodePng, embedBarcodePng } from './barcode';
import { logger } from '../logger';

// ============================================
// PDF Generator — Core Engine
// ============================================
// Creates a multi-page PDF. Each page = one voucher.
// Template is embedded once as a shared XObject (efficient).
// All text fields are right-aligned and clipped to their box.

/**
 * Build the text value for a given field key from voucher data.
 */
function getFieldValue(key: string, voucher: VoucherRow): string {
  switch (key) {
    case 'INSTITUTION_CODE':
      return voucher.institution_code;

    case 'ORDER_CODE':
      return String(voucher.avrech_code).padStart(4, '0');

    case 'EXPIRY':
      // >>> לשינוי תוקף — ראה config.ts <<<
      return VOUCHER_EXPIRY;

    case 'NAME':
      return [
        voucher.title_before,
        voucher.first_name,
        voucher.last_name,
        voucher.title_after,
      ]
        .filter(Boolean)
        .join(' ');

    case 'INSTITUTION_NAME':
      return voucher.institution_name;

    case 'ID_NUMBER':
      return voucher.id_number ?? '';

    case 'PHONE':
      return voucher.phone;

    case 'BARCODE_TEXT':
      return voucher.barcode_code;

    default:
      return '';
  }
}

/**
 * Draw a single text field on a page.
 * Text is right-aligned within its box and clipped if it overflows.
 */
function drawTextField(
  page: PDFPage,
  fieldConfig: FieldConfig,
  text: string,
  font: PDFFont,
  pageHeightPt: number
): void {
  if (!text || text.length === 0) return;

  // Process RTL if needed (Hebrew fields only)
  const displayText = fieldConfig.useRtl ? processRtl(text) : text;

  // Calculate text width for right-alignment
  const textWidth = font.widthOfTextAtSize(displayText, FONT_SIZE);
  const boxWidthPt = getBoxWidthPt(fieldConfig.coord);

  // Clip: if text is wider than box, we still draw from right edge
  // pdf-lib doesn't have native clipping, so we truncate characters
  let finalText = displayText;
  let finalWidth = textWidth;

  if (textWidth > boxWidthPt) {
    // Remove characters from the visual start (left side) until it fits
    // For right-aligned text, we keep the rightmost characters
    while (finalText.length > 0 && font.widthOfTextAtSize(finalText, FONT_SIZE) > boxWidthPt) {
      finalText = finalText.substring(1);
    }
    finalWidth = font.widthOfTextAtSize(finalText, FONT_SIZE);
  }

  // Right-aligned: x = right edge - text width
  const rightEdgePt = mmToPt(fieldConfig.coord.topRight.x);
  const x = rightEdgePt - finalWidth;

  // Y baseline: PDF origin is bottom-left, our coords are from top-left
  // Use bottomLeft.y as the baseline reference
  const y = pageHeightPt - mmToPt(fieldConfig.coord.bottomLeft.y);

  page.drawText(finalText, {
    x,
    y,
    size: FONT_SIZE,
    font,
    color: rgb(fieldConfig.color.r, fieldConfig.color.g, fieldConfig.color.b),
  });
}

/**
 * Draw the barcode image on a page, rotated 90 degrees.
 *
 * The barcode box is 15mm wide × 34mm tall.
 * The barcode is centered with quiet zones:
 * - 3mm quiet zone on each side in the barcode scan direction → barcode = 24mm
 * - 1.5mm margin on each perpendicular side → barcode width = 12mm
 * - Top/bottom margin = 5mm each (centering: (34-24)/2)
 */
async function drawBarcode(
  page: PDFPage,
  pdfDoc: PDFDocument,
  barcodeCode: string,
  pageHeightPt: number
): Promise<void> {
  const pngBuffer = await generateBarcodePng(barcodeCode);
  const barcodeImage = await embedBarcodePng(pdfDoc, pngBuffer);

  const coord = FIELD_COORDS.BARCODE_IMAGE;

  // The barcode is rotated 90° clockwise.
  // After rotation:
  // - "width" on page = ACTUAL_HEIGHT (24mm) — along the box height
  // - "height" on page = ACTUAL_WIDTH (12mm) — along the box width

  const drawWidth = mmToPt(BARCODE.ACTUAL_HEIGHT);   // 24mm in points (vertical on page)
  const drawHeight = mmToPt(BARCODE.ACTUAL_WIDTH);    // 12mm in points (horizontal on page)

  // Center the barcode in the box
  const boxLeftPt = mmToPt(coord.bottomLeft.x);
  const boxWidthPt = mmToPt(BARCODE.BOX_WIDTH);
  const boxHeightPt = mmToPt(BARCODE.BOX_HEIGHT);

  // Center horizontally in box: margin = (boxWidth - drawHeight) / 2
  const marginXPt = (boxWidthPt - drawHeight) / 2;
  // Center vertically in box: margin = (boxHeight - drawWidth) / 2
  const marginYPt = (boxHeightPt - drawWidth) / 2;

  // pdf-lib degrees(90) = 90° counterclockwise rotation around anchor (x, y).
  // After 90° CCW: image extends UP by drawWidth, LEFT by drawHeight from anchor.
  // So anchor must be at BOTTOM-RIGHT of the target barcode area.
  //
  // x = right edge of barcode area = boxLeft + sideMargin + barcodeWidth
  const x = boxLeftPt + marginXPt + drawHeight;
  // y = bottom edge of barcode area = box bottom + vertical centering margin
  const y = pageHeightPt - mmToPt(coord.bottomLeft.y) + marginYPt;

  page.drawImage(barcodeImage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
    rotate: degrees(90),
  });
}

// ============================================
// Main PDF generation function
// ============================================

export async function generatePdf(
  templateType: number,
  vouchers: VoucherRow[]
): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const { regular, bold } = await embedFontsInDocument(pdfDoc);

  // Embed template page as shared XObject
  const templatePage = await embedTemplatePage(pdfDoc, templateType);

  // Read page dimensions from the template (not hardcoded)
  const templateDims = templatePage.size();
  const pageWidthPt = templateDims.width;
  const pageHeightPt = templateDims.height;

  // Generate one page per voucher
  for (let i = 0; i < vouchers.length; i++) {
    const voucher = vouchers[i];

    // Add a new page with the template dimensions
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

    // Draw the template background (shared XObject — efficient)
    page.drawPage(templatePage, {
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
    });

    // Draw all text fields
    for (const fieldConfig of FIELD_CONFIGS) {
      const text = getFieldValue(fieldConfig.key, voucher);
      const font = fieldConfig.fontType === 'bold' ? bold : regular;
      drawTextField(page, fieldConfig, text, font, pageHeightPt);
    }

    // Draw barcode image (rotated 90°)
    await drawBarcode(page, pdfDoc, voucher.barcode_code, pageHeightPt);
  }

  // Serialize to bytes
  const pdfBytes = await pdfDoc.save();

  return pdfBytes;
}
