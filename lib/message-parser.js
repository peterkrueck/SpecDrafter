import stripAnsi from 'strip-ansi';
import { createLogger } from './logger.js';

class MessageParser {
  constructor() {
    this.buffer = '';
    this.lastOutput = '';
    this.logger = createLogger('MSG-PARSER');
  }

  parseGeminiOutput(terminalData) {
    this.logger.debug('Raw terminal input', this.logger.truncateOutput(terminalData, 200));
    
    // Remove all ANSI escape codes (colors, cursor movements, etc.)
    const cleanData = stripAnsi(terminalData);
    this.logger.debug('After ANSI stripping', this.logger.truncateOutput(cleanData, 200));
    
    // Add to buffer for processing
    this.buffer += cleanData;
    
    // Look for complete responses (usually end with newlines or prompts)
    const lines = this.buffer.split('\n');
    
    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';
    
    this.logger.debug('Processing lines', { lineCount: lines.length, bufferRemaining: this.buffer.length });
    
    // Process complete lines
    const processedLines = lines
      .filter(line => {
        const trimmed = line.trim();
        const shouldKeep = trimmed && 
               !trimmed.startsWith('$') && 
               !trimmed.startsWith('>') &&
               !trimmed.startsWith('gemini') &&
               !this.isSystemMessage(trimmed);
        
        this.logger.debug('Line filter decision', { 
          line: this.logger.truncateOutput(trimmed, 100), 
          keep: shouldKeep,
          reason: !shouldKeep ? this.getFilterReason(trimmed) : 'passed'
        });
        
        return shouldKeep;
      })
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (processedLines.length > 0) {
      const response = processedLines.join('\n');
      if (response !== this.lastOutput && response.length > 2) {
        this.lastOutput = response;
        this.logger.info('Message parsed successfully', this.logger.truncateOutput(response, 150));
        return {
          hasMessage: true,
          message: response,
          timestamp: new Date().toISOString()
        };
      } else {
        this.logger.debug('Message rejected - duplicate or too short', { 
          length: response.length, 
          isDuplicate: response === this.lastOutput 
        });
      }
    } else {
      this.logger.debug('No processable lines found');
    }

    return { hasMessage: false };
  }

  getFilterReason(line) {
    if (!line.trim()) return 'empty';
    if (line.startsWith('$')) return 'shell-prompt';
    if (line.startsWith('>')) return 'command-prompt';
    if (line.startsWith('gemini')) return 'gemini-prompt';
    if (this.isSystemMessage(line)) return 'system-message';
    return 'unknown';
  }

  isSystemMessage(line) {
    const systemPatterns = [
      { pattern: /^welcome to/i, name: 'welcome' },
      { pattern: /^type.*help/i, name: 'help' },
      { pattern: /^loading/i, name: 'loading' },
      { pattern: /^connecting/i, name: 'connecting' },
      { pattern: /^\s*$/, name: 'empty' },
      { pattern: /^gemini\s*>/, name: 'gemini-prompt' },
      { pattern: /^\s*\d+\s*ms/, name: 'timing' },
      { pattern: /^✓/, name: 'checkmark' },
      { pattern: /^›/, name: 'arrow' },
      { pattern: /Using:\s*\d+.*files/i, name: 'file-count' },
      { pattern: /MCP server/i, name: 'mcp-server' },
      { pattern: /ctrl\+/i, name: 'keyboard-shortcut' },
      { pattern: /~\/.*\(.*\)\s*no sandbox/i, name: 'sandbox-status' },
      { pattern: /^──+/, name: 'border-horizontal' },
      { pattern: /^\s*│/, name: 'border-vertical' },
      { pattern: /^\s*[╯╰┌└]/, name: 'border-corner' },
      { pattern: /^\s*\[.*\]/, name: 'bracketed' },
      { pattern: /sandbox/i, name: 'sandbox' },
      { pattern: /context left/i, name: 'context-info' }
    ];

    for (const { pattern, name } of systemPatterns) {
      if (pattern.test(line)) {
        this.logger.debug('System message detected', { line: this.logger.truncateOutput(line, 100), pattern: name });
        return true;
      }
    }

    return false;
  }

  reset() {
    this.logger.info('Parser reset - clearing buffer and last output');
    this.buffer = '';
    this.lastOutput = '';
  }

  // Check if there's pending data in buffer that might form a complete message
  flushBuffer() {
    if (this.buffer.trim()) {
      const response = this.buffer.trim();
      this.logger.debug('Flushing buffer', this.logger.truncateOutput(response, 100));
      this.buffer = '';
      
      if (response !== this.lastOutput && !this.isSystemMessage(response)) {
        this.lastOutput = response;
        this.logger.info('Buffer flush produced message', this.logger.truncateOutput(response, 100));
        return {
          hasMessage: true,
          message: response,
          timestamp: new Date().toISOString()
        };
      } else {
        this.logger.debug('Buffer flush rejected - duplicate or system message');
      }
    } else {
      this.logger.debug('Buffer flush - no content to flush');
    }
    
    return { hasMessage: false };
  }
}

export default MessageParser;