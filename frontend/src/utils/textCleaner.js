// Fixes common PDF-to-Hebrew artifacts like punctuation placement
export function cleanHebrewText(text) {
  if (!text) return "";
  let cleaned = text.trim();
  
  // PDF extraction often flips parentheses or fails to align dots in RTL
  // We swap opposite parentheses so in RTL they render correctly
  cleaned = cleaned.replace(/\(/g, 'TEMP_BRACKET').replace(/\)/g, '(').replace(/TEMP_BRACKET/g, ')');
  
  // If a sentence ends with a Hebrew letter followed by a dot, leave it. RTL dom handles it.
  return cleaned;
}
