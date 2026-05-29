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
print([b.name for b in supabase.storage.list_buckets()])
