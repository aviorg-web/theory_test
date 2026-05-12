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

    # Open with pdfplumber for better text layout parsing
    with pdfplumber.open(pdf_path) as pb_doc:
        for ch in chapters:
            try:
                print(f"Extracting Chapter {ch['chapter_number']}: {ch['title']}")
            except UnicodeEncodeError:
                print(f"Extracting Chapter {ch['chapter_number']}")
            chapter_elements = []
            
            for p_num in range(ch['start_page'], ch['end_page']):
                # Text extraction with pdfplumber
                pb_page = pb_doc.pages[p_num]
                # pdfplumber extracts Hebrew in logical order in most cases thanks to its layout algorithms, 
                # but if we just want raw text layout:
                text_content = pb_page.extract_text(layout=False) # Without layout often retains logical flow
                
                # But wait, pdfplumber with layout=False usually extracts PDF text as it's defined in the stream.
                # If the PDF stream has it visual, it will still be visual.
                # Let's extract text and just use bidi logic on each line.
                
                # Wait, what if we use bidi.algorithm?
                pass
