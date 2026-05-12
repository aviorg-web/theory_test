import os
import json
import mimetypes
from supabase import create_client, Client

SUPABASE_URL = "https://edcgpqfscpzuvqaxifdj.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
BUCKET_NAME = "question-images"
DATA_FILE = "database_seed.json"
IMAGES_DIR = "extracted_images"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_images():
    print("Uploading images to Supabase...")
    image_url_map = {}
    if not os.path.exists(IMAGES_DIR):
        print(f"Directory {IMAGES_DIR} not found. Skipping image upload.")
        return image_url_map

    images = os.listdir(IMAGES_DIR)
    total = len(images)
    print(f"Found {total} images to upload.")

    for i, filename in enumerate(images):
        filepath = os.path.join(IMAGES_DIR, filename)
        if not os.path.isfile(filepath):
            continue
        
        mime_type, _ = mimetypes.guess_type(filepath)
        if mime_type is None:
            mime_type = "application/octet-stream"

        with open(filepath, 'rb') as f:
            try:
                # Upload to Supabase Storage
                # We use upsert to overwrite if it already exists to prevent crashes
                supabase.storage.from_(BUCKET_NAME).upload(
                    path=filename,
                    file=filepath,
                    file_options={"content-type": mime_type, "upsert": "true"}
                )
            except Exception as e:
                # If error is about duplicate, we log and continue
                print(f"Image {filename} issue (might already exist): {e}")
        
        # Get public url mapping
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(filename)
        image_url_map[filename] = public_url

        if (i+1) % 20 == 0:
            print(f"Uploaded {i+1}/{total} images.")
            
    print("Image upload completed.")
    return image_url_map

def main():
    image_url_map = upload_images()

    print("Loading data from database_seed.json...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("Updating image paths with public URLs...")
    for item in data:
        if item.get("image_path"):
            old_path = item["image_path"]
            filename = os.path.basename(old_path)
            if filename in image_url_map:
                item["image_path"] = image_url_map[filename]

    print(f"Loaded {len(data)} questions. Preparing payload...")
    payload = []
    
    for item in data:
        options = item.get("options", [])
        
        option_1 = options[0] if len(options) > 0 else None
        option_2 = options[1] if len(options) > 1 else None
        option_3 = options[2] if len(options) > 2 else None
        option_4 = options[3] if len(options) > 3 else None

        record = {
            "chapter_number": int(item.get("chapter_number")), # Convert to int if possible, or leave as string based on your schema. We try int first.
            "question_text": item.get("question_text"),
            "option_1": option_1,
            "option_2": option_2,
            "option_3": option_3,
            "option_4": option_4,
            "correct_answer_index": item.get("correct_answer_index"),
            "image_url": item.get("image_path") # Path replaced by public URL
        }
        
        # In case chapter_number fails casting to an int somewhere, fallback to the original string.
        # Our previous script passed it as is. We will pass it directly if we want flexibility, but int() is safer.
        
        # We will wrap it in try/except for safety in parsing chapter number
        try:
            record["chapter_number"] = int(record["chapter_number"])
        except (ValueError, TypeError):
            pass # Keep it as is if it can't be converted

        payload.append(record)

    # Bulk insert in batches
    batch_size = 100
    total_batches = (len(payload) + batch_size - 1) // batch_size
    
    print(f"Uploading to Supabase 'questions' table in {total_batches} batches...")
    
    success_count = 0
    
    for i in range(0, len(payload), batch_size):
        batch = payload[i : i + batch_size]
        try:
            response = supabase.table('questions').insert(batch).execute()
            # If successful, count the records
            success_count += len(batch)
            print(f"Batch {i // batch_size + 1}/{total_batches} processed.")
        except Exception as e:
            print(f"Error inserting batch {i // batch_size + 1}: {e}")

    print(f"\nUpload complete! Successfully processed ~{success_count} / {len(payload)} questions.")

    # Validation
    try:
        response = supabase.table('questions').select("id", count="exact").execute()
        count = response.count
        print(f"Validation: The questions table now contains {count} records in total.")
    except Exception as e:
        print(f"Validation step failed: {e}")

if __name__ == "__main__":
    main()
