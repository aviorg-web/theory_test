import sys
try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF is not installed. Please run: pip install PyMuPDF")
    sys.exit(1)

import json
import os
import re

# Bidi importing
try:
    from bidi.algorithm import get_display
except ImportError:
    pass # we can gracefully ignore if bidi is missing and just output logical

def extract_pdf_data(pdf_path: str, output_json: str, output_image_dir: str):
    # Ensure output directory exists
    try:
        os.makedirs(output_image_dir, exist_ok=True)
    except Exception as e:
        print(f"Error creating output directory: {e}")
        return
    
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Failed to open PDF {pdf_path}: {e}")
        return

    all_questions = []
    question_pattern = re.compile(r'^(\d+)\.(\d+)')
    option_pattern = re.compile(r'^([אבגד])\s*[\.\)](.*)')
    
    for page_num in range(len(doc)):
        try:
            page = doc[page_num]
            blocks = page.get_text("blocks", sort=True)
            page_questions = []
            current_question = None
            
            for b_info in blocks:
                if len(b_info) < 7:
                    continue
                    
                x0, y0, x1, y1, text, block_no, block_type = b_info[:7]
                
                if block_type != 0:  # Not text
                    continue
                    
                text = text.strip()
                if not text:
                    continue
                
                lines = text.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    q_match = question_pattern.search(line)
                    if q_match:
                        chapter = q_match.group(1)
                        q_num = q_match.group(2)
                        q_id = f"{chapter}.{q_num}"
                        line_clean = line[q_match.end():].strip()
                        
                        current_question = {
                            "chapter_number": chapter,
                            "question_id": q_id,
                            "question_text": line_clean + "\n",
                            "options": [],
                            "image_path": None,
                            "y_coords": [y0, y1]
                        }
                        page_questions.append(current_question)
                    else:
                        if current_question is not None:
                            opt_match = option_pattern.search(line)
                            rev_opt_match = re.search(r'(.*)\s+([אבגד])[\.\)]$', line) 
                            
                            if opt_match:
                                current_question["options"].append(line)
                            elif rev_opt_match:
                                current_question["options"].append(line)
                            else:
                                opts = current_question["options"]
                                if len(opts) > 0:
                                    last_opt = opts.pop()
                                    opts.append(last_opt + " " + line)
                                else:
                                    q_text = current_question.get("question_text", "")
                                    current_question["question_text"] = q_text + " " + line
                            
                            # Expand question span safely
                            if "y_coords" in current_question and isinstance(current_question["y_coords"], list):
                                current_question["y_coords"][1] = max(current_question["y_coords"][1], y1)
            
            # Clean up text properly
            for q in page_questions:
                if "question_text" in q:
                    q["question_text"] = q["question_text"].strip()
                if "options" in q:
                    for i in range(len(q["options"])):
                        q["options"][i] = str(q["options"][i]).strip()
            
            # Extract images on this page
            try:
                images_info = page.get_image_info(xrefs=True)
                for img_info in images_info:
                    xref = img_info.get("xref")
                    if not xref:
                        continue
                        
                    img_bbox = img_info.get("bbox")
                    if not img_bbox or len(img_bbox) != 4:
                        continue
                        
                    img_y_center = (img_bbox[1] + img_bbox[3]) / 2
                    nearest_q = None
                    min_dist = float('inf')
                    
                    for q in page_questions:
                        if "y_coords" not in q or not q["y_coords"]:
                            continue
                        q_top = q["y_coords"][0]
                        q_bot = q["y_coords"][1]
                        
                        if q_top - 50 <= img_y_center <= q_bot + 50:
                            nearest_q = q
                            break
                        
                        dist = min(abs(img_y_center - q_top), abs(img_y_center - q_bot))
                        if dist < min_dist:
                            min_dist = dist
                            nearest_q = q
                    
                    if nearest_q:
                        try:
                            base_image = doc.extract_image(xref)
                            if base_image and "image" in base_image and "ext" in base_image:
                                image_bytes = base_image["image"]
                                ext = base_image["ext"]
                                
                                q_id_safe = str(nearest_q.get("question_id", "unknown")).replace(".", "_")
                                filename = f"q_{q_id_safe}.{ext}"
                                filepath = os.path.join(output_image_dir, filename)
                                
                                with open(filepath, "wb") as f:
                                    f.write(image_bytes)
                                    
                                nearest_q["image_path"] = os.path.join("extracted_images", filename).replace("\\", "/")
                        except Exception as e:
                            print(f"Warning: Failed to extract image layout xref {xref}: {e}")
            except Exception as e:
                print(f"Warning: Could not extract image info on page {page_num}: {e}")

            all_questions.extend(page_questions)
        except Exception as e:
            print(f"Error processing page {page_num} for questions: {e}")

    # Cleanup mapping info safely
    for q in all_questions:
        if "y_coords" in q:
            del q["y_coords"]

    try:
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(all_questions, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving to {output_json}: {e}")

def parse_answer_key_tables(pdf_path: str, json_path: str):
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Failed to read JSON for second pass: {e}")
        return
        
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Failed to open PDF for second pass: {e}")
        return

    # Using standard nested map logic 
    answers_map = {}
    current_chapter = None
    
    chapter_pattern = re.compile(r"נושא\s*(?:מס'?\s*)?(\d+)")
    mapping = {"א": 1, "ב": 2, "ג": 3, "ד": 4, "א ": 1, " ב": 2, " ג": 3, " ד": 4}
    
    for i in range(len(doc)):
        try:
            page = doc[i]
            text = page.get_text()
            
            if "מחוון תשובות" in text and "........" not in text:
                for line in text.split('\n'):
                    m = chapter_pattern.search(line)
                    if m:
                        current_chapter = m.group(1)
                        if current_chapter not in answers_map:
                            answers_map[current_chapter] = {}
                        break
                
                if not current_chapter:
                    continue
                    
                words = page.get_text("words")
                rows = {}
                for w in words:
                    if len(w) < 5: continue
                    text_word = w[4].strip()
                    if not text_word: continue
                    
                    y = round((w[1] + w[3]) / 2 / 5) * 5
                    if y not in rows:
                        rows[y] = []
                    x_center = (w[0] + w[2]) / 2
                    rows[y].append({"x": x_center, "text": text_word})
                
                for y in sorted(rows.keys()):
                    row_words = sorted(rows[y], key=lambda item: item["x"])
                    nums = [item for item in row_words if item["text"].isdigit()]
                    letters = [item for item in row_words if item["text"].replace("'","").replace('"',"") in mapping]
                    
                    if len(nums) > 0 and len(letters) > 0:
                        for letter_info in letters:
                            closest_num = min(nums, key=lambda n: abs(n["x"] - letter_info["x"]))
                            num_val = closest_num["text"]
                            let_val = letter_info["text"].replace("'","").replace('"',"")
                            # Map correctly into our dictionary branch
                            cmap = answers_map.get(current_chapter)
                            if cmap is not None and isinstance(cmap, dict):
                                cmap[num_val] = mapping.get(let_val)
        except Exception as e:
            print(f"Error parsing answers on page {i}: {e}")
                        
    updated_count = 0
    missing_count = 0
    
    for q in data:
        try:
            chap = str(q.get("chapter_number", ""))
            qid_full = str(q.get("question_id", ""))
            
            if "." in qid_full:
                q_num = qid_full.split('.')[1]
            else:
                q_num = ""
                
            chap_map = answers_map.get(chap)
            
            if chap_map and isinstance(chap_map, dict) and q_num in chap_map:
                q["correct_answer_index"] = chap_map[q_num]
                updated_count += 1
            else:
                q["correct_answer_index"] = None
                missing_count += 1
        except Exception as e:
            print(f"Error merging answer for question {q}: {e}")
            
    try:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error validating JSON write operation: {e}")
        
    print(f"Second Pass: Updated {updated_count} questions with correct_answer_index.")
    print(f"Second Pass: Missing correct answers for {missing_count} questions.")

if __name__ == "__main__":
    pdf_file = "maagar-shelot-hadash-evrit.pdf"
    json_out = "database_seed.json"
    img_dir = "extracted_images"
    
    if not os.path.exists(pdf_file):
        print(f"Error: {pdf_file} not found in the current directory.")
        print("Please ensure the PDF is in the same folder and correctly named.")
    else:
        print(f"Starting extraction for {pdf_file}...")
        extract_pdf_data(pdf_file, json_out, img_dir)
        parse_answer_key_tables(pdf_file, json_out)
        print("Extraction complete!")
        print(f"Check {json_out} and the {img_dir}/ folder.")
