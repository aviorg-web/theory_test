/**
 * questionParser.js — FIXED VERSION
 * תוקנו: RTL artifacts, option prefixes, correct_answer_index, options array support, page numbers
 */

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const INVISIBLE = /[\u200B-\u200D\uFEFF\u200E\u200F]/g;

// מיקוד DB typos (ייחודיים למאגר הישראלי)
const DB_TYPOS = [
  [/לפני כם/g, 'לפניכם'],
  [/הס פ ק/g, 'הספק'],
  [/אי־ודאות/g, 'אי-ודאות'],
  [/עלי כם/g, 'עליכם'],
  [/ל נהוג/g, 'לנהוג'],
  [/תק \s*\.?\s*ף/g, 'תקף'],        // "תק .ף" → "תקף"
  [/מ גדיל/g, 'מגדיל'],
  [/ב חינה/g, 'בחינה'],
  [/התוצאותשלהן/g, 'התוצאות שלהן'],
  [/שמאלההיכן/g, 'שמאלה היכן'],
  [/עליכםלנהוג/g, 'עליכם לנהוג'],
  [/שימו :לב/g, 'שימו לב:'],
];

/**
 * cleanText — ניקוי כללי של טקסט עברי שחולץ מ-PDF
 */
export const cleanText = (t) => {
  if (!t) return '';
  let s = String(t).trim().replace(INVISIBLE, '');

  // תיקוני typo ייחודיים
  DB_TYPOS.forEach(([re, rep]) => { s = s.replace(re, rep); });

  // ─── FIX 1: סימן שאלה בתחילת המשפט → הזזה לסוף ───
  // PDF RTL extraction הופך את כיוון הסימן
  // "?מהי הסכנה" → "מהי הסכנה?"
  s = s.replace(/^\?\s*(.+)$/, '$1?');
  s = s.replace(/^!\s*(.+)$/, '$1!');

  // ─── FIX 2: סימן שאלה באמצע משפט שנדבק ───
  // "להכיר ?את" → "להכיר את" + ? בסוף
  s = s.replace(/\s\?(\S)/g, (_, next) => ` ${next}`);

  // ─── FIX 3: רווחים לפני סימני פיסוק ───
  s = s.replace(/\s+([?.!:,;])/g, '$1');

  // ─── FIX 4: רווחים כפולים ───
  s = s.replace(/\s+/g, ' ');

  // ─── FIX 5: נקודה בתחילת משפט שנשארה מ-RTL ───
  s = s.replace(/^\.\s*/, '');

  return s.trim();
};

/**
 * cleanOption — ניקוי אופציה (הסרת תווי א/ב/ג/ד + טיפול בנקודות כפולות)
 */
export const cleanOption = (t) => {
  if (!t) return '';
  let s = String(t).trim().replace(INVISIBLE, '');

  // ─── FIX 6: הסרת prefix כמו "א. " / "א . " / "א ." / "1. " ───
  // מטפל גם ב-"א . .טקסט" (שתי נקודות עם רווח)
  s = s.replace(/^[א-ד]\s*\.?\s*\.\s*/, ''); // "א . ." or "א. ."
  s = s.replace(/^[א-ד]\s*\.\s*/,       ''); // "א. " standard
  s = s.replace(/^[1-4]\s*\.\s*/,       ''); // "1. " English numbering

  // נקודה או פסיק סוררים בתחילה שנשארו
  s = s.replace(/^[.,:]\s*/, '');

  // ─── FIX 7: מספרי עמוד בסוף אופציה (OCR artifact) ───
  // "החונות 6" → "החונות" ; לא מוחקים 30,50,80,90,100 שהם מהירויות
  s = s.replace(/\s+(?!30|50|60|70|80|90|100|110|120)(\d{1,2})$/, '');

  // ─── FIX 8: תו " . " לפני מילה עברית (סימן מינוס OCR) ───
  s = s.replace(/\s\.\s([א-ת])/g, ' $1');

  // סוף שורה עם נקודה כפולה
  s = s.replace(/\.\.$/, '.');

  // DB typos
  DB_TYPOS.forEach(([re, rep]) => { s = s.replace(re, rep); });
  
  s = s.replace(/\s+/g, ' ');
  return s.trim();
};

// ─── YOUTUBE EXTRACTOR ────────────────────────────────────────────────────────

const extractVideoId = (text) => {
  if (!text) return null;
  const m = text.match(/(?:v=|v\/|embed\/|youtu\.be\/|watch\?v=)([\w-]{10,11})/);
  return m ? m[1] : null;
};

// ─── MAIN PARSER ──────────────────────────────────────────────────────────────

/**
 * parseQuestion — ממיר שאלה גולמית מ-Supabase למבנה מוכן לתצוגה
 *
 * תומך בשני פורמטי DB:
 *   פורמט A (ישן): option1, option2, option3, option4
 *   פורמט B (seed): options: ["א. ...", "ב. ...", "ג. ...", "ד. ..."]
 */
export const parseQuestion = (q) => {
  if (!q) return null;

  // ─── 1. טקסט השאלה ───
  let text = q.question_text || q.text || '';

  // ─── 2. חילוץ וידאו ─── 
  const vId = extractVideoId(text);
  // הסרת URL מהטקסט
  text = text.replace(/https?:\/\/\S+/g, '').replace(/\\/g, '').trim();

  // ─── 3. OPTIONS: תמיכה בשני פורמטים ───
  let rawOpts;

  if (Array.isArray(q.options) && q.options.length >= 4) {
    // פורמט B: options הוא מערך
    rawOpts = q.options.slice(0, 4);
  } else {
    // פורמט A: שדות נפרדים
    rawOpts = [
      q.option1 ?? q.option_1 ?? '',
      q.option2 ?? q.option_2 ?? '',
      q.option3 ?? q.option_3 ?? '',
      q.option4 ?? q.option_4 ?? '',
    ];
  }

  // ─── 4. אם האופציות ריקות, מנסים לחלץ מטקסט השאלה ───
  const hasOpts = rawOpts.some(o => String(o || '').trim().length > 2);
  if (!hasOpts) {
    const parts = text.split(/\s*[א-ד]\s*[\.\)]\s*/).filter(p => p.trim().length > 2);
    if (parts.length >= 5) {
      text = parts[0];
      rawOpts = parts.slice(1, 5);
    }
  }

  // ─── 5. ניקוי ───
  const displayQ = cleanText(text);
  const displayOpts = rawOpts.map(o => cleanOption(String(o || '')));

  // ─── 6. FIX: correctIdx — מחשב 0-based ───
  //  DB מאחסן 1-based (1,2,3,4) → מחסירים 1
  //  אם נראה כבר 0-based (ערך 0) — לא מחסירים שוב
  let rawCorrect = q.correct_answer_index ?? q.correct_answer ?? q.correct;
  let correctIdx = Number(rawCorrect);
  // אם הערך הוא 1-4 (1-based), הופכים ל-0-based
  if (correctIdx >= 1 && correctIdx <= 4) {
    correctIdx = correctIdx - 1;
  }
  // אם correctIdx עדיין מחוץ לתחום, fallback ל-0
  if (correctIdx < 0 || correctIdx > 3) {
    console.warn(`[parseQuestion] correctIdx out of range: ${correctIdx} for question_id=${q.question_id || q.id}`);
    correctIdx = 0;
  }

  // ─── 7. תמונה ───
  const rawImg = q.image_url || q.image_path || null;
  const image = (rawImg && rawImg !== 'null' && String(rawImg).length > 5) ? rawImg : null;

  return {
    ...q,
    displayQ,
    displayOpts,
    correctIdx,
    vId,
    image,
  };
};