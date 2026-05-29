import os
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

res = supabase.table('questions').select('*').execute()
bad_qs = [q for q in res.data if not q.get('question_text') or len(q.get('question_text', '').strip()) < 2]

import json
with open('out.json', 'w', encoding='utf-8') as f:
    json.dump(bad_qs, f, ensure_ascii=False, indent=2)
