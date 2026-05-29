import os
import re
from supabase import create_client

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')

if not url or not key:
    with open('.env.local') as f:
        for line in f:
            if line.startswith('VITE_SUPABASE_URL'):
                url = line.split('=')[1].strip().strip('"').strip("'")
            if line.startswith('VITE_SUPABASE_ANON_KEY'):
                key = line.split('=')[1].strip().strip('"').strip("'")

supabase = create_client(url, key)

mapping = {
    1: 3, 2: 4, 3: 7, 4: 14, 5: 19, 6: 24, 7: 28, 8: 32, 9: 35, 10: 38,
    11: 41, 12: 44, 13: 46, 14: 50, 15: 53, 16: 57, 17: 64, 18: 69, 19: 74,
    20: 77, 21: 81, 22: 84, 23: 87, 24: 91
}

res = supabase.table('study_chapters').select('id, chapter_number, content_md').execute()
for ch in res.data:
    cnum = ch.get('chapter_number')
    if cnum in mapping:
        pg = mapping[cnum]
        md = ch.get('content_md', '')
        
        # Remove any existing [PDF_PAGE:X] tag at the start
        md = re.sub(r'^\[PDF_PAGE:\d+\]\s*\n*', '', md).strip()
        
        # Add the new tag at the very beginning
        new_md = f"[PDF_PAGE:{pg}]\n\n{md}"
        
        # Update supabase
        supabase.table('study_chapters').update({'content_md': new_md}).eq('id', ch['id']).execute()
        print(f"Updated Chapter {cnum} with page {pg}")

print("Done!")
