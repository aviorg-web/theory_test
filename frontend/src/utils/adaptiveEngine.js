/**
 * adaptiveEngine.js
 * מנוע למידה אדפטיבי — מעקב ביצועים + שקלול שאלות
 * מאחסן ב-localStorage לפי תעודת זהות תלמיד
 */

const KEY = (tz) => `adaptive_v2_${tz}`;

// ─── READ / WRITE ─────────────────────────────────────────────────────────────

const load = (tz) => {
  try {
    return JSON.parse(localStorage.getItem(KEY(tz)) || '{}');
  } catch { return {}; }
};

const save = (tz, data) => {
  try { localStorage.setItem(KEY(tz), JSON.stringify(data)); } catch {}
};

// ─── RECORD ANSWER ───────────────────────────────────────────────────────────

/**
 * recordAnswer — מתעד תשובה לשאלה
 * @param {string} tz — תעודת זהות תלמיד
 * @param {string|number} questionId — מזהה שאלה
 * @param {boolean} correct — האם ענה נכון
 */
export const recordAnswer = (tz, questionId, correct) => {
  if (!tz || !questionId) return;
  const data = load(tz);
  const qid = String(questionId);
  const prev = data[qid] || { attempts: 0, wrong: 0, lastSeen: 0 };
  data[qid] = {
    attempts: prev.attempts + 1,
    wrong: correct ? prev.wrong : prev.wrong + 1,
    lastSeen: Date.now(),
  };
  save(tz, data);
};

// ─── COMPUTE WEIGHT ──────────────────────────────────────────────────────────

/**
 * computeWeight — מחשב משקל לשאלה (ככל שגבוה יותר, כדאי לשאול שוב)
 * - שגיאות = משקל גבוה
 * - שאלות שלא נשאלו = משקל בינוני (חדשות)
 * - שאלות נכונות עדכניות = משקל נמוך
 */
const computeWeight = (record) => {
  if (!record || record.attempts === 0) return 5; // חדשה — עדיפות בינונית

  const errorRate = record.wrong / record.attempts; // 0–1
  const daysSince = (Date.now() - record.lastSeen) / (1000 * 60 * 60 * 24);
  const recency = Math.min(daysSince / 3, 1); // max boost אחרי 3 ימים

  // נוסחה: שגיאות גבוהות + זמן שעבר = עדיפות גבוהה
  return errorRate * 10 + recency * 3 + (errorRate > 0 ? 2 : 0);
};

// ─── SELECT QUESTIONS ─────────────────────────────────────────────────────────

/**
 * selectAdaptiveQuestions — בוחר שאלות לפי ביצועי תלמיד
 * @param {string} tz
 * @param {Array} allQuestions — כל שאלות הפרק
 * @param {number} count — כמה שאלות לבחור
 * @returns {Array} — שאלות ממויינות לפי עדיפות אדפטיבית
 */
export const selectAdaptiveQuestions = (tz, allQuestions, count = 15) => {
  if (!allQuestions?.length) return [];
  const data = load(tz);

  const weighted = allQuestions.map(q => ({
    q,
    weight: computeWeight(data[String(q.id || q.question_id)]),
    rand: Math.random(), // שבירת שוויון
  }));

  // מיון: קודם שאלות עם משקל גבוה, עם רנדומיזציה קלה בתוך קבוצות
  weighted.sort((a, b) => (b.weight + b.rand * 0.5) - (a.weight + a.rand * 0.5));

  return weighted.slice(0, count).map(x => x.q);
};

// ─── WEAK AREAS ──────────────────────────────────────────────────────────────

/**
 * getWeakAreas — מחזיר רשימת פרקים עם ביצועים חלשים
 * @param {string} tz
 * @param {Array} allQuestions — כל השאלות עם chapter_number
 * @returns {Array<{chapter, errorRate, count}>}
 */
export const getWeakAreas = (tz, allQuestions) => {
  const data = load(tz);
  const chapters = {};

  allQuestions.forEach(q => {
    const qid = String(q.id || q.question_id);
    const ch = String(q.chapter_number || '');
    if (!ch) return;
    if (!chapters[ch]) chapters[ch] = { wrong: 0, attempts: 0 };
    const rec = data[qid];
    if (rec?.attempts > 0) {
      chapters[ch].wrong += rec.wrong;
      chapters[ch].attempts += rec.attempts;
    }
  });

  return Object.entries(chapters)
    .filter(([, v]) => v.attempts > 0)
    .map(([ch, v]) => ({
      chapter: ch,
      errorRate: v.wrong / v.attempts,
      attempts: v.attempts,
    }))
    .filter(x => x.errorRate > 0.3) // רק אזורים חלשים ממשית
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 3);
};

// ─── READINESS SCORE ─────────────────────────────────────────────────────────

/**
 * getReadinessScore — ציון מוכנות 0–100
 * @param {string} tz
 * @param {Array} allQuestions
 */
export const getReadinessScore = (tz, allQuestions) => {
  const data = load(tz);
  const seen = allQuestions.filter(q => data[String(q.id || q.question_id)]?.attempts > 0);
  if (seen.length === 0) return 0;

  const coverage = Math.min(seen.length / Math.max(allQuestions.length, 1), 1);
  const totalAttempts = Object.values(data).reduce((s, r) => s + r.attempts, 0);
  const totalCorrect = Object.values(data).reduce((s, r) => s + (r.attempts - r.wrong), 0);
  const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

  return Math.round(coverage * 40 + accuracy * 60);
};

// ─── CHAPTER STATS ───────────────────────────────────────────────────────────

/**
 * getChapterStats — סטטיסטיקה לפרק
 * @param {string} tz
 * @param {Array} chapterQuestions — שאלות הפרק
 * @returns {{ answered, total, accuracy }}
 */
export const getChapterStats = (tz, chapterQuestions) => {
  const data = load(tz);
  let answered = 0, correct = 0;

  chapterQuestions.forEach(q => {
    const rec = data[String(q.id || q.question_id)];
    if (rec?.attempts > 0) {
      answered++;
      correct += rec.attempts - rec.wrong;
    }
  });

  return {
    answered,
    total: chapterQuestions.length,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
  };
};
