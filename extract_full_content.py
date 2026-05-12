import fitz
import pdfplumber
import os
import json
import re

def is_header_footer(text):
    if 'בס"ד' in text or 'אריה משה' in text or 'רוני מצליח' in text or 'מרגלי' in text:
        return True
    if re.match(r'^\s*\d+\s*$', text):
        return True
    return False

def reverse_visual_line(line):
    # הופך את כל השורה
    rev_line = line[::-1]
    # מחזיר מספרים ומילים באנגלית לסדר הנכון
    return re.sub(r'[A-Za-z0-9]+', lambda m: m.group()[::-1], rev_line)

def extract_full_content(pdf_path, output_json, img_output_dir):
    print(f"Starting advanced extraction for: {pdf_path}")
    os.makedirs(img_output_dir, exist_ok=True)
    
    try:
        fitz_doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Failed to open PDF with PyMuPDF: {e}")
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

    print("Opening PDF with pdfplumber for perfect RTL layout parsing...")
    with pdfplumber.open(pdf_path) as pb_doc:
        for ch in chapters:
            try:
                print(f"Extracting Chapter {ch['chapter_number']}: {ch['title']}")
            except UnicodeEncodeError:
                print(f"Extracting Chapter {ch['chapter_number']}")
            
            chapter_elements = []
            
            for p_num in range(ch['start_page'], ch['end_page']):
                # 1. חילוץ טקסט עם pdfplumber (שומר על סדר ויזואלי מושלם שקל להפוך)
                pb_page = pb_doc.pages[p_num]
                text_content = pb_page.extract_text(layout=False)
                
                if text_content:
                    lines = text_content.split('\n')
                    for i, line in enumerate(lines):
                        line = line.strip()
                        if line and not is_header_footer(line):
                            # הפיכת השורה הויזואלית חזרה ללוגית (תיקון מלא של עברית!)
                            fixed_line = reverse_visual_line(line)
                            chapter_elements.append({
                                "type": "text",
                                "content": fixed_line,
                                "y": i, # סדר השורות מלמעלה למטה
                                "page": p_num + 1
                            })

                # 2. חילוץ תמונות וסרטונים עם fitz (כמו קודם, כי הוא מצטיין בזה)
                fitz_page = fitz_doc[p_num]
                
                try:
                    images_info = fitz_page.get_image_info(xrefs=True)
                    for img_info in images_info:
                        xref = img_info.get("xref")
                        if not xref: continue
                        
                        try:
                            base_image = fitz_doc.extract_image(xref)
                            if base_image:
                                ext = base_image["ext"]
                                img_filename = f"ch_{ch['chapter_number']}_p_{p_num+1}_img_{xref}.{ext}"
                                img_path = os.path.join(img_output_dir, img_filename)
                                
                                if not os.path.exists(img_path):
                                    with open(img_path, "wb") as f:
                                        f.write(base_image["image"])
                                        
                                chapter_elements.append({
                                    "type": "image",
                                    "src": img_filename,
                                    # ניתן לו Y גבוה כדי שיופיע בסוף העמוד הלוגי
                                    "y": 9999 + xref, 
                                    "page": p_num + 1
                                })
                        except Exception as img_e:
                            pass
                except Exception as e:
                    pass

                links = fitz_page.get_links()
                for link in links:
                    uri = link.get("uri")
                    if uri:
                        is_video = any(vid in uri.lower() for vid in ['youtube.com', 'youtu.be', 'vimeo.com', '.mp4'])
                        chapter_elements.append({
                            "type": "video" if is_video else "link",
                            "url": uri,
                            "y": 99999, # יופיע בסוף העמוד
                            "page": p_num + 1
                        })

            # מיון האלמנטים - טקסט יהיה למעלה לפי Y, תמונות וסרטונים למטה
            chapter_elements.sort(key=lambda x: x["y"])
            for el in chapter_elements:
                del el["y"]
                
            markdown_content = ""
            for el in chapter_elements:
                if el["type"] == "text":
                    markdown_content += f"{el['content']}\n\n"
                elif el["type"] == "image":
                    markdown_content += f"![Image](extracted_media/{el['src']})\n\n"
                elif el["type"] == "video":
                    markdown_content += f"**[🎥 Video Link: {el['url']}]({el['url']})**\n\n"
                elif el["type"] == "link":
                    markdown_content += f"*[Link: {el['url']}]({el['url']})*\n\n"

            all_chapters_data.append({
                "chapter_number": ch['chapter_number'],
                "title": ch['title'],
                "content_elements": chapter_elements,
                "content_md": markdown_content.strip()
            })

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(all_chapters_data, f, ensure_ascii=False, indent=2)
        
    print(f"Extraction complete! Saved {len(all_chapters_data)} chapters to {output_json}")

if __name__ == "__main__":
    PDF_FILE = "study_book.pdf"
    OUTPUT_JSON = "extracted_study_data.json"
    IMG_DIR = "extracted_media"
    extract_full_content(PDF_FILE, OUTPUT_JSON, IMG_DIR)
