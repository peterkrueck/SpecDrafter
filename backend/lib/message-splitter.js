/**
 * Message Splitter - Pure function for splitting AI messages at routing markers
 * 
 * This module extracts the message splitting logic from the orchestrator
 * to make it testable, debuggable, and maintainable.
 * 
 * IMPORTANT: This implementation exactly replicates the original behavior:
 * - beforeMarker is trimmed
 * - afterMarker includes the marker itself and is NOT trimmed
 */

class MessageSplitter {
  constructor() {
    // Currently only supports @review: but designed for future expansion
    this.markers = {
      review: '@review:'
    };
    
    // Regex patterns for safer detection
    this.codeBlockPattern = /```[\s\S]*?```/g;
    this.inlineCodePattern = /`[^`]+`/g;
  }

  /**
   * Check if a position is inside a code block or inline code
   * @param {string} content - The full message content
   * @param {number} position - Position to check
   * @returns {boolean} True if inside code
   */
  isInsideCode(content, position) {
    // Check code blocks
    const codeBlocks = [...content.matchAll(this.codeBlockPattern)];
    for (const match of codeBlocks) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (position >= start && position < end) {
        return true;
      }
    }
    
    // Check inline code
    const inlineCodes = [...content.matchAll(this.inlineCodePattern)];
    for (const match of inlineCodes) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (position >= start && position < end) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if marker appears at a valid sentence boundary
   * @param {string} content - The full message content
   * @param {number} markerIndex - Position of the marker
   * @returns {boolean} True if at valid boundary
   */
  isValidMarkerPosition(content, markerIndex) {
    // Check if inside code - if so, invalid
    if (this.isInsideCode(content, markerIndex)) {
      return false;
    }
    
    // Valid positions:
    // 1. At the very start of the message
    if (markerIndex === 0) {
      return true;
    }
    
    // 2. After a newline (start of new line)
    if (markerIndex > 0 && content[markerIndex - 1] === '\n') {
      return true;
    }
    
    // 3. After double newline (new paragraph)
    if (markerIndex >= 2 && content.substring(markerIndex - 2, markerIndex) === '\n\n') {
      return true;
    }
    
    // 4. After sentence boundary (. ! ?) followed by space
    // Look back up to 10 chars for sentence ending
    const lookback = Math.min(markerIndex, 10);
    const beforeMarker = content.substring(markerIndex - lookback, markerIndex);
    const sentenceEndMatch = beforeMarker.match(/[.!?]\s+$/);
    if (sentenceEndMatch) {
      return true;
    }
    
    // Not at a valid boundary
    return false;
  }

  /**
   * Split a message at the @review: marker
   * 
   * @param {string} content - The message content to split
   * @returns {Object} Split result with segments and metadata
   */
  split(content) {
    // Handle null/undefined content
    if (!content || typeof content !== 'string') {
      return {
        hasMarker: false,
        markerIndex: -1,
        beforeMarker: '',
        afterMarker: '',
        markerType: null,
        stats: {
          originalLength: 0,
          beforeLength: 0,
          afterLength: 0
        }
      };
    }

    // Look for ALL occurrences of @review: marker
    let searchIndex = 0;
    let markerIndex = -1;
    let invalidOccurrences = 0;
    
    while (searchIndex < content.length) {
      const foundIndex = content.indexOf(this.markers.review, searchIndex);
      
      if (foundIndex === -1) {
        // No more markers found
        break;
      }
      
      // Check if this occurrence is at a valid position
      if (this.isValidMarkerPosition(content, foundIndex)) {
        markerIndex = foundIndex;
        break; // Use the first valid occurrence
      } else {
        invalidOccurrences++;
      }
      
      // Continue searching after this invalid occurrence
      searchIndex = foundIndex + this.markers.review.length;
    }
    
    if (markerIndex === -1) {
      // No valid marker found - entire content goes to user
      return {
        hasMarker: false,
        markerIndex: -1,
        beforeMarker: content,
        afterMarker: '',
        markerType: null,
        invalidOccurrences: invalidOccurrences,
        stats: {
          originalLength: content.length,
          beforeLength: content.length,
          afterLength: 0
        }
      };
    }

    // Valid marker found - split the content
    // CRITICAL: These operations must exactly match the original implementation
    const beforeReview = content.substring(0, markerIndex).trim();  // Trimmed
    const afterReview = content.substring(markerIndex);             // NOT trimmed, includes marker
    
    return {
      hasMarker: true,
      markerIndex: markerIndex,
      beforeMarker: beforeReview,
      afterMarker: afterReview,
      markerType: 'review',
      invalidOccurrences: invalidOccurrences,
      stats: {
        originalLength: content.length,
        beforeLength: beforeReview.length,
        afterLength: afterReview.length
      }
    };
  }

  /**
   * Check if content contains a VALID @review: marker
   * Useful for quick checks without full splitting
   */
  hasReviewMarker(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    
    // Check if there's any valid occurrence
    let searchIndex = 0;
    while (searchIndex < content.length) {
      const foundIndex = content.indexOf(this.markers.review, searchIndex);
      if (foundIndex === -1) break;
      
      if (this.isValidMarkerPosition(content, foundIndex)) {
        return true;
      }
      searchIndex = foundIndex + this.markers.review.length;
    }
    
    return false;
  }

  /**
   * Get statistics about splitting operations
   * Can be extended to track performance metrics
   */
  getSplitStats(results) {
    const stats = {
      total: results.length,
      withMarker: 0,
      withoutMarker: 0,
      averageBeforeLength: 0,
      averageAfterLength: 0
    };

    let totalBeforeLength = 0;
    let totalAfterLength = 0;

    for (const result of results) {
      if (result.hasMarker) {
        stats.withMarker++;
        totalAfterLength += result.stats.afterLength;
      } else {
        stats.withoutMarker++;
      }
      totalBeforeLength += result.stats.beforeLength;
    }

    if (results.length > 0) {
      stats.averageBeforeLength = Math.round(totalBeforeLength / results.length);
    }
    
    if (stats.withMarker > 0) {
      stats.averageAfterLength = Math.round(totalAfterLength / stats.withMarker);
    }

    return stats;
  }
}

// Export as singleton to ensure consistent configuration
const messageSplitter = new MessageSplitter();
export default messageSplitter;