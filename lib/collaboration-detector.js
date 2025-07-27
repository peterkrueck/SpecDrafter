import stripAnsi from 'strip-ansi';

class CollaborationDetector {
  constructor() {
    this.collabPatterns = [
      /claude\s+-p\s+"([^"]+)"/g,
      /claude\s+--continue\s+-p\s+"([^"]+)"/g,
      /claude\s+-p\s+'([^']+)'/g,
      /claude\s+--continue\s+-p\s+'([^']+)'/g,
      /claude\s+([^-\s][^\n]*)/g
    ];
    
    this.activeCollaboration = false;
    this.collabBuffer = '';
    this.lastCommand = '';
  }

  detectCollaboration(terminalOutput) {
    const cleanOutput = stripAnsi(terminalOutput);
    
    // Check for Claude command patterns
    for (const pattern of this.collabPatterns) {
      const matches = [...cleanOutput.matchAll(pattern)];
      
      if (matches.length > 0) {
        const commands = matches.map(match => {
          const fullCommand = match[0].trim();
          if (fullCommand !== this.lastCommand) {
            this.lastCommand = fullCommand;
            this.activeCollaboration = true;
            return {
              detected: true,
              command: fullCommand,
              prompt: match[1] || fullCommand.replace(/^claude\s+/, ''),
              timestamp: new Date().toISOString()
            };
          }
          return null;
        }).filter(Boolean);

        if (commands.length > 0) {
          return commands[0]; // Return first new command
        }
      }
    }

    return { detected: false };
  }

  extractClaudeResponse(terminalOutput) {
    if (!this.activeCollaboration) {
      return { hasResponse: false };
    }

    const cleanOutput = stripAnsi(terminalOutput);
    this.collabBuffer += cleanOutput;

    // Look for patterns that indicate Claude is responding
    const responseIndicators = [
      /I'll help/i,
      /Let me/i,
      /Here's/i,
      /I can/i,
      /To implement/i,
      /The specification/i,
      /Looking at/i,
      /Based on/i
    ];

    // Check if this looks like a Claude response
    const hasResponseIndicator = responseIndicators.some(pattern => 
      pattern.test(this.collabBuffer)
    );

    // Look for end-of-response patterns
    const endPatterns = [
      /gemini\s*>/i,
      /\n\s*$/,
      /```\s*$/
    ];

    const hasEndPattern = endPatterns.some(pattern => 
      pattern.test(this.collabBuffer)
    );

    if (hasResponseIndicator && (hasEndPattern || this.collabBuffer.length > 200)) {
      // Extract the response content
      const response = this.collabBuffer
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && 
                 !trimmed.startsWith('$') && 
                 !trimmed.startsWith('>') &&
                 !trimmed.startsWith('gemini');
        })
        .join('\n')
        .trim();

      if (response.length > 10) {
        this.collabBuffer = '';
        this.activeCollaboration = false;
        
        return {
          hasResponse: true,
          response,
          timestamp: new Date().toISOString()
        };
      }
    }

    return { hasResponse: false };
  }

  reset() {
    this.activeCollaboration = false;
    this.collabBuffer = '';
    this.lastCommand = '';
  }
}

export default CollaborationDetector;