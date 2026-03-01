import fs from 'fs';
import { PDFDocument, PDFFont, PDFEmbeddedPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PATHS, TEMPLATE_MAP } from '../config';
import { logger } from '../logger';

// ============================================
// In-memory cached assets — loaded once on startup
// ============================================

let fontRegular: PDFFont | null = null;
let fontBold: PDFFont | null = null;
let fontRegularBytes: Uint8Array | null = null;
let fontBoldBytes: Uint8Array | null = null;
let templatePdfBytes: Record<number, Uint8Array> = {};

// ============================================
// Load all assets into memory
// ============================================

export async function loadAllAssets(): Promise<void> {
  // Load font files as bytes (will be embedded per-document)
  fontRegularBytes = new Uint8Array(fs.readFileSync(PATHS.FONT_REGULAR));
  fontBoldBytes = new Uint8Array(fs.readFileSync(PATHS.FONT_BOLD));

  logger.info('FONTS_LOADED', {
    regular_size: fontRegularBytes.byteLength,
    bold_size: fontBoldBytes.byteLength,
  });

  // Load all three template PDFs as bytes
  for (const [valueStr, templatePath] of Object.entries(TEMPLATE_MAP)) {
    const value = Number(valueStr);
    templatePdfBytes[value] = new Uint8Array(fs.readFileSync(templatePath));
    logger.info('TEMPLATE_LOADED', { template_type: value, size: templatePdfBytes[value].byteLength });
  }
}

// ============================================
// Get cached raw bytes
// ============================================

export function getFontRegularBytes(): Uint8Array {
  if (!fontRegularBytes) throw new Error('Assets not loaded — call loadAllAssets() first');
  return fontRegularBytes;
}

export function getFontBoldBytes(): Uint8Array {
  if (!fontBoldBytes) throw new Error('Assets not loaded — call loadAllAssets() first');
  return fontBoldBytes;
}

export function getTemplatePdfBytes(templateType: number): Uint8Array {
  const bytes = templatePdfBytes[templateType];
  if (!bytes) throw new Error(`No template loaded for type ${templateType}`);
  return bytes;
}

// ============================================
// Embed fonts into a specific PDFDocument
// ============================================
// Each PDFDocument needs its own embedded font instances.
// We reuse the raw bytes from memory but create new embeddings per document.

export async function embedFontsInDocument(
  pdfDoc: PDFDocument
): Promise<{ regular: PDFFont; bold: PDFFont }> {
  pdfDoc.registerFontkit(fontkit);

  const regular = await pdfDoc.embedFont(getFontRegularBytes(), { subset: false });
  const bold = await pdfDoc.embedFont(getFontBoldBytes(), { subset: false });

  return { regular, bold };
}

// ============================================
// Embed template page as reusable XObject
// ============================================
// Returns an embedded page that can be drawn on many pages
// (shared reference — efficient: 1000 pages share 1 template copy)

export async function embedTemplatePage(
  pdfDoc: PDFDocument,
  templateType: number
): Promise<PDFEmbeddedPage> {
  const templateBytes = getTemplatePdfBytes(templateType);
  const templateDoc = await PDFDocument.load(templateBytes);
  const [templatePage] = await pdfDoc.embedPages(templateDoc.getPages());
  return templatePage;
}
