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
res = supabase.table('questions').select('id, question_text, chapter_number').execute()

from collections import defaultdict
samples = defaultdict(list)
for q in res.data:
    samples[str(q['chapter_number'])].append(q['question_text'])

with open('out6.txt','w',encoding='utf-8') as f:
    for ch in sorted(samples.keys(), key=lambda x: int(x) if x.isdigit() else 999):
        f.write(f"Chapter {ch}:\n")
        f.write(samples[ch][0][:100] + '\n\n')
