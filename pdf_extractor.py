import fitz  # PyMuPDF
import json
import os

def extract_pdf_content(pdf_path, output_dir):
    # יצירת תיקיות יעד מסודרות
    images_dir = os.path.join(output_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    # פתיחת קובץ ה-PDF
    doc = fitz.open(pdf_path)
    all_pages_data = []

    print(f"מתחיל בחילוץ נתונים מתוך: {pdf_path}")

    # ריצה על כל עמודי המסמך
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        
        # מהלך 1: חילוץ הטקסט מהעמוד
        page_text = page.get_text("text").strip()

        # דילוג על עמודים ריקים לחלוטין
        if not page_text and not page.get_images(full=True):
            continue

        page_data = {
            "page_number": page_num + 1,
            "text": page_text,
            "images": []
        }

        # מהלך 2: חילוץ התמונות ומספורן באופן שיטתי
        image_list = page.get_images(full=True)
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            # יצירת שם חכם לתמונה המקשר אותה לעמוד הספציפי
            image_filename = f"page_{page_num + 1}_img_{img_index + 1}.{image_ext}"
            image_filepath = os.path.join(images_dir, image_filename)

            # שמירת קובץ התמונה
            with open(image_filepath, "wb") as image_file:
                image_file.write(image_bytes)

            # הוספת התיעוד לקובץ הנתונים
            page_data["images"].append({
                "image_id": f"img_{page_num + 1}_{img_index + 1}",
                "file_name": image_filename
            })

        all_pages_data.append(page_data)
        print(f"עמוד {page_num + 1} עובד בהצלחה ({len(image_list)} תמונות חולצו).")

    # ריכוז כל המידע לקובץ JSON מאורגן
    json_path = os.path.join(output_dir, "theory_data_extracted.json")
    with open(json_path, 'w', encoding='utf-8') as json_file:
        json.dump(all_pages_data, json_file, ensure_ascii=False, indent=4)

    print("\n--- התהליך הושלם במלואו! ---")
    print(f"קובץ הנתונים (JSON) נשמר ב: {json_path}")
    print(f"כל התמונות נשמרו בתיקייה: {images_dir}")

# הפעלת הסקריפט
if __name__ == "__main__":
    # עליך לוודא ששם הקובץ תואם לקובץ המצוי בתיקייה שלך
    pdf_file_name = "maagar-shelot-hadash-evrit.pdf" 
    output_folder_name = "extracted_theory_content"
    
    # הפעלת הפונקציה
    extract_pdf_content(pdf_file_name, output_folder_name)