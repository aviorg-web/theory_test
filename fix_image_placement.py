"""
fix_image_placement.py
======================
מתקן מיקום תמונות ב-extracted_study_data.json ללא צורך בחילוץ מחדש מה-PDF.

הלוגיקה:
- כל תמונה מכילה מספר עמוד בשם קובץ: ch_16_p_57_img_425.png → עמוד 57
- הטקסט מכיל קטעים שמגיעים מעמודים שונים
- אנחנו מחלקים את הטקסט ל"גושי עמוד" ומכניסים תמונות בין הגושים

הפעלה:
    python fix_image_placement.py
    python push_study_data.py
"""

import json
import re
import os

INPUT  = "extracted_study_data.json"
BACKUP = "extracted_study_data.BEFORE_IMGFIX.json"

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def get_img_page(img_line: str) -> int:
    """חולץ מספר עמוד משם תמונה: ch_16_p_57_img_425.png → 57"""
    m = re.search(r'_p_(\d+)_', img_line)
    return int(m.group(1)) if m else 9999

def is_logo(img_line: str) -> bool:
    """מסנן לוגו לפי שם קובץ"""
    return bool(re.search(r'_img_(35|34|1|2)\.', img_line))

def get_img_xref(img_line: str) -> int:
    """חולץ xref מהשם לסינון לוגואים קטנים"""
    m = re.search(r'_img_(\d+)\.', img_line)
    return int(m.group(1)) if m else 0

# ─── PARAGRAPH MERGER (from rebuild_paragraphs.py) ───────────────────────────

def is_heading(text: str) -> bool:
    t = text.strip()
    if len(t) > 80: return False
    if t.endswith(':'): return True
    if re.match(r'^\d+[\.\)]\s', t): return True
    if not t or t[-1] in '.!?,;)': return False
    return len(t.split()) <= 6

def is_bullet(text: str) -> bool:
    t = text.strip()
    return t.startswith('•') or t.startswith('-') or bool(re.match(r'^\d+\.', t))

def ends_sentence(text: str) -> bool:
    t = text.strip()
    return bool(t) and t[-1] in '.!?:'

# ─── MAIN: FIX IMAGE PLACEMENT ───────────────────────────────────────────────

def fix_chapter(md: str, chapter_num: int) -> str:
    """
    1. מחלץ תמונות ומסדר לפי עמוד
    2. מפצל טקסט לקטעים
    3. מכניס תמונות בנקודות הנכונות לפי עמוד
    """
    lines = md.split('\n')

    # ── שלב 1: אסוף תמונות לפי עמוד ──────────────────────────────────────────
    images_by_page = {}  # {page_num: [img_line, ...]}
    text_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith('!['):
            # סנן לוגו
            xref = get_img_xref(stripped)
            if is_logo(stripped) or xref < 30:  # xref קטן = לוגו
                continue
            page = get_img_page(stripped)
            if page not in images_by_page:
                images_by_page[page] = []
            # מנע כפילויות
            if stripped not in images_by_page[page]:
                images_by_page[page].append(stripped)
        else:
            text_lines.append(line)

    if not images_by_page:
        # אין תמונות — החזר טקסט מנוקה
        return '\n'.join(text_lines)

    sorted_pages = sorted(images_by_page.keys())
    min_img_page = min(sorted_pages)
    max_img_page = max(sorted_pages)

    # ── שלב 2: אמוד כמה שורות טקסט יש לכל עמוד ───────────────────────────────
    # נניח שהטקסט מחולק שווה בין מספר עמודים
    non_empty_text = [l for l in text_lines if l.strip() and not l.strip().startswith('!')]
    total_text_lines = len(non_empty_text)

    # ── שלב 3: מצא "נקודות הכנסה" לכל עמוד בטקסט ───────────────────────────
    # סוגים של נקודות הכנסה טובות:
    # - אחרי כותרת
    # - בסוף פסקה (שורה שמסתיימת בנקודה)
    # - לפני כותרת חדשה

    # מצא כל הנקודות הטובות להכנסה
    insertion_points = []  # [(line_idx, score)]
    for i, line in enumerate(text_lines):
        t = line.strip()
        if not t: continue
        score = 0
        if ends_sentence(t): score += 3
        if is_heading(t): score += 2
        if i > 0 and not text_lines[i-1].strip(): score += 1
        if score > 0:
            insertion_points.append((i, score))

    if not insertion_points:
        # אין נקודות הכנסה — הכנס בסוף
        result = '\n'.join(text_lines)
        for page in sorted_pages:
            for img in images_by_page[page]:
                result += f'\n\n{img}'
        return result

    # ── שלב 4: חלק נקודות הכנסה בין עמודים ──────────────────────────────────
    # כל עמוד עם תמונות מקבל נקודת הכנסה משלו
    n_pages = len(sorted_pages)
    n_points = len(insertion_points)

    # מפה: page → insertion_point_index
    page_to_insert = {}
    if n_pages == 1:
        # עמוד אחד — הכנס אחרי חצי הטקסט
        mid = n_points // 2
        page_to_insert[sorted_pages[0]] = insertion_points[mid][0]
    else:
        # חלק שווה
        step = n_points / n_pages
        for idx, page in enumerate(sorted_pages):
            pt_idx = min(int(idx * step + step * 0.8), n_points - 1)
            page_to_insert[page] = insertion_points[pt_idx][0]

    # ── שלב 5: בנה מחדש עם תמונות ──────────────────────────────────────────
    # מיין עמודים לפי נקודת הכנסה (גדול→קטן, כדי שהכנסות לא יזיזו אינדקסים)
    inserts_sorted = sorted(page_to_insert.items(), key=lambda x: x[1], reverse=True)

    result_lines = text_lines.copy()
    for page, insert_idx in inserts_sorted:
        imgs = images_by_page.get(page, [])
        if not imgs: continue
        # בנה בלוק תמונות
        img_block = [''] + imgs + ['']
        result_lines[insert_idx:insert_idx] = img_block

    result = '\n'.join(result_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(INPUT):
        print(f"❌ לא נמצא: {INPUT}")
        return

    print(f"📦 גיבוי → {BACKUP}")
    with open(INPUT, 'r', encoding='utf-8') as f:
        raw = f.read()
    with open(BACKUP, 'w', encoding='utf-8') as f:
        f.write(raw)

    data = json.loads(raw)
    print(f"📖 {len(data)} פרקים\n")

    for ch in data:
        original = ch.get('content_md', '')
        if not original:
            continue

        # ספור תמונות לפני
        imgs_before = original.count('![Image]')
        logos_before = len([l for l in original.split('\n') if re.search(r'_img_(35|34)\.', l)])

        fixed = fix_chapter(original, ch['chapter_number'])

        imgs_after = fixed.count('![Image]')

        print(f"  פרק {ch['chapter_number']:2d}: {ch['title'][:30]}")
        print(f"         תמונות: {imgs_before}→{imgs_after} | לוגו הוסרו: {logos_before}")

        ch['content_md'] = fixed

    print(f"\n💾 שומר: {INPUT}")
    with open(INPUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ סיום! עכשיו הרץ: python push_study_data.py")


if __name__ == "__main__":
    main()
