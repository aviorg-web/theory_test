import json
db = json.load(open('extracted_study_data.json', encoding='utf-8'))
with open('out4.txt','w',encoding='utf-8') as f:
    for c in db:
        f.write(f"{c['chapter_number']}: {c['title']}\n")
