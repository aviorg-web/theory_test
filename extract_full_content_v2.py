"""
extract_full_content.py — FIXED v2
===================================
תיקון מרכזי: תמונות מוצבות INLINE לפי מיקום Y האמיתי ב-PDF
(הגרסה הקודמת שמה תמונות בסוף עם y=9999)
"""
import fitz
import pdfplumber
import os
import json
import re
from PIL import Image
import io

# ─── HEADER/FOOTER FILTER ────────────────────────────────────────────────────

def is_header_footer(text):
    """בודק אחרי reverse_visual_line"""
    if 'בס"ד' in text or 'בס״ד' in text: return True
    if 'אריה משה' in text or 'רוני מצליח' in text or 'מרגלי' in text: return True
    if re.match(r'^\s*\d{1,3}\s*$', text): return True
    return False

def reverse_visual_line(line):
    rev_line = line[::-1]
    return re.sub(r'[A-Za-z0-9]+', lambda m: m.group()[::-1], rev_line)

# ─── LOGO DETECTION ──────────────────────────────────────────────────────────

LOGO_XREFS = set()  # ימולא בזמן ריצה

def is_logo_image(img_data, width, height):
    """מזהה לוגואים קטנים שאינם תוכן לימודי"""
    # תמונות קטנות מאוד = לוגו/סמל
    if width < 120 and height < 120: return True
    # יחס גובה/רוחב קיצוני = לוגו
    if width > 0 and height > 0:
        ratio = max(width, height) / min(width, height)
        if ratio > 4: return True
    return False

# ─── MAIN EXTRACTION ─────────────────────────────────────────────────────────

def extract_full_content(pdf_path, output_json, img_output_dir):
    print(f"Starting advanced extraction for: {pdf_path}")
    os.makedirs(img_output_dir, exist_ok=True)

    try:
        fitz_doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Failed to open PDF: {e}")
        return

    toc = fitz_doc.get_toc()
    chapters = []
    for i in range(len(toc)):
        lvl, title, page = toc[i]
        if lvl != 1: continue
        next_page = fitz_doc.page_count
        for j in range(i+1, len(toc)):
            if toc[j][0] == 1:
                next_page = toc[j][2]
                break
        chapters.append({
            'chapter_number': i + 1,
            'title': title,
            'start_page': page - 1,
            'end_page': next_page - 1
        })

    all_chapters_data = []

    print("Opening PDF with pdfplumber for RTL text + fitz for images...")
    with pdfplumber.open(pdf_path) as pb_doc:
        for ch in chapters:
            try:
                print(f"Chapter {ch['chapter_number']}: {ch['title']}")
            except UnicodeEncodeError:
                print(f"Chapter {ch['chapter_number']}")

            chapter_elements = []
            seen_images = set()

            for p_num in range(ch['start_page'], ch['end_page']):
                page_elements = []

                # ── 1. TEXT with real Y positions ──────────────────────────
                pb_page = pb_doc.pages[p_num]

                # חילוץ מילים עם מיקום Y
                try:
                    words = pb_page.extract_words(
                        x_tolerance=3,
                        y_tolerance=3,
                        keep_blank_chars=False,
                        use_text_flow=False
                    )
                except:
                    words = []

                if words:
                    # קיבוץ מילים לשורות לפי Y
                    lines_by_y = {}
                    for w in words:
                        y_key = round(w['top'] / 5) * 5  # עיגול ל-5px
                        if y_key not in lines_by_y:
                            lines_by_y[y_key] = []
                        lines_by_y[y_key].append(w)

                    for y_key in sorted(lines_by_y.keys()):
                        line_words = lines_by_y[y_key]
                        # מיון מילים מימין לשמאל (RTL)
                        line_words.sort(key=lambda w: -w['x0'])
                        line_text = ' '.join(w['text'] for w in line_words)
                        line_text = line_text.strip()

                        if not line_text: continue

                        # תיקון RTL
                        fixed = reverse_visual_line(line_text)

                        # סינון header/footer אחרי reverse
                        if is_header_footer(fixed): continue
                        if is_header_footer(line_text): continue

                        page_elements.append({
                            "type": "text",
                            "content": fixed,
                            "y": y_key,
                            "page": p_num + 1
                        })
                else:
                    # fallback לשיטה הישנה
                    text_content = pb_page.extract_text(layout=False)
                    if text_content:
                        lines = text_content.split('\n')
                        for i, line in enumerate(lines):
                            line = line.strip()
                            if not line: continue
                            fixed = reverse_visual_line(line)
                            if is_header_footer(fixed): continue
                            if is_header_footer(line): continue
                            page_elements.append({
                                "type": "text",
                                "content": fixed,
                                "y": i * 15,  # Y משוער
                                "page": p_num + 1
                            })

                # ── 2. IMAGES with corrected Y positions ────────────────
                fitz_page = fitz_doc[p_num]
                page_height = fitz_page.rect.height  # גובה העמוד בנקודות

                try:
                    images_info = fitz_page.get_image_info(xrefs=True)
                    for img_info in images_info:
                        xref = img_info.get("xref")
                        if not xref: continue

                        bbox = img_info.get("bbox", (0, 0, 0, 0))
                        # ─── FIX: קואורדינטות ב-PyMuPDF ───────────────
                        # נקודת (0,0) ב-fitz (ברירת מחדל) היא בפינה השמאלית העליונה, ממש כמו ב-pdfplumber.
                        # לכן bbox[1] הוא קצה ה-Y העליון של התמונה בעמוד.
                        img_y_screen = bbox[1]

                        img_w = bbox[2] - bbox[0]
                        img_h = bbox[3] - bbox[1]

                        try:
                            base_image = fitz_doc.extract_image(xref)
                            if not base_image: continue

                            # בדיקת גודל תמונה מהנתונים האמיתיים
                            img_bytes = base_image["image"]
                            try:
                                pil_img = Image.open(io.BytesIO(img_bytes))
                                real_w, real_h = pil_img.size
                            except:
                                real_w, real_h = int(img_w), int(img_h)

                            # סינון לוגואים
                            if is_logo_image(img_bytes, real_w, real_h):
                                continue

                            ext = base_image["ext"]
                            img_filename = f"ch_{ch['chapter_number']}_p_{p_num+1}_img_{xref}.{ext}"

                            # סינון תמונות כפולות
                            if img_filename in seen_images: continue
                            seen_images.add(img_filename)

                            img_path = os.path.join(img_output_dir, img_filename)
                            if not os.path.exists(img_path):
                                with open(img_path, "wb") as f:
                                    f.write(img_bytes)

                            page_elements.append({
                                "type": "image",
                                "src": img_filename,
                                "y": img_y_screen,  # ✅ Y מסך נכון — inline!
                                "page": p_num + 1
                            })
                        except Exception:
                            pass
                except Exception:
                    pass

                # ── 3. LINKS / VIDEOS ───────────────────────────────────────
                try:
                    links = fitz_page.get_links()
                    for link in links:
                        uri = link.get("uri")
                        if not uri: continue
                        rect = link.get("from", fitz.Rect(0, 0, 0, 0))
                        is_video = any(v in uri.lower() for v in ['youtube', 'youtu.be', 'vimeo', '.mp4'])
                        page_elements.append({
                            "type": "video" if is_video else "link",
                            "url": uri,
                            "y": rect.y0 if hasattr(rect, 'y0') else 50000,
                            "page": p_num + 1
                        })
                except Exception:
                    pass

                # מיון לפי Y אמיתי
                page_elements.sort(key=lambda x: x["y"])
                chapter_elements.extend(page_elements)

            # ── BUILD MARKDOWN ──────────────────────────────────────────────
            markdown_lines = []
            prev_type = None

            for el in chapter_elements:
                t = el["type"]
                if t == "text":
                    markdown_lines.append(el["content"] + "  ")
                    if prev_type == "image":
                        markdown_lines.append("")  # רווח אחרי תמונה
                elif t == "image":
                    if prev_type == "text":
                        markdown_lines.append("")  # רווח לפני תמונה
                    markdown_lines.append(f"![Image](extracted_media/{el['src']})")
                    markdown_lines.append("")
                elif t == "video":
                    markdown_lines.append(f"\n**[🎥 סרטון]({el['url']})**\n")
                elif t == "link":
                    markdown_lines.append(f"*[קישור]({el['url']})*")
                prev_type = t

            markdown_content = "\n".join(markdown_lines)
            # ניקוי שורות ריקות מרובות
            markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content).strip()

            all_chapters_data.append({
                "chapter_number": ch['chapter_number'],
                "title": ch['title'],
                "content_md": markdown_content
            })

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(all_chapters_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Extraction complete! {len(all_chapters_data)} chapters → {output_json}")


if __name__ == "__main__":
    PDF_FILE   = "study_book.pdf"
    OUTPUT_JSON = "extracted_study_data.json"
    IMG_DIR    = "extracted_media"
    extract_full_content(PDF_FILE, OUTPUT_JSON, IMG_DIR)
