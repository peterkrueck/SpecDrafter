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
      
      // Start monitoring output
      this.startOutputMonitoring();

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
      try {
        // Send the command to the tmux session
        await this.execCommand(`tmux send-keys -t ${this.sessionName} "${data.replace(/"/g, '\\"')}" Enter`);
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
      exec(command, (error, stdout, stderr) => {
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

  // Monitor output changes and emit data events
  startOutputMonitoring() {
    this.outputMonitor = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentOutput = await this.captureOutput();
        if (currentOutput !== this.outputBuffer) {
          // Only emit the new part of the output
          const newOutput = currentOutput.slice(this.outputBuffer.length);
          if (newOutput.trim()) {
            this.logger.debug('New output detected', this.logger.truncateOutput(newOutput, 150));
            this.emit('data', newOutput);
          }
          this.outputBuffer = currentOutput;
        }
      } catch (error) {
        this.logger.error('Error monitoring tmux output', { error: error.message });
      }
    }, 500); // Check every 500ms
  }
}

export default TmuxGeminiManager;