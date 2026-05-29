import re
s = open('final_theory_db.json', encoding='utf-8').read()
res = re.findall(r'"chapter_number":\s*(\d+),\s*"chapter_title":\s*"([^"]+)"', s)
mapping = list(set(res))
mapping.sort(key=lambda x: int(x[0]))
with open('out7.txt','w',encoding='utf-8') as f:
    for m in mapping:
        f.write(f"{m[0]}: {m[1]}\n")
