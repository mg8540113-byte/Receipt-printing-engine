# Receipt Worker — מסמך ארכיטקטורה ודיבוג

## סקירה כללית

Background Worker שרץ על Render.com ומייצר קבצי PDF של תלושים (vouchers).
Worker זה הוא חלק ממערכת תלת-זרועית:

```
Vercel (Next.js)          Supabase                  Render (Worker)
─────────────────     ─────────────────────     ─────────────────────
UI + API Route    →   print_jobs table      →   PDF generation
לחיצה על "הדפס"       תור משימות + Storage       ייצור + העלאה
סטטוס בזמן אמת   ←   Realtime + Storage    ←   עדכון status
```

ה-Worker הוא "מדפסת טיפשה" — הוא לא מחשב כלום, רק שולף נתונים מוכנים
מה-DB ומטביע אותם על תבנית PDF.

---

## מבנה תיקיות

```
receipt-worker/
├── assets/
│   ├── fonts/
│   │   ├── BokertovMedium.ttf        ← גופן רגיל (שם, כולל, ת.ז, טלפון)
│   │   └── BokertovBlack.ttf         ← גופן מודגש (תוקף, ברקוד, קודים)
│   └── templates/
│       ├── detached_50.pdf            ← תבנית רקע 50 ש"ח
│       ├── detached_100.pdf           ← תבנית רקע 100 ש"ח
│       └── detached_200.pdf           ← תבנית רקע 200 ש"ח
│
├── sql/
│   └── fetch_vouchers_for_print.sql   ← RPC שצריך לרשום ב-Supabase
│
├── src/
│   ├── index.ts                       ← נקודת כניסה
│   ├── config.ts                      ← כל הקבועים (מקום אחד!)
│   │
│   ├── db/
│   │   ├── client.ts                  ← Supabase client (service role)
│   │   └── queries.ts                 ← כל השאילתות וה-RPCs
│   │
│   ├── jobs/
│   │   ├── claimer.ts                 ← Realtime + polling + claim
│   │   ├── processor.ts               ← אורקסטרציה: claim → PDF → upload
│   │   └── watchdog.ts                ← איפוס משימות תקועות
│   │
│   ├── pdf/
│   │   ├── generator.ts               ← מנוע PDF — הקובץ המרכזי
│   │   ├── templates.ts               ← טעינת תבניות ופונטים לזיכרון
│   │   ├── fields.ts                  ← קואורדינטות + צבעים + סוג גופן
│   │   ├── rtl.ts                     ← עיבוד עברית (bidi-js)
│   │   └── barcode.ts                 ← יצירת ברקוד Code 128
│   │
│   ├── storage/
│   │   └── uploader.ts                ← העלאה ל-Supabase Storage
│   │
│   ├── validation/
│   │   └── validator.ts               ← בדיקות pre-upload
│   │
│   └── types/
│       └── bidi-js.d.ts               ← Type declarations
│
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

---

## זרימת עבודה מלאה

```
1. משתמש לוחץ "הדפס" באתר (Vercel)
        │
2. API Route ב-Vercel שולף ספירת תלושים, מחלק ל-batches של 1,000
   ויוצר שורות ב-print_jobs (טרנזקציה אטומית)
        │
3. Worker מזהה משימות חדשות (Realtime / polling כל 30 שניות)
        │
4. Worker תופס משימה (RPC: claim_print_job — atomic, FOR UPDATE SKIP LOCKED)
        │
5. Worker שולף נתוני תלושים (RPC: fetch_vouchers_for_print)
        │
6. Worker מייצר PDF:
   ├── טוען תבנית רקע (page embedding — XObject משותף)
   ├── לכל תלוש: יוצר עמוד חדש + מטביע רקע
   ├── כותב 8 שדות טקסט (ימין-לשמאל, צבעים, גופנים)
   └── מייצר ומטביע ברקוד Code 128 (מסובב 90°)
        │
7. Worker מאמת: גודל > 0, מספר עמודים תקין, מימדי עמוד = תבנית
        │
8. Worker מעלה ל-Supabase Storage: print-files/jobs/{job_id}.pdf
        │
9. Worker מעדכן: status=completed, file_path, pages_generated
        │
10. UI מציג כפתור הורדה (Realtime)
```

---

## משתני סביבה (Render)

| משתנה | תיאור |
|---|---|
| `SUPABASE_URL` | כתובת הפרוייקט ב-Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | מפתח service role (גישה מלאה) |
| `WORKER_ID` | שם ה-Worker ב-logs (ברירת מחדל: worker-unknown) |

---

## RPCs ב-Supabase (3 פונקציות)

| פונקציה | מי קורא | מטרה |
|---|---|---|
| `claim_print_job(p_worker_id)` | Worker | תפיסה אטומית של משימה pending |
| `reset_stuck_jobs()` | Worker (watchdog) | איפוס משימות תקועות > 10 דקות |
| `fetch_vouchers_for_print(p_group_id, p_template_type, p_offset_start, p_limit_count)` | Worker | שליפת נתוני תלושים |

---

## שדות על התלוש

כל 3 התבניות (50/100/200) חולקות אותן קואורדינטות. רק הרקע שונה.

| שדה | צבע | גופן | מקור הנתון |
|---|---|---|---|
| קוד מוסד | לבן (#FFFFFF) | BokertovBlack | `institution_code` |
| קוד הזמנה | לבן (#FFFFFF) | BokertovBlack | `avrech_code` → padStart(4,'0') |
| תוקף | תכלת (#42C2F7) | BokertovBlack | hardcoded ב-config.ts |
| שם | כחול (#002F9E) | BokertovMedium | title_before + first_name + last_name + title_after |
| שם מוסד (כולל) | כחול (#002F9E) | BokertovMedium | `institution_name` |
| ת.ז. | כחול (#002F9E) | BokertovMedium | `id_number` (nullable — שדה ריק אם null) |
| טלפון | כחול (#002F9E) | BokertovMedium | `phone` |
| מספר ברקוד | תכלת (#42C2F7) | BokertovBlack | `barcode_code` |
| ברקוד (תמונה) | — | — | `barcode_code` → Code 128, מסובב 90° |

גודל כל הטקסטים: **10 נקודות**. יישור: **ימין**.

---

## קואורדינטות (mm, מקור: שמאל-עליון)

| שדה | topRight (x,y) | bottomLeft (x,y) |
|---|---|---|
| קוד מוסד | 31, 21 | 24, 23 |
| קוד הזמנה | 178, 21 | 171, 23 |
| תוקף | 134, 21 | 119, 23 |
| שם | 168, 32 | 120, 34 |
| שם מוסד | 158, 37 | 120, 39 |
| ת.ז. | 167, 42 | 120, 44 |
| טלפון | 166, 47 | 120, 48 |
| מספר ברקוד | 107, 70 | 71, 73 |
| ברקוד (תמונה) | 197, 19 | 182, 53 |

המרה ל-PDF: `mm × 2.8346 = points`. ציר Y הפוך (PDF = שמאל-תחתון).

---

## ברקוד — פרטים טכניים

- סוג: Code 128
- ספרייה: bwip-js
- סיבוב: 90° counterclockwise (pdf-lib degrees(90))
- תיבה כוללת: 15mm × 34mm
- שוליים: 1.5mm צד × 5mm למעלה/למטה (centering)
- ברקוד בפועל: 12mm × 24mm ממורכז בתיבה
- Quiet zone: 3mm בכל צד של כיוון הסריקה

---

## מנגנוני חוסן

| מנגנון | איפה | מה עושה |
|---|---|---|
| Atomic claim | `claim_print_job` RPC | FOR UPDATE SKIP LOCKED — משימה נתפסת פעם אחת |
| Polling fallback | `claimer.ts` | כל 30 שניות — safety net אם Realtime נפל |
| Watchdog | `watchdog.ts` | כל 5 דקות — מאפס משימות תקועות > 10 דקות |
| Retry | `reset_stuck_jobs` RPC | עד 3 ניסיונות, אח"כ failed |
| Idempotent upload | `uploader.ts` | upsert=true — retry מחליף קובץ קודם |
| Validation | `validator.ts` | 3 בדיקות לפני העלאה |
| Graceful shutdown | `index.ts` | SIGTERM/SIGINT → ניקוי timers |

---

## דיבוג — מדריך מהיר

### בעיה: Worker לא תופס משימות
1. בדוק logs ב-Render: חפש `REALTIME_STATUS` — צריך להיות `SUBSCRIBED`
2. בדוק שיש שורות עם `status=pending` ב-`print_jobs`
3. בדוק שה-Realtime מופעל על טבלת `print_jobs` ב-Supabase Dashboard

### בעיה: PDF ריק / שגוי
1. בדוק logs: `VOUCHERS_FETCHED` — count צריך להיות > 0
2. בדוק ש-RPC `fetch_vouchers_for_print` קיים ב-Supabase
3. בדוק ש-`template_type` תואם (50/100/200)

### בעיה: טקסט לא במקום הנכון
1. כל הקואורדינטות ב-`src/config.ts` → `FIELD_COORDS`
2. יחידות: מילימטרים, מקור: שמאל-עליון
3. המרה: `y_pdf = pageHeight_pt - (y_mm × 2.8346)`

### בעיה: עברית הפוכה
1. בדוק ש-`useRtl: true` מוגדר לשדה ב-`src/pdf/fields.ts`
2. רק שדות עבריים (שם, שם מוסד) עוברים דרך bidi-js
3. שדות מספריים (ת.ז., טלפון, קודים) — **אסור** להפעיל RTL

### בעיה: ברקוד לא נסרק
1. בדוק שה-quiet zone שמורה (3mm כל צד)
2. בדוק שהסיבוב 90° — `degrees(90)` ב-`generator.ts`
3. בדוק רזולוציית הדפסה — bwip-js מוגדר scale=5

### בעיה: משימות תקועות ב-in_progress
1. Watchdog מאפס אחרי 10 דקות — בדוק logs: `WATCHDOG_RESET`
2. אחרי 3 ניסיונות → `status=failed`
3. בדוק `error_message` בטבלת `print_jobs`

### בעיה: Storage מלא
1. Free tier = 1GB, הדפסה אחת ≈ 300MB
2. השתמש בכפתור "מחק קבצים" בממשק
3. בדוק שה-policy `authenticated_can_delete_print_files` קיימת

---

## שינויים נפוצים בעתיד

### שינוי תוקף תלושים
קובץ: `src/config.ts` שורה 30
```typescript
export const VOUCHER_EXPIRY = '31/07/2026';
```
שנה את התאריך → commit → push → Render יבצע deploy אוטומטי.

### שינוי מיקום שדה
קובץ: `src/config.ts` → `FIELD_COORDS`
ערכים ב-mm, מקור שמאל-עליון. שנה ו-deploy.

### הוספת שדה חדש
1. הוסף קואורדינטות ב-`config.ts` → `FIELD_COORDS`
2. הוסף FieldConfig ב-`src/pdf/fields.ts` → `FIELD_CONFIGS`
3. הוסף case ב-`src/pdf/generator.ts` → `getFieldValue()`
4. אם השדה עברי — הגדר `useRtl: true`

### שינוי צבע
קובץ: `src/config.ts` → `COLORS`
ערכי RGB מחולקים ב-255 (pdf-lib דורש 0–1).

### שינוי גודל גופן
קובץ: `src/config.ts` → `FONT_SIZE` (כרגע 10).

### החלפת פונט
1. שים את ה-TTF החדש ב-`assets/fonts/`
2. עדכן את הנתיב ב-`config.ts` → `PATHS`

### החלפת תבנית רקע
1. שים את ה-PDF החדש ב-`assets/templates/`
2. עדכן את הנתיב ב-`config.ts` → `PATHS`

---

## טכנולוגיות

| רכיב | ספרייה | גרסה | תפקיד |
|---|---|---|---|
| PDF | pdf-lib | 1.17.1 | יצירת PDF בינארי, page embedding |
| פונטים | @pdf-lib/fontkit | 1.1.1 | הטמעת TTF עברי |
| RTL | bidi-js | 1.0.3 | אלגוריתם Unicode BiDi (UAX #9) |
| ברקוד | bwip-js | 4.5.1 | Code 128 → PNG |
| DB | @supabase/supabase-js | 2.49.1 | חיבור, RPCs, Storage, Realtime |
| Runtime | Node.js + TypeScript | — | Render Background Worker |

---

## כללי ברזל — Logging

- כל log הוא JSON מובנה (structured)
- תמיד כולל: `event`, `worker_id`, `timestamp`
- **אסור** לרשום: שמות, ת.ז., טלפונים, Service Role Key
- מותר לרשום: job_id, group_id, template_type, מספר עמודים, גודל קובץ, משך זמן
