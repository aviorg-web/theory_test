import fitz

def test_extract_tables(pdf_path):
    doc = fitz.open(pdf_path)
    for i in range(10, len(doc)):
        page = doc[i]
        text = page.get_text("text")
        if "מחוון תשובות" in text and "שאלה" in text:
            print(f"--- Page {i} Answer Key ---")
            
            # Using PyMuPDF block extraction
            blocks = page.get_text("blocks", sort=True)
            for b in blocks:
                if b[6] == 0:
                    lines = b[4].strip().split('\n')
                    print(f"B: {lines}")
            
            # Use 'words' extraction to see exact locations
            words = page.get_text("words")
            print("Words snippet:", words[:20])
            break

if __name__ == "__main__":
    test_extract_tables("c:/Users/User/Downloads/לימוד תעבורה/theory_test/maagar-shelot-hadash-evrit.pdf")
