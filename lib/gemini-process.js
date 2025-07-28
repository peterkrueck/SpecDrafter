import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createLogger } from './logger.js';

class TmuxGeminiManager {
  constructor() {
    this.sessionName = `specdrafter_${Date.now()}`;
    this.isRunning = false;
    this.eventCallbacks = {};
    this.logger = createLogger('TMUX-GEMINI');
    this.outputBuffer = '';
    this.lastOutputLength = 0;
  }

  on(event, callback) {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  emit(event, data) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => callback(data));
    }
  }

  validateEnvironment() {
    const workingDir = process.cwd();
    const claudeFile = path.join(workingDir, 'CLAUDE.md');
    const geminiFile = path.join(workingDir, 'GEMINI.md');
    const specsDir = path.join(workingDir, 'specs');

    this.logger.debug('Validating environment', { workingDir });

    // Check for instruction files
    if (!fs.existsSync(claudeFile)) {
      this.logger.error('CLAUDE.md not found', { expectedPath: claudeFile });
      throw new Error('CLAUDE.md not found in working directory');
    }
    if (!fs.existsSync(geminiFile)) {
      this.logger.error('GEMINI.md not found', { expectedPath: geminiFile });
      throw new Error('GEMINI.md not found in working directory');
    }

    // Create specs directory if it doesn't exist
    if (!fs.existsSync(specsDir)) {
      this.logger.info('Creating specs directory', { specsDir });
      fs.mkdirSync(specsDir, { recursive: true });
    }

    this.logger.debug('Environment validation successful', { claudeFile, geminiFile, specsDir });
    return { workingDir, claudeFile, geminiFile, specsDir };
  }

  async start() {
    if (this.isRunning) {
      this.logger.warn('Attempted to start already running tmux session');
      return;
    }

    try {
      const { workingDir } = this.validateEnvironment();

      this.logger.info('Creating tmux session for Gemini CLI', { 
        sessionName: this.sessionName, 
        workingDir 
      });

      // Create tmux session
      await this.execCommand(`tmux new-session -d -s ${this.sessionName} -c "${workingDir}" bash`);
      
      // Start Gemini CLI in the session
      await this.execCommand(`tmux send-keys -t ${this.sessionName} "gemini" Enter`);
      
      this.isRunning = true;
      
      // Wait for Gemini to fully load, then skip welcome screen
      setTimeout(async () => {
        await this.skipWelcomeScreen();
        // Start monitoring output after setup is complete
        this.startOutputMonitoring();
      }, 3000);

      this.logger.info('Tmux session with Gemini CLI started successfully', { 
        sessionName: this.sessionName 
      });
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start tmux session', { 
        message: error.message, 
        stack: error.stack 
      });
      this.emit('error', error);
    }
  }

  async write(data) {
    if (this.isRunning) {
      this.logger.debug('Sending command to tmux session', this.logger.truncateOutput(data, 100));
      
      // Reset response tracking for new user input
      this.lastSentResponse = '';
      this.isProcessingResponse = true;
      
      try {
        // Use a more robust approach with file-based input for complex content
        if (data.length > 100 || data.includes('\n') || data.includes('"')) {
          // For complex inputs, use a temporary approach
          const escapedData = data.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
          await this.execCommand(`tmux send-keys -t ${this.sessionName} "${escapedData}" Enter`);
        } else {
          // Simple inputs can use direct send-keys
          await this.execCommand(`tmux send-keys -t ${this.sessionName} "${data}" Enter`);
        }
      } catch (error) {
        this.logger.error('Failed to send command to tmux session', { error: error.message });
      }
    } else {
      this.logger.warn('Cannot write to tmux session - not running', { 
        data: this.logger.truncateOutput(data, 50) 
      });
    }
  }

  async kill() {
    if (this.isRunning) {
      this.logger.info('Killing tmux session', { sessionName: this.sessionName });
      try {
        await this.execCommand(`tmux kill-session -t ${this.sessionName}`);
      } catch (error) {
        this.logger.warn('Error killing tmux session', { error: error.message });
      }
      this.isRunning = false;
      if (this.outputMonitor) {
        clearInterval(this.outputMonitor);
      }
    } else {
      this.logger.debug('Kill requested but tmux session not running');
    }
  }

  async restart() {
    this.logger.info('Restarting tmux session');
    await this.kill();
    setTimeout(async () => {
      await this.start();
    }, 1000);
  }

  // Helper method to execute tmux commands
  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) {
          this.logger.error('Tmux command failed', { command, error: error.message });
          reject(error);
        } else {
          this.logger.debug('Tmux command executed', { command, stdout: stdout.slice(0, 100) });
          resolve(stdout);
        }
      });
    });
  }

  // Capture output from tmux session
  async captureOutput() {
    try {
      const output = await this.execCommand(`tmux capture-pane -t ${this.sessionName} -p`);
      return output;
    } catch (error) {
      this.logger.error('Failed to capture tmux output', { error: error.message });
      return '';
    }
  }

  // Skip the welcome screen and get to ready state
  async skipWelcomeScreen() {
    try {
      this.logger.info('Skipping Gemini welcome screen');
      // Send a space character to properly initialize input state
      await this.execCommand(`tmux send-keys -t ${this.sessionName} " " Enter`);
      
      // Wait for response and then clear it
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear the screen to get to clean state
      await this.execCommand(`tmux send-keys -t ${this.sessionName} "C-c"`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.logger.info('Welcome screen skipped, Gemini ready for input');
    } catch (error) {
      this.logger.error('Failed to skip welcome screen', { error: error.message });
    }
  }

  // Monitor output changes and emit data events
  startOutputMonitoring() {
    this.lastSentResponse = '';
    this.isProcessingResponse = false;
    
    this.outputMonitor = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentOutput = await this.captureOutput();
        
        // Only process if output actually changed
        if (currentOutput !== this.outputBuffer) {
          
          // Check if this is a meaningful change (not just status updates)
          if (this.isMeaningfulOutputChange(this.outputBuffer, currentOutput)) {
            
            // Extract just the response content (remove UI elements)
            const responseContent = this.extractResponseContent(currentOutput);
            
            // Only send if this is a new response (prevent duplicates)
            if (responseContent && responseContent !== this.lastSentResponse && responseContent.length > 10) {
              this.logger.debug('New meaningful response detected', this.logger.truncateOutput(responseContent, 100));
              this.emit('data', currentOutput);
              this.lastSentResponse = responseContent;
              this.isProcessingResponse = false;
            }
          } else {
            this.logger.debug('Status update detected, not sending to frontend');
          }
          
          this.outputBuffer = currentOutput;
        }
      } catch (error) {
        this.logger.error('Error monitoring tmux output', { error: error.message });
      }
    }, 1000); // Check every 1 second for stability
  }

  // Extract the actual response content from the full tmux output
  extractResponseContent(output) {
    if (!output) return '';
    
    // Remove the interface elements and extract just the response
    let content = output
      .replace(/Using: \d+ GEMINI\.md files.*?\n/g, '')
      .replace(/╭[─]+╮/g, '')
      .replace(/╰[─]+╯/g, '')  
      .replace(/│.*?│/g, '')
      .replace(/~\/repos\/SpecDrafter.*?\n/g, '')
      .replace(/\(main\*\).*?\n/g, '')
      .replace(/Tips for getting started:.*?\n/g, '')
      .replace(/\d+\. Ask questions.*?\n/g, '')
      .replace(/gemini-2\.5-pro.*?\n/g, '')
      .trim();
    
    return content;
  }

  // Determine if output change is meaningful (not just status/loading updates)
  isMeaningfulOutputChange(oldOutput, newOutput) {
    if (!oldOutput) return false; // Don't send initial startup messages
    
    // Remove dynamic content for comparison
    const cleanOld = this.cleanOutputForComparison(oldOutput);
    const cleanNew = this.cleanOutputForComparison(newOutput);
    
    // If content is substantially the same, it's just a status update
    const contentChanged = cleanOld !== cleanNew;
    
    // Don't send welcome screen messages
    const isWelcomeMessage = newOutput.includes('Tips for getting started') ||
                           newOutput.includes('Ask questions, edit files, or run commands');
    
    return contentChanged && !isWelcomeMessage;
  }

  // Clean output by removing dynamic elements
  cleanOutputForComparison(output) {
    if (!output) return '';
    
    return output
      // Remove loading spinners
      .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '')
      // Remove status messages with timers
      .replace(/\([^)]*\d+s\)/g, '')
      .replace(/\(esc to cancel[^)]*\)/g, '')
      // Remove context percentage indicators
      .replace(/\(\d+% context[^)]*\)/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export default TmuxGeminiManager;