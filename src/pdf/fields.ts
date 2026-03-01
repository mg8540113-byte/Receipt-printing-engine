import { FIELD_COORDS, COLORS, MM_TO_PT, FieldCoord } from '../config';

// ============================================
// Field Configuration
// ============================================
// Defines color, font type, and whether RTL processing is needed
// for each field on the voucher.

export type FontType = 'regular' | 'bold';

export interface FieldConfig {
  key: string;
  coord: FieldCoord;
  color: { r: number; g: number; b: number };
  fontType: FontType;
  useRtl: boolean;
}

export const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'INSTITUTION_CODE',
    coord: FIELD_COORDS.INSTITUTION_CODE,
    color: COLORS.WHITE,
    fontType: 'bold',
    useRtl: false,
  },
  {
    key: 'ORDER_CODE',
    coord: FIELD_COORDS.ORDER_CODE,
    color: COLORS.WHITE,
    fontType: 'bold',
    useRtl: false,
  },
  {
    key: 'EXPIRY',
    coord: FIELD_COORDS.EXPIRY,
    color: COLORS.LIGHT_BLUE,
    fontType: 'bold',
    useRtl: false,
  },
  {
    key: 'NAME',
    coord: FIELD_COORDS.NAME,
    color: COLORS.BLUE,
    fontType: 'regular',
    useRtl: true,
  },
  {
    key: 'INSTITUTION_NAME',
    coord: FIELD_COORDS.INSTITUTION_NAME,
    color: COLORS.BLUE,
    fontType: 'regular',
    useRtl: true,
  },
  {
    key: 'ID_NUMBER',
    coord: FIELD_COORDS.ID_NUMBER,
    color: COLORS.BLUE,
    fontType: 'regular',
    useRtl: false,
  },
  {
    key: 'PHONE',
    coord: FIELD_COORDS.PHONE,
    color: COLORS.BLUE,
    fontType: 'regular',
    useRtl: false,
  },
  {
    key: 'BARCODE_TEXT',
    coord: FIELD_COORDS.BARCODE_TEXT,
    color: COLORS.LIGHT_BLUE,
    fontType: 'bold',
    useRtl: false,
  },
];

// ============================================
// Coordinate conversion helpers
// ============================================
// PDF coordinate system: origin at BOTTOM-LEFT
// Our input coordinates: origin at TOP-LEFT (mm)

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

/**
 * Get the maximum width of a text box in points (for clipping).
 */
export function getBoxWidthPt(coord: FieldCoord): number {
  return mmToPt(coord.topRight.x - coord.bottomLeft.x);
}
