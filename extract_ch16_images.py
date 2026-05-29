import os
import fitz
from supabase import create_client

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')

if not url or not key:
    with open('.env.local') as f:
        for line in f:
            if line.startswith('VITE_SUPABASE_URL'):
                url = line.split('=')[1].strip().strip('"').strip("'")
            if line.startswith('VITE_SUPABASE_ANON_KEY'):
                key = line.split('=')[1].strip().strip('"').strip("'")

supabase = create_client(url, key)

doc = fitz.open('study_book.pdf')

pages_to_extract = [57, 58, 59, 60, 61, 62]  # Zero-indexed? No, PDF pages are 0-indexed in code.
# The book says chapter 16 is at page 57. In zero-index that's doc[56].
# Let's extract doc[56], doc[57], doc[58], doc[59], doc[60], doc[61]

image_urls = []

for i in range(56, 62):
    page = doc[i]
    # Crop top 100 and bottom 100 to remove headers/footers
    r = page.rect
    clip_rect = fitz.Rect(0, 100, r.width, r.height - 100)
    pix = page.get_pixmap(clip=clip_rect, dpi=150)
    
    img_bytes = pix.tobytes("png")
    filename = f"ch_16_diagram_page_{i+1}.png"
    
    with open(f"extracted_images/{filename}", "wb") as f:
        f.write(img_bytes)
        
    # Upload to supabase
    try:
        supabase.storage.from_('extracted-images').upload(filename, img_bytes, {"content-type": "image/png", "x-upsert": "true"})
        print(f"Uploaded {filename}")
    except Exception as e:
        print(f"Failed to upload {filename} (maybe exists): {e}")
        
    image_urls.append(f"/extracted_images/{filename}")

# Now append these images to chapter 16's content_md
res = supabase.table('study_chapters').select('id, content_md').eq('chapter_number', 16).execute()
if res.data:
    ch = res.data[0]
    md = ch['content_md']
    
    # Check if we already appended them
    if "ch_16_diagram" not in md:
        # Append images
        images_md = "\n\n### תרשימי צמתים מחוברת המקור:\n\n"
        for url in image_urls:
            images_md += f"![Image]({url})\n\n"
            
        new_md = md + images_md
        supabase.table('study_chapters').update({'content_md': new_md}).eq('id', ch['id']).execute()
        print("Updated Chapter 16 markdown with diagrams!")
    else:
        print("Diagrams already in Chapter 16 markdown.")
