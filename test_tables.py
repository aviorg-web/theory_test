import fitz

def test_extract_tables(pdf_path):
    doc = fitz.open(pdf_path)
    # Find pages with "מחוון תשובות"
    for i in range(len(doc)):
        page = doc[i]
        text = page.get_text()
        if "מחוון תשובות" in text:
            print(f"--- Page {i} has Answer Key ---")
            
            # Let's try PyMuPDF's table finder
            tabs = page.find_tables()
            for i, tab in enumerate(tabs.tables):
                print(f"Table {i}:")
                for row in tab.extract():
                    print(row)
            
            # Stop after finding a few
            break

if __name__ == "__main__":
    test_extract_tables("c:/Users/User/Downloads/לימוד תעבורה/theory_test/maagar-shelot-hadash-evrit.pdf")
