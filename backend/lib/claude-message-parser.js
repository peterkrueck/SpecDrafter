import { createLogger } from './logger.js';

class ClaudeMessageParser {
  constructor() {
    this.logger = createLogger('CLAUDE-PARSER');
    this.conversationBuffer = [];
    this.currentSpeaker = null;
  }

  parseClaudeOutput(data) {
    const { type, content, raw } = data;
    
    this.logger.debug('Parsing Claude output', { 
      type, 
      contentType: typeof content,
      preview: JSON.stringify(content).substring(0, 100) 
    });

    // Since we're using --output-format stream-json, we should mostly get JSON
    if (type === 'json') {
      return this.parseJSON(content);
    }
    
    // Fallback for any non-JSON output
    return this.parseMessage(content);
  }

  parseConversation(content) {
    // Claude outputs in Human: and Assistant: format
    if (content.includes('Human:')) {
      this.currentSpeaker = 'human';
      const message = content.replace(/Human:\s*/, '').trim();
      return {
        hasMessage: true,
        message,
        speaker: 'human',
        type: 'user_input',
        timestamp: new Date().toISOString()
      };
    }
    
    if (content.includes('Assistant:')) {
      this.currentSpeaker = 'assistant';
      const message = content.replace(/Assistant:\s*/, '').trim();
      return {
        hasMessage: true,
        message,
        speaker: 'assistant',
        type: 'ai_response',
        timestamp: new Date().toISOString()
      };
    }

    // Continuation of previous speaker
    if (this.currentSpeaker) {
      return {
        hasMessage: true,
        message: content.trim(),
        speaker: this.currentSpeaker,
        type: this.currentSpeaker === 'human' ? 'user_input' : 'ai_response',
        timestamp: new Date().toISOString()
      };
    }

    return { hasMessage: false };
  }

  parseToolUsage(content) {
    // Parse tool usage patterns
    if (content.includes('Tool:')) {
      const toolInfo = content.replace(/Tool:\s*/, '').trim();
      return {
        hasMessage: true,
        message: `Using tool: ${toolInfo}`,
        type: 'tool_usage',
        metadata: { tool: toolInfo },
        timestamp: new Date().toISOString()
      };
    }
    
    if (content.includes('Result:')) {
      const result = content.replace(/Result:\s*/, '').trim();
      return {
        hasMessage: true,
        message: `Tool result: ${result}`,
        type: 'tool_result',
        metadata: { result },
        timestamp: new Date().toISOString()
      };
    }

    return { hasMessage: false };
  }

  parseJSON(content) {
    // Handle Claude's JSONL output format
    try {
      // Handle different message types
      if (content.type === 'system' && content.subtype === 'init') {
        // Session initialization - not a user-facing message
        return { hasMessage: false };
      }
      
      if (content.type === 'assistant' && content.message) {
        // Extract text content from assistant messages
        const textParts = content.message.content
          .filter(c => c.type === 'text')
          .map(c => c.text);
        
        if (textParts.length > 0) {
          return {
            hasMessage: true,
            message: textParts.join('\n'),
            type: 'assistant_response',
            metadata: content,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      if (content.type === 'tool_use') {
        // Tool usage
        return {
          hasMessage: true,
          message: `Using tool: ${content.name}`,
          type: 'tool_usage',
          metadata: content,
          timestamp: new Date().toISOString()
        };
      }
      
      if (content.type === 'result') {
        // Final result - could include summary info
        return {
          hasMessage: false, // Don't show result metadata to user
          metadata: content
        };
      }
      
      // For other types, return the raw JSON
      return {
        hasMessage: true,
        message: JSON.stringify(content, null, 2),
        type: 'structured_data',
        metadata: content,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Failed to parse JSON', { error: error.message });
      return { hasMessage: false };
    }
  }

  parseMessage(content) {
    // Generic message parsing
    const trimmed = content.trim();
    
    // Filter out common system messages
    if (this.isSystemMessage(trimmed)) {
      return { hasMessage: false };
    }

    // Valid message
    if (trimmed.length > 0) {
      return {
        hasMessage: true,
        message: trimmed,
        type: 'generic',
        timestamp: new Date().toISOString()
      };
    }

    return { hasMessage: false };
  }

  isSystemMessage(message) {
    const systemPatterns = [
      /^claude$/i,
      /^>$/,
      /^\s*$/,
      /^Continuing from previous conversation/i,
      /^Session ID:/i,
      /^Loading/i,
      /^Initializing/i
    ];

    return systemPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Filters out all thinking tags and their content from messages
   * Handles various malformed variations like <thhinking>, <thinkking>, etc.
   * @param {string} message - The message to filter
   * @returns {string} - The filtered message
   */
  filterThinkingTags(message) {
    if (!message) return message;

    // Log original message for debugging
    const originalLength = message.length;
    
    // Enhanced pattern to match thinking tags with common misspellings
    // This captures more variations: <thinking>, <thhinking>, <thinkking>, <thinkin>, etc.
    // The pattern now allows for multiple h's and k's
    const openingPattern = /<t+h+[i]*n+k*[i]*n*g*[^>]*>/gi;
    const closingPattern = /<\/t+h+[i]*n+k*[i]*n*g*[^>]*>/gi;
    
    // First, find all opening thinking tags and their positions
    const openingTags = [];
    let match;
    
    while ((match = openingPattern.exec(message)) !== null) {
      openingTags.push({
        tag: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Work backwards through the tags to avoid position shifts
    let filtered = message;
    for (let i = openingTags.length - 1; i >= 0; i--) {
      const opening = openingTags[i];
      
      // Look for a closing tag after this opening tag
      const afterOpening = message.substring(opening.end);
      // Create a specific pattern for this opening tag's closing tag
      const tagName = opening.tag.match(/<(t+h+[i]*n+k*[i]*n*g*)/i)[1];
      const specificClosingPattern = new RegExp(`<\\/${tagName}[^>]*>`, 'i');
      const closingMatch = afterOpening.match(specificClosingPattern);
      
      if (closingMatch) {
        // Found a proper closing tag - remove everything from opening to closing
        const closingStart = opening.end + closingMatch.index;
        const closingEnd = closingStart + closingMatch[0].length;
        
        // Log what we're removing if it contains @review
        const removedContent = filtered.substring(opening.start, closingEnd);
        if (removedContent.includes('@review:')) {
          this.logger.warn('Filtering out @review: marker found inside thinking tags', {
            removedContent: removedContent.substring(0, 100) + '...'
          });
        }
        
        // Remove the entire thinking block, preserving spaces
        const before = filtered.substring(0, opening.start);
        const after = filtered.substring(closingEnd);
        // Add a space if needed to prevent word concatenation
        const needsSpace = before.length > 0 && after.length > 0 && 
                          before[before.length - 1] !== ' ' && after[0] !== ' ';
        filtered = before + (needsSpace ? ' ' : '') + after;
      } else {
        // No closing tag found - remove everything from the opening tag to end of message
        const removedContent = filtered.substring(opening.start);
        if (removedContent.includes('@review:')) {
          this.logger.warn('Filtering out potential @review: after unclosed thinking tag', {
            removedContent: removedContent.substring(0, 100) + '...'
          });
        }
        
        // Remove from opening tag onwards
        filtered = filtered.substring(0, opening.start).trimEnd();
      }
    }

    // Clean up any remaining closing tags without opening tags
    filtered = filtered.replace(closingPattern, '');

    // Clean up any double spaces left behind
    filtered = filtered.replace(/\s\s+/g, ' ').trim();

    // Log if we filtered anything
    if (filtered.length !== originalLength) {
      this.logger.info('Filtered thinking tags from message', {
        originalLength,
        filteredLength: filtered.length,
        removed: originalLength - filtered.length
      });
    }

    return filtered;
  }

  reset() {
    this.logger.info('Parser reset');
    this.conversationBuffer = [];
    this.currentSpeaker = null;
  }
}

export default ClaudeMessageParser;