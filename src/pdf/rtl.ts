// ============================================
// RTL text processing via bidi-js
// ============================================
// Implements Unicode Bidirectional Algorithm (UAX #9).
// Hebrew characters are reordered for correct display in PDF
// (which draws left-to-right). Numbers and brackets remain correct.

import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

/**
 * Process a string through the Unicode BiDi algorithm for PDF rendering.
 * Returns a string with characters in visual order (left-to-right for the PDF engine).
 *
 * Use ONLY for fields containing Hebrew text.
 * Number-only fields must NOT be processed through this function.
 */
export function processRtl(text: string): string {
  if (!text || text.trim().length === 0) return text;

  const embeddingLevels = bidi.getEmbeddingLevels(text, 'rtl');
  const reordered = bidi.getReorderedString(text, embeddingLevels);

  return reordered;
}
