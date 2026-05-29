#!/bin/bash
# deploy.sh — פריסה מלאה של גרסה חדשה
# הרץ מתוך תיקיית הפרויקט: bash deploy.sh

set -e  # עצור אם יש שגיאה

echo ""
echo "🚀 Theory AI — פריסה גרסה חדשה"
echo "================================"

# בדיקה שנמצאים בתיקייה הנכונה
if [ ! -f "frontend/package.json" ]; then
  echo "❌ שגיאה: הרץ את הסקריפט מתיקיית הפרויקט הראשית (theory_test)"
  exit 1
fi

echo ""
echo "📋 שלב 1/4 — בדיקת קבצים..."
FILES=(
  "frontend/src/App.jsx"
  "frontend/src/components/Academy.jsx"
  "frontend/src/utils/adaptiveEngine.js"
  "frontend/src/utils/questionParser.js"
  "frontend/src/utils/contentCleaner.js"
)
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then echo "  ✅ $f"; else echo "  ❌ חסר: $f"; exit 1; fi
done

echo ""
echo "📦 שלב 2/4 — Git add..."
git add \
  frontend/src/App.jsx \
  frontend/src/components/Academy.jsx \
  frontend/src/utils/adaptiveEngine.js \
  frontend/src/utils/questionParser.js \
  frontend/src/utils/contentCleaner.js \
  extracted_study_data.json \
  fix_content_quality.py

echo ""
echo "💬 שלב 3/4 — Commit..."
git commit -m "feat: גרסה חדשה — UI כהה, למידה אדפטיבית, ניקוי תוכן

- App.jsx: Landing חדש, Dashboard עם ציון מוכנות ואזורים חלשים
- Academy.jsx: Progress rings, תרגול אדפטיבי, חווית לימוד משופרת
- adaptiveEngine.js: מנוע למידה אדפטיבי חדש
- questionParser.js: תיקון 8 באגי RTL ותצוגה
- contentCleaner.js: ניקוי OCR artifacts מחוברת הלימוד
- extracted_study_data.json: 88 כותרות הוסרו, 149 מילים תוקנו"

echo ""
echo "☁️  שלב 4/4 — Push ל-GitHub..."
git push origin main

echo ""
echo "✅ הצלחה! הקוד עלה ל-GitHub."
echo ""
echo "⏳ Vercel מתחיל פריסה אוטומטית — בדרך כלל 1-2 דקות."
echo "🌐 עקוב ב: https://vercel.com/dashboard"
echo ""
