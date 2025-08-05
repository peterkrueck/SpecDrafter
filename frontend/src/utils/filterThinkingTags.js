/**
 * Frontend safety fallback to filter thinking tags from messages
 * This should rarely be needed as filtering happens on the backend,
 * but provides an extra layer of protection for the UI
 */
export function filterThinkingTags(message) {
  if (!message || typeof message !== 'string') return message;
  
  // Enhanced pattern to match thinking tags with common misspellings
  const openingPattern = /<t+h+[i]*n+k*[i]*n*g*[^>]*>/gi;
  const closingPattern = /<\/t+h+[i]*n+k*[i]*n*g*[^>]*>/gi;
  
  // Find all opening tags
  const openingTags = [];
  let match;
  while ((match = openingPattern.exec(message)) !== null) {
    openingTags.push({
      tag: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  // Work backwards to avoid position shifts
  let filtered = message;
  for (let i = openingTags.length - 1; i >= 0; i--) {
    const opening = openingTags[i];
    
    // Look for matching closing tag
    const afterOpening = message.substring(opening.end);
    const tagName = opening.tag.match(/<(t+h+[i]*n+k*[i]*n*g*)/i)[1];
    const specificClosingPattern = new RegExp(`<\\/${tagName}[^>]*>`, 'i');
    const closingMatch = afterOpening.match(specificClosingPattern);
    
    if (closingMatch) {
      // Remove entire block from opening to closing
      const closingStart = opening.end + closingMatch.index;
      const closingEnd = closingStart + closingMatch[0].length;
      const before = filtered.substring(0, opening.start);
      const after = filtered.substring(closingEnd);
      const needsSpace = before.length > 0 && after.length > 0 && 
                        before[before.length - 1] !== ' ' && after[0] !== ' ';
      filtered = before + (needsSpace ? ' ' : '') + after;
    } else {
      // No closing tag - remove from opening tag onwards
      filtered = filtered.substring(0, opening.start).trimEnd();
    }
  }
  
  // Clean up any remaining closing tags
  filtered = filtered.replace(closingPattern, '');
  
  // Clean up double spaces
  filtered = filtered.replace(/\s\s+/g, ' ').trim();
  
  return filtered;
}