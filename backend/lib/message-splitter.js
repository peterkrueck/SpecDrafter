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

    // Look for @review: marker (exact match required)
    const markerIndex = content.indexOf(this.markers.review);
    
    if (markerIndex === -1) {
      // No marker found - entire content goes to user
      return {
        hasMarker: false,
        markerIndex: -1,
        beforeMarker: content,
        afterMarker: '',
        markerType: null,
        stats: {
          originalLength: content.length,
          beforeLength: content.length,
          afterLength: 0
        }
      };
    }

    // Marker found - split the content
    // CRITICAL: These operations must exactly match the original implementation
    const beforeReview = content.substring(0, markerIndex).trim();  // Trimmed
    const afterReview = content.substring(markerIndex);             // NOT trimmed, includes marker
    
    return {
      hasMarker: true,
      markerIndex: markerIndex,
      beforeMarker: beforeReview,
      afterMarker: afterReview,
      markerType: 'review',
      stats: {
        originalLength: content.length,
        beforeLength: beforeReview.length,
        afterLength: afterReview.length
      }
    };
  }

  /**
   * Check if content contains the @review: marker
   * Useful for quick checks without full splitting
   */
  hasReviewMarker(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    return content.indexOf(this.markers.review) !== -1;
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