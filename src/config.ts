import path from 'path';

// ============================================
// Environment Variables
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_ID = process.env.WORKER_ID || 'worker-unknown';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(JSON.stringify({
    event: 'FATAL_MISSING_ENV',
    timestamp: new Date().toISOString(),
    message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
  }));
  process.exit(1);
}

export const ENV = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  WORKER_ID,
} as const;

// ============================================
// Voucher Expiry Date
// ============================================
// >>> לשינוי תוקף בדפוס הבא — שנה כאן בלבד <<<
export const VOUCHER_EXPIRY = '31/07/2026';

// ============================================
// Paths
// ============================================

const ASSETS_DIR = path.resolve(__dirname, '..', 'assets');

export const PATHS = {
  FONT_REGULAR: path.join(ASSETS_DIR, 'fonts', 'BokertovMedium.ttf'),
  FONT_BOLD: path.join(ASSETS_DIR, 'fonts', 'BokertovBlack.ttf'),
  TEMPLATE_50: path.join(ASSETS_DIR, 'templates', 'detached_50.pdf'),
  TEMPLATE_100: path.join(ASSETS_DIR, 'templates', 'detached_100.pdf'),
  TEMPLATE_200: path.join(ASSETS_DIR, 'templates', 'detached_200.pdf'),
} as const;

// ============================================
// Colors (RGB normalized 0–1 for pdf-lib)
// ============================================

export const COLORS = {
  BLUE:  { r: 0   / 255, g: 47  / 255, b: 158 / 255 },  // #002F9E
  LIGHT_BLUE: { r: 66  / 255, g: 194 / 255, b: 247 / 255 },  // #42C2F7
  WHITE: { r: 255 / 255, g: 255 / 255, b: 255 / 255 },  // #FFFFFF
} as const;

// ============================================
// Font Size
// ============================================

export const FONT_SIZE = 10;

// ============================================
// MM to PDF Points Conversion
// ============================================

export const MM_TO_PT = 72 / 25.4;  // 2.834645669...

// ============================================
// Field Coordinates (mm, origin: top-left)
// ============================================
// topRight = the right edge of the text box (text is right-aligned)
// bottomLeft = the left edge of the text box
// y values: topRight.y = top edge, bottomLeft.y = bottom edge

export interface FieldCoord {
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export const FIELD_COORDS: Record<string, FieldCoord> = {
  INSTITUTION_CODE: { topRight: { x: 31, y: 21 },  bottomLeft: { x: 24, y: 23 } },
  ORDER_CODE:       { topRight: { x: 178, y: 21 }, bottomLeft: { x: 171, y: 23 } },
  EXPIRY:           { topRight: { x: 134, y: 21 }, bottomLeft: { x: 119, y: 23 } },
  NAME:             { topRight: { x: 168, y: 32 }, bottomLeft: { x: 120, y: 34 } },
  INSTITUTION_NAME: { topRight: { x: 158, y: 37 }, bottomLeft: { x: 120, y: 39 } },
  ID_NUMBER:        { topRight: { x: 167, y: 42 }, bottomLeft: { x: 120, y: 44 } },
  PHONE:            { topRight: { x: 166, y: 47 }, bottomLeft: { x: 120, y: 48 } },
  BARCODE_TEXT:     { topRight: { x: 107, y: 70 }, bottomLeft: { x: 71, y: 73 } },
  BARCODE_IMAGE:    { topRight: { x: 197, y: 19 }, bottomLeft: { x: 182, y: 53 } },
} as const;

// ============================================
// Barcode Dimensions (mm)
// ============================================

export const BARCODE = {
  BOX_WIDTH: 15,    // full box width (mm)
  BOX_HEIGHT: 34,   // full box height (mm)
  QUIET_ZONE: 3,    // quiet zone each side in barcode direction (mm)
  SIDE_MARGIN: 1.5, // margin perpendicular to barcode direction (mm)
  ACTUAL_WIDTH: 12, // barcode image width after margins: 15 - 2*1.5 (mm)
  ACTUAL_HEIGHT: 24, // barcode image height after quiet zones: 34 - 2*5 (mm) — centered in box
  TOP_BOTTOM_MARGIN: 5, // centering margin: (34 - 24) / 2 (mm)
} as const;

// ============================================
// Job Processing
// ============================================

export const JOB = {
  POLL_INTERVAL_MS: 30_000,       // polling fallback: 30 seconds
  WATCHDOG_INTERVAL_MS: 300_000,  // watchdog: 5 minutes
  MAX_VOUCHERS_PER_BATCH: 1_000,
} as const;

// ============================================
// Template Type Mapping
// ============================================

export const TEMPLATE_MAP: Record<number, string> = {
  50: PATHS.TEMPLATE_50,
  100: PATHS.TEMPLATE_100,
  200: PATHS.TEMPLATE_200,
};

// ============================================
// Storage
// ============================================

export const STORAGE = {
  BUCKET: 'print-files',
  PATH_PREFIX: 'jobs',
} as const;
