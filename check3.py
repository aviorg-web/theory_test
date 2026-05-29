import json
db = json.load(open('database_seed.json', encoding='utf-8'))
with open('out5.txt','w',encoding='utf-8') as f:
    for c in db:
        f.write(f"{c.get('chapter_number')}: {c.get('chapter_title')}\n")
