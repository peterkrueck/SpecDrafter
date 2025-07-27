import pty from 'node-pty';
import path from 'path';
import fs from 'fs';
import { createLogger } from './logger.js';

class GeminiProcessManager {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.eventCallbacks = {};
    this.logger = createLogger('GEMINI-PROC');
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

  start() {
    if (this.isRunning) {
      this.logger.warn('Attempted to start already running Gemini process');
      return;
    }

    try {
      const { workingDir } = this.validateEnvironment();

      this.logger.info('Starting Gemini CLI process', { workingDir });
      this.process = pty.spawn('gemini', [], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: workingDir,
        env: process.env
      });

      this.isRunning = true;

      this.process.onData((data) => {
        this.logger.debug('Raw terminal data received', this.logger.truncateOutput(data, 150));
        this.emit('data', data);
      });

      this.process.onExit((exitCode) => {
        this.logger.info('Gemini process exited', { exitCode });
        this.isRunning = false;
        this.emit('exit', exitCode);
      });

      this.logger.info('Gemini CLI process started successfully', { pid: this.process.pid });
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start Gemini process', { 
        message: error.message, 
        stack: error.stack 
      });
      this.emit('error', error);
    }
  }

  write(data) {
    if (this.process && this.isRunning) {
      this.logger.debug('Writing to Gemini process', this.logger.truncateOutput(data, 100));
      this.process.write(data);
    } else {
      this.logger.warn('Cannot write to Gemini process - not running', { data: this.logger.truncateOutput(data, 50) });
    }
  }

  kill() {
    if (this.process && this.isRunning) {
      this.logger.info('Killing Gemini process', { pid: this.process.pid });
      this.process.kill();
      this.isRunning = false;
    } else {
      this.logger.debug('Kill requested but process not running');
    }
  }

  restart() {
    this.logger.info('Restarting Gemini process');
    this.kill();
    setTimeout(() => {
      this.start();
    }, 1000);
  }
}

export default GeminiProcessManager;