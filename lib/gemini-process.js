import pty from 'node-pty';
import path from 'path';
import fs from 'fs';

class GeminiProcessManager {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.eventCallbacks = {};
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

    // Check for instruction files
    if (!fs.existsSync(claudeFile)) {
      throw new Error('CLAUDE.md not found in working directory');
    }
    if (!fs.existsSync(geminiFile)) {
      throw new Error('GEMINI.md not found in working directory');
    }

    // Create specs directory if it doesn't exist
    if (!fs.existsSync(specsDir)) {
      fs.mkdirSync(specsDir, { recursive: true });
    }

    return { workingDir, claudeFile, geminiFile, specsDir };
  }

  start() {
    if (this.isRunning) {
      console.log('Gemini process already running');
      return;
    }

    try {
      const { workingDir } = this.validateEnvironment();

      console.log('Starting Gemini CLI process...');
      this.process = pty.spawn('gemini', [], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: workingDir,
        env: process.env
      });

      this.isRunning = true;

      this.process.onData((data) => {
        this.emit('data', data);
      });

      this.process.onExit((exitCode) => {
        console.log(`Gemini process exited with code: ${exitCode}`);
        this.isRunning = false;
        this.emit('exit', exitCode);
      });

      console.log('Gemini CLI process started successfully');
      this.emit('started');

    } catch (error) {
      console.error('Failed to start Gemini process:', error.message);
      this.emit('error', error);
    }
  }

  write(data) {
    if (this.process && this.isRunning) {
      this.process.write(data);
    } else {
      console.warn('Cannot write to Gemini process - not running');
    }
  }

  kill() {
    if (this.process && this.isRunning) {
      console.log('Killing Gemini process...');
      this.process.kill();
      this.isRunning = false;
    }
  }

  restart() {
    console.log('Restarting Gemini process...');
    this.kill();
    setTimeout(() => {
      this.start();
    }, 1000);
  }
}

export default GeminiProcessManager;