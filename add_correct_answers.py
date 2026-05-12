import fitz
import json
import re

def parse_answer_key_tables(pdf_path, json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    doc = fitz.open(pdf_path)
    
    # Store answers by chapter and question number. chapter -> { q_num: index }
    # E.g., { "1": { "1": 1, "2": 2... } }
    answers_map = {}
    current_chapter = None
    
    chapter_pattern = re.compile(r"נושא\s*(?:מס'?\s*)?(\d+)")
    
    mapping = {"א": 1, "ב": 2, "ג": 3, "ד": 4, "א ": 1, " ב": 2, " ג": 3, " ד": 4} # Add variations if needed
    
    for i in range(len(doc)):
        page = doc[i]
        text = page.get_text()
        
        # We also need to avoid Table of Contents. ToC usually has "תוכן" or "........"
        if "מחוון תשובות" in text and "........" not in text:
            # Try to identify chapter
            for line in text.split('\n'):
                m = chapter_pattern.search(line)
                if m:
                    current_chapter = m.group(1)
                    if current_chapter not in answers_map:
                        answers_map[current_chapter] = {}
                    break
            
            if not current_chapter:
                continue
                
            # Extract words
            words = page.get_text("words")
            
            # Group by row Y
            rows = {}
            for w in words:
                text_word = w[4].strip()
                if not text_word: continue
                # Y center mapped to nearest 5 pixels
                y = round((w[1] + w[3]) / 2 / 5) * 5
                if y not in rows:
                    rows[y] = []
                # Keep x center and text
                x_center = (w[0] + w[2]) / 2
                rows[y].append({"x": x_center, "text": text_word})
            
            # Sort rows by Y
            sorted_y = sorted(rows.keys())
            
            for y in sorted_y:
                row_words = sorted(rows[y], key=lambda i: i["x"])
                
                # We expect rows with pairs of numbers and letters
                # The table might be X sorted: [Answer, Question, Answer, Question] or [Question, Answer, Question, Answer]
                # Because Israel RTL: Left might be Number and Right might be Letter, or vice versa
                # Let's just gather all numbers and valid letters from the row
                nums = [item for item in row_words if item["text"].isdigit()]
                
                # Hebrew valid answers
                letters = [item for item in row_words if item["text"].replace("'","").replace('"',"") in mapping]
                
                # We should match them up by X coordinate proximity
                # Usually, a number and a letter next to each other.
                if len(nums) > 0 and len(letters) > 0:
                    # Let's pair them by closest X
                    for letter_info in letters:
                        closest_num = min(nums, key=lambda n: abs(n["x"] - letter_info["x"]))
                        num_val = closest_num["text"]
                        let_val = letter_info["text"].replace("'","").replace('"',"")
                        answers_map[current_chapter][num_val] = mapping[let_val]
                        
    # Merge
    updated_count = 0
    missing_count = 0
    
    for q in data:
        chap = q["chapter_number"]
        q_num = q["question_id"].split('.')[1]
        
        if chap in answers_map and q_num in answers_map[chap]:
            q["correct_answer_index"] = answers_map[chap][q_num]
            updated_count += 1
        else:
            q["correct_answer_index"] = None
            missing_count += 1
            
    # Save back
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Updated {updated_count} questions with correct_answer_index.")
    print(f"Missing correct answers for {missing_count} questions.")
    
    # Show an example
    if updated_count > 0:
        example = [q for q in data if q["correct_answer_index"] is not None][0]
        print("Example mapped:", example["question_id"], "->", example["correct_answer_index"])

    
if __name__ == "__main__":
    pdf = "maagar-shelot-hadash-evrit.pdf"
    json_path = "database_seed.json"
    parse_answer_key_tables(pdf, json_path)
