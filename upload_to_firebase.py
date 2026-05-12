import os
import json
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import storage
from datetime import datetime, timedelta

def upload_to_firebase(service_account_path, bucket_name, json_path, images_dir):
    # Initialize Firebase
    if not os.path.exists(service_account_path):
        print(f"Error: Credentials file not found at {service_account_path}")
        return

    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred, {
        'storageBucket': bucket_name
    })

    db = firestore.client()
    bucket = storage.bucket()

    # Read JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Upload Images
    print("Starting Image Upload...")
    uploaded_images = {}
    for filename in os.listdir(images_dir):
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
        
        file_path = os.path.join(images_dir, filename)
        blob_path = f"question_images/{filename}"
        blob = bucket.blob(blob_path)
        
        print(f"Uploading {filename}...")
        blob.upload_from_filename(file_path)
        
        # Make public if allowed, or get a long-lived download URL.
        # Note: If bucket has uniform bucket-level access, blob.make_public() might fail.
        # In that case, generate a signed URL or configure bucket publicly.
        try:
            blob.make_public()
            public_url = blob.public_url
        except Exception as e:
            print(f"Warning: Could not make blob public ({e}). Generating signed URL...")
            public_url = blob.generate_signed_url(expiration=timedelta(days=3650))
            
        uploaded_images[f"extracted_images/{filename}"] = public_url

    # 2. Update JSON with Storage URLs
    for q in data:
        if q.get("image_path"):
            local_path = q["image_path"]
            if local_path in uploaded_images:
                q["image_url"] = uploaded_images[local_path]
            else:
                # Handle cases where path uses backslashes
                local_path_alt = local_path.replace("/", "\\")
                if local_path_alt in uploaded_images:
                    q["image_url"] = uploaded_images[local_path_alt]
                
            # Remove local path
            del q["image_path"]

    # 3. Clear existing questions in Firestore
    print("Clearing existing questions in Firestore...")
    q_collection = db.collection('question_bank')
    docs = q_collection.stream()
    deleted_count = 0
    for doc in docs:
        doc.reference.delete()
        deleted_count += 1
    print(f"Deleted {deleted_count} existing documents.")

    # 4. Upload robust questions
    print("Uploading questions to Firestore...")
    batch = db.batch()
    batch_count = 0
    total_uploaded = 0
    
    for q in data:
        chap = q.get("chapter_number", "")
        # Safely extract q_num
        qid_full = q.get("question_id", "")
        q_num = qid_full.split('.')[1] if "." in qid_full else qid_full
        
        doc_id = f"{chap}_{q_num}"
        
        doc_ref = q_collection.document(doc_id)
        batch.set(doc_ref, q)
        batch_count += 1
        total_uploaded += 1
        
        # Commit in batches of 500 (Firestore limit)
        if batch_count == 400:
            batch.commit()
            batch = db.batch()
            batch_count = 0
            
    if batch_count > 0:
        batch.commit()
        
    print(f"Successfully synced {total_uploaded} questions to Firestore!")
    
    # Save the enriched JSON 
    enriched_path = json_path.replace(".json", "_enriched.json")
    with open(enriched_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved local enriched copy to {enriched_path}")

if __name__ == "__main__":
    SERVICE_ACCOUNT_KEY = "serviceAccountKey.json" # UPDATE THIS
    STORAGE_BUCKET_NAME = "your-project-id.appspot.com" # UPDATE THIS
    
    JSON_PATH = "database_seed.json"
    IMAGES_DIR = "extracted_images"
    
    upload_to_firebase(SERVICE_ACCOUNT_KEY, STORAGE_BUCKET_NAME, JSON_PATH, IMAGES_DIR)
