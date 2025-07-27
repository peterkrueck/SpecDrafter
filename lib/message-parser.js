import stripAnsi from 'strip-ansi';

class MessageParser {
  constructor() {
    this.buffer = '';
    this.lastOutput = '';
  }

  parseGeminiOutput(terminalData) {
    // Remove all ANSI escape codes (colors, cursor movements, etc.)
    const cleanData = stripAnsi(terminalData);
    
    // Add to buffer for processing
    this.buffer += cleanData;
    
    // Look for complete responses (usually end with newlines or prompts)
    const lines = this.buffer.split('\n');
    
    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';
    
    // Process complete lines
    const processedLines = lines
      .filter(line => {
        const trimmed = line.trim();
        // Filter out shell prompts, commands, and empty lines
        return trimmed && 
               !trimmed.startsWith('$') && 
               !trimmed.startsWith('>') &&
               !trimmed.startsWith('gemini') &&
               !this.isSystemMessage(trimmed);
      })
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (processedLines.length > 0) {
      const response = processedLines.join('\n');
      if (response !== this.lastOutput && response.length > 2) {
        this.lastOutput = response;
        return {
          hasMessage: true,
          message: response,
          timestamp: new Date().toISOString()
        };
      }
    }

    return { hasMessage: false };
  }

  isSystemMessage(line) {
    const systemPatterns = [
      /^welcome to/i,
      /^type.*help/i,
      /^loading/i,
      /^connecting/i,
      /^\s*$/,
      /^gemini\s*>/,
      /^\s*\d+\s*ms/,
      /^✓/,
      /^›/
    ];

    return systemPatterns.some(pattern => pattern.test(line));
  }

  reset() {
    this.buffer = '';
    this.lastOutput = '';
  }

  // Check if there's pending data in buffer that might form a complete message
  flushBuffer() {
    if (this.buffer.trim()) {
      const response = this.buffer.trim();
      this.buffer = '';
      
      if (response !== this.lastOutput && !this.isSystemMessage(response)) {
        this.lastOutput = response;
        return {
          hasMessage: true,
          message: response,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return { hasMessage: false };
  }
}

export default MessageParser;