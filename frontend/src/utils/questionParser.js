export const cleanText = (t) => {
  if (!t) return '';
  let s = String(t).trim();
  // הסרת תווים בלתי נראים
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // תיקוני שגיאות כתיב ורווחים מוכרים מהמאגר (DB Typos)
  s = s.replace(/לפני כם/g, 'לפניכם');
  s = s.replace(/הס פ ק/g, 'הספק');
  s = s.replace(/אי־ודאות/g, 'אי ודאות');
  s = s.replace(/איזה\?\s*עיקרון/g, 'איזה עיקרון');
  
  // תיקון כללי לרווחים לפני סימני פיסוק (למשל "הבולטות .")
  s = s.replace(/\s+([?.!:,;])/g, '$1');

  // תיקון סימני פיסוק בתחילת משפט (הזזה לסוף)
  s = s.replace(/^([?.!])\s*(.*)/, '$2$1');

  // תיקון סימני פיסוק שנדחפו לאמצע מילה (כמו "מרחק? התגובה" -> "מרחק התגובה?")
  s = s.replace(/\s+([?.!])([א-ת]+)/g, ' $2$1');

  // רווח אחרי אותיות יחס ("מ גדיל" -> "מגדיל")
  s = s.replace(/\b([מכשבל])\s+([א-ת]{3,})\b/g, '$1$2');

  // ריווח למספרים דבוקים למילה "מס"
  s = s.replace(/(\bמס)([0-9]+)\b/g, "$1' $2");

  // מילון
  s = s.replace(/התוצאותשלהן/g, 'התוצאות שלהן');
  s = s.replace(/שמאלההיכן/g, 'שמאלה היכן');
  s = s.replace(/באיורשלפניכםאל/g, 'באיור שלפניכם אל');
  s = s.replace(/מלפניםשמירת/g, 'מלפנים שמירת');
  s = s.replace(/עליכםלנהוג/g, 'עליכם לנהוג');
  s = s.replace(/השאלהשאחריו/g, 'השאלה שאחריו');
  s = s.replace(/שימו :לב/g, 'שימו לב:');
  s = s.replace(/מפעםאחת/g, 'מפעם אחת');

  return s.replace(/\s+/g, ' ').trim();
};

export const cleanOption = (t) => {
  if (!t) return '';
  let s = cleanText(t);
  s = s.replace(/^[א-ד]\s*\.\s*/, '');
  s = s.replace(/\s*[א-ד]\s*\.$/, '');
  
  // מחיקת מספרי עמודים סוררים בסוף משפט (כמו "47" או "46") אבל שמירה על מספרים הגיוניים לתשובות כמו 50, 30
  if (s.length > 10) {
     s = s.replace(/\s+(?!30|50|80|90|100)(\d{1,3})$/, '');
  }
  
  // ניקוי נקודה סוררת בתחילת אופציה שנובעת ממעברי שורה .עליכם לתת
  s = s.replace(/^\.\s*/, '');
  
  return s.trim();
};

export const parseQuestion = (q) => {
  if (!q) return null;

  let text = q.question_text || q.text || "";
  let opts = [q.option1 || q.option_1, q.option2 || q.option_2, q.option3 || q.option_3, q.option4 || q.option_4];

  // זיהוי וידאו מתקדם
  let vIdMatch = text.match(/(?:v=|v\/|embed\/|youtu\.be\/|watch\?v=)\s*\\?\s*([\w-]{10,11})/);
  let vId = vIdMatch ? vIdMatch[1] : null;
  
  if (!vId && text.toLowerCase().includes('youtube')) {
    const fallbackMatch = text.match(/[A-Za-z0-9_-]{10,11}/g);
    if (fallbackMatch && fallbackMatch.length > 0) {
       const potentialId = fallbackMatch.find(m => m.toLowerCase() !== 'youtube' && m.toLowerCase() !== 'https' && m.toLowerCase() !== 'watch');
       if (potentialId) vId = potentialId;
    }
  }

  // חילוץ אופציות מתקדם (אם הן נדבקו לשאלה)
  let combinedOptionsText = '';
  if (!opts[1] || !opts[2] || !opts[3]) {
    const matchA = text.match(/(.*?)(?:^|\s*)[\.\)]?\s*א\s*[\.\)]\s*(.+)$/);
    if (matchA) {
      text = matchA[1];
      combinedOptionsText = 'א. ' + matchA[2] + ' ' + (opts[0] || '');
    } else if (!opts[0] || opts[0].length < 2) {
      combinedOptionsText = text;
    } else {
      combinedOptionsText = (opts[0] || '');
    }
  }

  if (combinedOptionsText) {
    const parts = combinedOptionsText.split(/(?:^|\s*)[\.\)]?\s*(?:א|ב|ג|ד|1|2|3|4)\s*[\.\)]\s*/).filter(p => p.trim().length > 1);
    if (parts.length >= 4) {
      opts = parts.slice(-4);
      if (combinedOptionsText === text) {
        text = parts.slice(0, -4).join(' ');
      }
    }
  }

  const cleanDisplayQ = cleanText(text.replace(/https?:\/\/[^\s]+/g, '').replace(new RegExp(vId || 'dummynothing', 'g'), '').replace(/\\/g, '').replace(/\s*-\s*(?=[א-ת])/g, ' '));

  return {
    ...q,
    displayQ: cleanDisplayQ,
    displayOpts: opts.map(cleanOption),
    correctIdx: Number(q.correct_answer_index !== undefined ? q.correct_answer_index : q.correct) - 1,
    vId,
    image: (q.image_url && q.image_url !== "null" && q.image_url.length > 5) ? q.image_url : null
  };
};
