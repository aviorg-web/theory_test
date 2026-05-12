/**
 * מעבד שאלה גולמית שמתקבלת מ-Supabase,
 * מנקה טקסטים, מחלץ וידאו, ומטפל בקישורי תמונות ריקים.
 */

const fixOcr = (t) => {
  if (!t) return '';
  let s = String(t).trim();
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // תיקון סימני פיסוק שהגיעו להתחלה במקום לסוף
  if (/^[:\?\.-]/.test(s)) s = s.slice(1).trim() + s.charAt(0);
  
  // הלחמת מילים קטועות עם נקודה בטעות
  s = s.replace(/([א-ת])\s*\.\s*([א-ת])/g, '$1$2');
  
  // הלחמת מילים שפוצלו בטעות וספציפיות
  s = s.replace(/עלי כם/g, 'עליכם').replace(/ל נהוג/g, 'לנהוג');
  
  return s.replace(/\s+/g, ' ').trim();
};

export const processQuestion = (q) => {
  if (!q) return null;

  let text = q.question_text || q.text || "";
  let opts = [
    q.option1 || q.option_1 || "",
    q.option2 || q.option_2 || "",
    q.option3 || q.option_3 || "",
    q.option4 || q.option_4 || ""
  ];

  // 1. חילוץ וידאו ומחיקת הלינק מהטקסט
  const vMatch = text.match(/(?:v=|v\/|embed\/|youtu.be\/|watch\?v=)([\w-]{11})/);
  const videoId = vMatch ? vMatch[1] : null;
  text = text.replace(/https?:\/\/[^\s]+/g, '').trim();

  // 2. פיצול אגרסיבי: תשובות בתוך שדה השאלה
  if (text.includes(' א.') || text.includes(' ב.')) {
    const parts = text.split(/\s*[א-ד][\.\s']+/).filter(p => p.trim().length > 2);
    if (parts.length >= 5) {
      text = parts[0];
      opts = [parts[1], parts[2], parts[3], parts[4]];
    }
  }

  // 3. שיקום OCR
  const displayQ = fixOcr(text);
  const displayOpts = opts.map(fixOcr);

  // 4. ניקוי תמרורים
  let imageUrl = q.image_url;
  if (!imageUrl || imageUrl === 'null' || imageUrl.trim() === '') {
    imageUrl = null;
  }

  const correctIdx = Number(q.correct_answer_index !== undefined ? q.correct_answer_index : q.correct);

  return {
    ...q,
    displayQ,
    displayOpts,
    correctIdx,
    videoId,
    image_url: imageUrl
  };
};
