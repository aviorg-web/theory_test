import os
from supabase import create_client

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')
if not url:
    with open('.env.local') as f:
        for line in f:
            if line.startswith('VITE_SUPABASE_URL'):
                url = line.split('=')[1].strip().strip('"').strip("'")
            if line.startswith('VITE_SUPABASE_ANON_KEY'):
                key = line.split('=')[1].strip().strip('"').strip("'")

supabase = create_client(url, key)
res = supabase.table('study_chapters').select('id, content_md').eq('chapter_number', '16').single().execute()

with open('out8.txt','w',encoding='utf-8') as f:
    f.write(res.data['content_md'])
