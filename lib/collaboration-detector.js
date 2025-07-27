import stripAnsi from 'strip-ansi';
import { createLogger } from './logger.js';

class CollaborationDetector {
  constructor() {
    this.logger = createLogger('COLLAB-DET');
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
    this.logger.debug('Checking for collaboration patterns', this.logger.truncateOutput(cleanOutput, 150));
    
    // Check for Claude command patterns
    for (let i = 0; i < this.collabPatterns.length; i++) {
      const pattern = this.collabPatterns[i];
      const matches = [...cleanOutput.matchAll(pattern)];
      
      if (matches.length > 0) {
        this.logger.debug(`Pattern ${i} matched`, { 
          pattern: pattern.toString(), 
          matchCount: matches.length 
        });
        
        const commands = matches.map(match => {
          const fullCommand = match[0].trim();
          if (fullCommand !== this.lastCommand) {
            this.lastCommand = fullCommand;
            this.activeCollaboration = true;
            this.logger.info('New Claude collaboration detected', { 
              command: this.logger.truncateOutput(fullCommand, 100),
              prompt: this.logger.truncateOutput(match[1] || 'no-prompt', 100)
            });
            return {
              detected: true,
              command: fullCommand,
              prompt: match[1] || fullCommand.replace(/^claude\s+/, ''),
              timestamp: new Date().toISOString()
            };
          } else {
            this.logger.debug('Duplicate command ignored', { command: this.logger.truncateOutput(fullCommand, 100) });
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
    this.logger.debug('Extracting Claude response', { 
      bufferLength: this.collabBuffer.length,
      newContent: this.logger.truncateOutput(cleanOutput, 100)
    });

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

    this.logger.debug('Response extraction check', {
      hasResponseIndicator,
      hasEndPattern,
      bufferLength: this.collabBuffer.length
    });

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
        this.logger.info('Claude response extracted successfully', {
          responseLength: response.length,
          response: this.logger.truncateOutput(response, 150)
        });
        
        this.collabBuffer = '';
        this.activeCollaboration = false;
        
        return {
          hasResponse: true,
          response,
          timestamp: new Date().toISOString()
        };
      } else {
        this.logger.debug('Response too short, continuing to buffer');
      }
    }

    return { hasResponse: false };
  }

  reset() {
    this.logger.info('Collaboration detector reset');
    this.activeCollaboration = false;
    this.collabBuffer = '';
    this.lastCommand = '';
  }
}

export default CollaborationDetector;