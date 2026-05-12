import fitz
import json
import re
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY") # We should use service key if RLS blocks, but we can disable RLS for admin tasks. Or just pass it.

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def is_header_footer(line):
    # Check if line corresponds to the repeated header
    if 'בס"ד' in line or 'אריה משה' in line or 'רוני מצליח' in line or 'מרגלי' in line:
        return True
    if re.match(r'^\s*\d+\s*$', line): # Page numbers
        return True
    return False

def clean_text(text):
    lines = text.split('\n')
    new_lines = []
    for line in lines:
        if is_header_footer(line):
            continue
            
        line = line.strip()
        if not line:
            continue
            
        new_lines.append(line)
            
    return '\n\n'.join(new_lines)


def run():
    print("Opening PDF...")
    doc = fitz.open('study_book.pdf')
    toc = doc.get_toc()
    
    # TOC format: [level, title, page_number]
    # We will get chapters from TOC level 1
    chapters = []
    for i in range(len(toc)):
        lvl, title, page = toc[i]
        if lvl != 1: continue
        
        # Determine end page
        next_page = doc.page_count
        for j in range(i+1, len(toc)):
            if toc[j][0] == 1:
                next_page = toc[j][2]
                break
                
        chapters.append({
            'chapter_number': i + 1,
            'title': title,
            'start_page': page - 1, # 0-indexed
            'end_page': next_page - 1
        })
        
    print(f"Found {len(chapters)} chapters. Creating table...")
    # Clean existing chapters
    try:
        # Delete all chapters (Supabase REST API requires a filter, so we filter by id > 0)
        supabase.table('study_chapters').delete().gt('id', 0).execute()
        print("Cleared existing chapters.")
    except Exception as e:
        print("Error clearing chapters:", e)
    
    for ch in chapters:
        print(f"Extracting Chapter {ch['chapter_number']} : {ch['title']} (pages {ch['start_page']} to {ch['end_page']})")
        text = ""
        for p in range(ch['start_page'], ch['end_page']):
            # get_text("text") gets visual layout or raw?
            text += doc[p].get_text("text") + "\n"
            
        md_text = f"[PDF_PAGE:{ch['start_page'] + 1}]\n\n" + clean_text(text)
        
        # Add to Supabase
        data = {
            "chapter_number": ch['chapter_number'],
            "title": ch['title'],
            "content_md": md_text
        }
        res = supabase.table('study_chapters').insert(data).execute()
        if hasattr(res, 'error') and res.error:
            print("Error inserting:", res.error)
            
    print("Done!")

if __name__ == '__main__':
    run()
