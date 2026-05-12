import json
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "").strip('"').strip("'")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "").strip('"').strip("'")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def push_data():
    if not os.path.exists("extracted_study_data.json"):
        print("Error: extracted_study_data.json not found!")
        return

    with open("extracted_study_data.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Loaded {len(data)} chapters. Cleaning existing study_chapters table...")
    try:
        supabase.table("study_chapters").delete().gt("id", 0).execute()
        print("Table cleared.")
    except Exception as e:
        print("Error clearing table:", e)

    print("Uploading new chapters...")
    for ch in data:
        row = {
            "chapter_number": ch["chapter_number"],
            "title": ch["title"],
            "content_md": ch["content_md"]
        }
        res = supabase.table("study_chapters").insert(row).execute()
        if hasattr(res, 'error') and res.error:
            print(f"Error inserting chapter {ch['chapter_number']}:", res.error)
        else:
            print(f"Inserted chapter {ch['chapter_number']}.")

    print("Done! The database is now updated with the rich markdown content.")

if __name__ == "__main__":
    push_data()
