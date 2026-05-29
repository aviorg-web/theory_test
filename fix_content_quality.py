"""
fix_content_quality.py — תיקון מיידי ל-extracted_study_data.json
=================================================================
מתקן 3 באגים שנמצאו:

  Bug 1: כותרות עמוד (header/footer) שדלפו לתוכן (88 שורות בכל הפרקים)
         סיבה: is_header_footer() רץ לפני reverse_visual_line()
         תיקון: סינון POST-reverse

  Bug 2: מילים שנחתכו ע"י OCR: "תעבור ה" → "תעבורה" (149 occurrences)
         סיבה: pdfplumber מזהה רווח בין אותיות בפונט עברי
         תיקון: regex מוחלש לאיחוד סיומות מילה

  Bug 3: נקודות ופסיק עם רווח שגוי: "להאט ." → "להאט."

הפעלה:
  python3 fix_content_quality.py
  
לאחר הפעלה — הרץ: python3 push_study_data.py
"""

import json
import re
import os

INPUT_FILE = "extracted_study_data.json"
BACKUP_FILE = "extracted_study_data.BACKUP.json"

# ─── BUG 1: HEADER/FOOTER PATTERNS ──────────────────────────────────────────
# אחרי reverse_visual_line() — אלו הם הטקסטים שצריך לסנן

HEADER_PATTERNS = [
    r'בס.?ד',                        # בס"ד / בס״ד
    r'אריה משה',
    r'רוני מצליח',
    r'מרגלית רטר',
    r'יואל דקל',
    r'יובל יונה',
    r'^\s*\d{1,3}\s*$',             # מספרי עמוד בלבד
]
HEADER_RE = re.compile('|'.join(HEADER_PATTERNS))


def is_header_footer(line: str) -> bool:
    return bool(HEADER_RE.search(line))


# ─── BUG 2: WORD SPLIT FIXER ─────────────────────────────────────────────────

def fix_word_splits(s: str) -> str:
    """מאחד מילים שנחתכו ע"י OCR."""

    # אותיות סופיות — לעולם לא מתחילות מילה בעברית
    s = re.sub(r'([א-ת]{2,6}) ([ןםףך])(?=[ ,.\n!?:;–\-]|$)', r'\1\2', s, flags=re.MULTILINE)

    # סיומות 2 אותיות נפוצות: ות ים ית
    s = re.sub(r'([א-ת]{2,5}) (ות|ים|ית)(?=[ ,.\n!?:;–\-]|$)', r'\1\2', s, flags=re.MULTILINE)

    # סיומות 1 אות: י ה ת
    s = re.sub(r'([א-ת]{2,5}) ([יהת])(?=[ ,.\n!?:;–\-]|$)', r'\1\2', s, flags=re.MULTILINE)

    # ל בסוף — רק עם בסיס קצר (2 תווים) למניעת false positives כמו "ידי ל"
    s = re.sub(r'([א-ת]{2,2}) ([ל])(?=[ ,.\n!?:;–\-]|$)', r'\1\2', s, flags=re.MULTILINE)

    return s


# ─── BUG 3: PUNCTUATION ──────────────────────────────────────────────────────

def fix_punctuation(s: str) -> str:
    """מתקן פיסוק שנדחק בטעות."""

    # רווח לפני פיסוק בסוף שורה: "להאט ." → "להאט."
    s = re.sub(r'[ \t]+([.?!,;:])(\s*$)', r'\1\2', s, flags=re.MULTILINE)

    # רווח לפני נקודותיים: "הגדרות :" → "הגדרות:"
    s = re.sub(r'[ \t]+:', ':', s)

    # נקודה בין מילים עבריות ללא רווח: "לנסוע.מהר" → "לנסוע. מהר"
    s = re.sub(r'([א-ת])\.([א-ת])', r'\1. \2', s)

    # רווחים כפולים
    s = re.sub(r'[ \t]{2,}', ' ', s)

    # שורות ריקות מרובות (יותר מ-2)
    s = re.sub(r'\n{3,}', '\n\n', s)

    return s


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def clean_content_md(md: str) -> str:
    """מנקה content_md מלא."""
    lines = md.split('\n')
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()
        # Bug 1: סנן headers/footers שדלפו
        if is_header_footer(stripped):
            continue
        cleaned_lines.append(line)

    text = '\n'.join(cleaned_lines)

    # Bug 2: תיקון מילים שנחתכו
    text = fix_word_splits(text)

    # Bug 3: תיקון פיסוק
    text = fix_punctuation(text)

    return text.strip()


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ לא נמצא: {INPUT_FILE}")
        return

    # גיבוי
    print(f"📦 יוצר גיבוי: {BACKUP_FILE}")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        raw = f.read()
    with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
        f.write(raw)

    data = json.loads(raw)
    print(f"📖 נטענו {len(data)} פרקים")

    stats = {'headers_removed': 0, 'chapters_fixed': 0}

    for ch in data:
        original_md = ch.get('content_md', '')
        if not original_md:
            continue

        # ספירת headers לפני ניקוי
        headers_before = sum(
            1 for line in original_md.split('\n')
            if is_header_footer(line.strip())
        )
        stats['headers_removed'] += headers_before

        cleaned = clean_content_md(original_md)
        ch['content_md'] = cleaned
        stats['chapters_fixed'] += 1

        print(f"  פרק {ch['chapter_number']} ({ch['title'][:30]}...) — "
              f"הוסרו {headers_before} כותרות, "
              f"{len(original_md) - len(cleaned):+d} תווים")

    # שמירה
    print(f"\n💾 שומר: {INPUT_FILE}")
    with open(INPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ סיום!")
    print(f"   כותרות שהוסרו: {stats['headers_removed']}")
    print(f"   פרקים שתוקנו:  {stats['chapters_fixed']}")
    print(f"\n👉 עכשיו הרץ:  python3 push_study_data.py")


if __name__ == "__main__":
    main()
