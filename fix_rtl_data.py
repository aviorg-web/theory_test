import json
import os

def is_hebrew_reversed(text):
    # זיהוי מילים נפוצות בהיפוך (כשהן מחולצות הפוך)
    reversed_words = ['אל', 'תא', 'םע', 'לש', 'הז', 'יכ', 'אלל', 'רשא']
    words = text.split()
    count = sum(1 for w in words if w in reversed_words)
    return count > 0

def reverse_visual_text(text):
    # הופך את כל השורה, כדי להחזיר אותה למצב לוגי רגיל
    return text[::-1]

def fix_json_data():
    input_file = "extracted_study_data.json"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found!")
        return

    print("Loading data...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("Fixing RTL text...")
    fixed_count = 0
    for chapter in data:
        for el in chapter.get('content_elements', []):
            if el['type'] == 'text':
                if is_hebrew_reversed(el['content']):
                    el['content'] = reverse_visual_text(el['content'])
                    fixed_count += 1
        
        # נבנה מחדש את ה-Markdown עם הטקסט המתוקן
        markdown_content = ""
        for el in chapter['content_elements']:
            if el["type"] == "text":
                markdown_content += f"{el['content']}\n\n"
            elif el["type"] == "image":
                markdown_content += f"![Image](extracted_media/{el['src']})\n\n"
            elif el["type"] == "video":
                markdown_content += f"**[🎥 Video Link: {el['url']}]({el['url']})**\n\n"
            elif el["type"] == "link":
                markdown_content += f"*[Link: {el['url']}]({el['url']})*\n\n"
        
        chapter['content_md'] = markdown_content.strip()

    # דורס את הקובץ הקיים עם הנתונים המתוקנים
    print(f"Saving fixed data back to {input_file}...")
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Done! Fixed {fixed_count} reversed text blocks. You can now run push_study_data.py")

if __name__ == "__main__":
    fix_json_data()
