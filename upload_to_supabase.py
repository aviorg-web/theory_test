import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Read Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in environment variables.")
    print("Please create a .env file with these variables.")
    exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_questions():
    file_path = 'database_seed.json'
    
    if not os.path.exists(file_path):
        print(f"Error: Could not find {file_path}")
        return

    print(f"Loading data from {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Loaded {len(data)} questions. Preparing payload...")

    payload = []
    for item in data:
        options = item.get("options", [])
        
        # Safely get options, handle cases with less than 4 options
        option_1 = options[0] if len(options) > 0 else None
        option_2 = options[1] if len(options) > 1 else None
        option_3 = options[2] if len(options) > 2 else None
        option_4 = options[3] if len(options) > 3 else None

        # Create record according to expected schema
        record = {
            "chapter_number": item.get("chapter_number"),
            "question_text": item.get("question_text"),
            "option_1": option_1,
            "option_2": option_2,
            "option_3": option_3,
            "option_4": option_4,
            "correct_answer_index": item.get("correct_answer_index"),
            "image_url": item.get("image_path") # Mapping image_path to image_url
        }
        
        payload.append(record)

    # Perform bulk insert in batches to avoid payload size limits
    batch_size = 100
    total_batches = (len(payload) + batch_size - 1) // batch_size
    
    print(f"Uploading to Supabase 'questions' table in {total_batches} batches...")
    
    success_count = 0
    
    for i in range(0, len(payload), batch_size):
        batch = payload[i : i + batch_size]
        try:
            # Note: Depending on your RLS settings, ensure the key used has insert privileges
            response = supabase.table('questions').insert(batch).execute()
            
            # response.data contains the successfully inserted rows
            success_count += len(response.data)
            print(f"Batch {i // batch_size + 1}/{total_batches} inserted successfully.")
            
        except Exception as e:
            print(f"Error inserting batch {i // batch_size + 1}: {e}")

    print(f"\nUpload complete! Successfully inserted {success_count} / {len(payload)} questions.")

if __name__ == "__main__":
    upload_questions()
