import json 
data=json.load(open('database_seed.json', encoding='utf-8')) 
qs=data if isinstance(data,list) else data.get('questions',[]) 
[print(q.get('id','?'), '-, q.get('correct_answer_index','?')) for q in qs[:5]] 
