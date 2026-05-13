/**
 * questionParser.js — FIXED v2
 * תוקן לפי צילומי מסך:
 *  ✅ YouTube ID גלוי בטקסט השאלה
 *  ✅ נקודה לפני מילה אחרונה (RTL artifact)
 *  ✅ סימן שאלה בתחילת משפט
 *  ✅ prefix כפול "א . .טקסט"
 *  ✅ מספרי עמוד בסוף תשובות
 *  ✅ תמיכה ב-options כמערך
 *  ✅ correctIdx off-by-one
 *  ✅ נקודה בין מילים עבריות ללא רווח
 */

const INVISIBLE = /[\u200B-\u200D\uFEFF\u200E\u200F]/g;

// ─── YOUTUBE EXTRACTOR ────────────────────────────────────────────────────────

const extractVideoId = (text) => {
  if (!text) return null;
  // URL-based patterns (standard)
  const m = text.match(/(?:v=|v\/|embed\/|youtu\.be\/|watch\?v=)([\w-]{10,11})/);
  if (m) return m[1];
  // Fallback: bare ID in text — Latin alphanumeric 10-11 chars, not a common word
  const bare = text.match(/(?<![A-Za-z0-9_-])([A-Za-z][A-Za-z0-9_-]{9,10})(?![A-Za-z0-9_-])/);
  if (bare && !['dummynothing', 'javascript', 'stylesheet'].includes(bare[1].toLowerCase())) {
    // Validate: mixed case or contains digits/underscores (YouTube ID pattern)
    if (/[0-9_-]/.test(bare[1]) || /[A-Z]/.test(bare[1])) return bare[1];
  }
  return null;
};

// ─── DB TYPOS ─────────────────────────────────────────────────────────────────

const DB_TYPOS = [
  [/לפני כם/g, 'לפניכם'],
  [/הס פ ק/g, 'הספק'],
  [/עלי כם/g, 'עליכם'],
  [/ל נהוג/g, 'לנהוג'],
  [/תק\s*\.?\s*ף/g, 'תקף'],
  [/מ גדיל/g, 'מגדיל'],
  [/התוצאותשלהן/g, 'התוצאות שלהן'],
  [/עליכםלנהוג/g, 'עליכם לנהוג'],
  [/שימו :לב/g, 'שימו לב:'],
  [/מפעםאחת/g, 'מפעם אחת'],
  [/ב חינה/g, 'בחינה'],
  [/ה קפד/g, 'הקפד'],
];

// ─── CLEAN TEXT ───────────────────────────────────────────────────────────────

export const cleanText = (t) => {
  if (!t) return '';
  let s = String(t).trim().replace(INVISIBLE, '');

  // DB typos
  DB_TYPOS.forEach(([re, rep]) => { s = s.replace(re, rep); });

  // FIX 1: סימן שאלה/קריאה בתחילת משפט (PDF RTL artifact)
  s = s.replace(/^\?\s*(.+)$/, '$1?');
  s = s.replace(/^!\s*(.+)$/, '$1!');

  // FIX 2: נקודה בין מילים עבריות ללא רווח "בסרטון.יותר" → "בסרטון. יותר"
  s = s.replace(/([א-ת])\.([א-ת])/g, '$1. $2');

  // FIX 3: סימן שאלה שנדחק לאמצע "מוטלת ?החובה" → "מוטלת החובה"
  s = s.replace(/\s\?\s*([א-ת])/g, ' $1');

  // FIX 4: רווחים לפני פיסוק
  s = s.replace(/\s+([?.!:,;])/g, '$1');

  // FIX 5: נקודה סוררת בתחילה
  s = s.replace(/^\.\s*/, '');

  s = s.replace(/\s+/g, ' ');
  return s.trim();
};

// ─── CLEAN OPTION ─────────────────────────────────────────────────────────────

export const cleanOption = (t) => {
  if (!t) return '';
  let s = String(t).trim().replace(INVISIBLE, '');

  // FIX 6: הסרת prefix "א . ." / "א. " / "1. "
  s = s.replace(/^[א-ד]\s*\.?\s*\.\s*/, ''); // "א . ." or "א. ."
  s = s.replace(/^[א-ד]\s*\.\s*/, '');        // "א. " standard
  s = s.replace(/^[1-4]\s*\.\s*/, '');        // "1. " English
  s = s.replace(/^[.,:]\s*/, '');             // leftover punctuation

  // FIX 7: נקודה לפני מילה אחרונה (RTL artifact) "מרחק העצירה .שלו" → "מרחק העצירה שלו."
  s = s.replace(/\s+\.\s*([א-ת]+)\s*$/, ' $1.');

  // FIX 8: פסיק עם רווח שגוי ",יותר" → ", יותר"
  s = s.replace(/\s*,\s*([א-ת])/g, ', $1');

  // FIX 9: מספרי עמוד בסוף (OCR page numbers) — לא מוחקים מהירויות
  s = s.replace(/\s+(?!30|50|60|70|80|90|100|110|120)(\d{1,3})$/, '');

  // FIX 10: נקודה כפולה בסוף
  s = s.replace(/\.\.$/, '.');

  // DB typos
  DB_TYPOS.forEach(([re, rep]) => { s = s.replace(re, rep); });

  s = s.replace(/\s+/g, ' ');
  return s.trim();
};

// ─── MAIN PARSER ──────────────────────────────────────────────────────────────

export const parseQuestion = (q) => {
  if (!q) return null;

  let text = q.question_text || q.text || '';

  // שלב 1: חילוץ YouTube
  const vId = extractVideoId(text);

  // שלב 2: הסרת URL ומזהה וידאו מהטקסט
  text = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\\/g, '')
    .replace(/\s+[A-Za-z][A-Za-z0-9_-]{8,11}(?=\s|$)/g, '') // bare YouTube IDs
    .trim();

  // שלב 3: options — תמיכה בשני פורמטים
  let rawOpts;
  if (Array.isArray(q.options) && q.options.length >= 4) {
    rawOpts = q.options.slice(0, 4);
  } else {
    rawOpts = [
      q.option1 ?? q.option_1 ?? '',
      q.option2 ?? q.option_2 ?? '',
      q.option3 ?? q.option_3 ?? '',
      q.option4 ?? q.option_4 ?? '',
    ];
  }

  // שלב 4: אם options ריקים, נסה לחלץ מהשאלה
  const hasOpts = rawOpts.some(o => String(o || '').trim().length > 2);
  if (!hasOpts) {
    const parts = text.split(/\s*[א-ד]\s*[\.\)]\s*/).filter(p => p.trim().length > 2);
    if (parts.length >= 5) {
      text = parts[0];
      rawOpts = parts.slice(1, 5);
    }
  }

  // שלב 5: ניקוי טקסטים
  const displayQ = cleanText(text);
  const displayOpts = rawOpts.map(o => cleanOption(String(o || '')));

  // שלב 6: correctIdx — תמיד 0-based
  let rawCorrect = q.correct_answer_index ?? q.correct_answer ?? q.correct;
  let correctIdx = Number(rawCorrect);
  if (correctIdx >= 1 && correctIdx <= 4) correctIdx -= 1; // 1-based → 0-based
  if (correctIdx < 0 || correctIdx > 3) {
    console.warn(`[parseQuestion] correctIdx=${correctIdx} out of range, q.id=${q.id || q.question_id}`);
    correctIdx = 0;
  }

  // שלב 7: תמונה
  const rawImg = q.image_url || q.image_path || null;
  const image = (rawImg && rawImg !== 'null' && String(rawImg).length > 5)
    ? (String(rawImg).startsWith('http') ? rawImg : `/extracted_images/${String(rawImg).split('/').pop()}`)
    : null;

  return { ...q, displayQ, displayOpts, correctIdx, vId, image };
};
