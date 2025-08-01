import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createLogger } from './logger.js';

class ClaudeProcessManager extends EventEmitter {
  constructor(role, workspacePath) {
    super();
    this.role = role; // 'requirements' or 'review'
    this.workspacePath = workspacePath;
    this.process = null;
    this.hasSession = false;
    this.isRunning = false;
    this.outputBuffer = '';
    this.logger = createLogger(`CLAUDE-${role.toUpperCase()}`);
  }

  async spawn(prompt, usesContinue = false, systemPrompt = null) {
    if (this.isRunning && this.process) {
      this.logger.warn('Attempted to spawn while process already running');
      return;
    }

    try {
      const args = [];
      
      // Add continue flag if we have an existing session
      if (usesContinue && this.hasSession) {
        args.push('-c');
        this.logger.info('Using -c flag for continuing session');
      }
      
      // Add print flag for non-interactive output (required for programmatic use)
      args.push('--print');
      
      // Add prompt using -p flag
      args.push('-p', prompt);
      
      // Add system prompt if provided
      if (systemPrompt) {
        args.push('--system-prompt', systemPrompt);
      }
      
      // Add required flags for proper output
      args.push('--model', 'claude-3-sonnet-20240229');
      args.push('--output-format', 'stream-json');
      args.push('--verbose');
      args.push('--dangerously-skip-permissions');

      this.logger.info('Spawning Claude process', { 
        role: this.role, 
        workspacePath: this.workspacePath,
        args: args 
      });

      this.logger.info('About to spawn claude with full command', {
        command: 'claude',
        args: args,
        cwd: this.workspacePath
      });

      this.process = spawn('claude', args, {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Remove any CI environment variables that might block interactive mode
          CI: undefined,
          CONTINUOUS_INTEGRATION: undefined
        }
      });

      this.logger.info('Process spawned', { pid: this.process.pid });

      this.isRunning = true;
      
      // Set up event handlers
      this.setupProcessHandlers();
      
      // Mark that we now have a session
      if (!this.hasSession) {
        this.hasSession = true;
      }

      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to spawn Claude process', { 
        error: error.message,
        stack: error.stack 
      });
      this.emit('error', error);
    }
  }

  setupProcessHandlers() {
    // Handle stdout data
    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      this.logger.debug('Raw stdout', { data: output });
      this.outputBuffer += output;
      
      // Try to parse complete lines
      const lines = this.outputBuffer.split('\n');
      this.outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      lines.forEach(line => {
        if (line.trim()) {
          this.handleOutput(line);
        }
      });
    });

    // Handle stderr data
    this.process.stderr.on('data', (data) => {
      const error = data.toString();
      this.logger.error('Claude stderr output', { error });
      this.emit('error', new Error(error));
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.logger.info('Claude process exited', { code, signal });
      this.isRunning = false;
      this.process = null;
      this.emit('exit', { code, signal });
    });

    // Handle process errors
    this.process.on('error', (error) => {
      this.logger.error('Claude process error', { 
        error: error.message,
        stack: error.stack 
      });
      this.isRunning = false;
      this.process = null;
      this.emit('error', error);
    });
  }

  handleOutput(line) {
    try {
      // Claude outputs JSONL (JSON Lines) with --output-format stream-json
      const json = JSON.parse(line);
      
      // Handle different message types from Claude's JSON output
      if (json.type === 'system' && json.subtype === 'init') {
        // Session initialization
        this.sessionId = json.session_id;
        this.logger.info('Session initialized', { 
          sessionId: this.sessionId,
          model: json.model,
          tools: json.tools?.length || 0
        });
      } else if (json.type === 'assistant') {
        // Assistant response
        this.logger.info('Assistant message received', {
          messageId: json.message?.id,
          contentLength: JSON.stringify(json.message?.content).length
        });
      } else if (json.type === 'result') {
        // Final result
        this.logger.info('Result received', {
          duration: json.duration_ms,
          cost: json.total_cost_usd
        });
      }
      
      // Always emit the parsed JSON
      this.emit('data', {
        type: 'json',
        content: json,
        raw: line
      });
      
    } catch (error) {
      // If not valid JSON, log and emit as plain message
      this.logger.warn('Non-JSON output from Claude', { 
        line: line.substring(0, 100),
        error: error.message
      });
      
      this.emit('data', {
        type: 'message',
        content: line,
        raw: line
      });
    }
  }

  write(input) {
    if (!this.isRunning || !this.process) {
      this.logger.warn('Cannot write to Claude - process not running');
      return;
    }

    try {
      this.logger.debug('Writing to Claude stdin', { 
        input: input.substring(0, 100) 
      });
      this.process.stdin.write(input + '\n');
    } catch (error) {
      this.logger.error('Failed to write to Claude stdin', { 
        error: error.message 
      });
      this.emit('error', error);
    }
  }

  async kill() {
    if (!this.isRunning || !this.process) {
      this.logger.debug('Kill called but process not running');
      return;
    }

    try {
      this.logger.info('Killing Claude process');
      this.process.kill('SIGTERM');
      
      // Give it 5 seconds to terminate gracefully
      setTimeout(() => {
        if (this.process) {
          this.logger.warn('Force killing Claude process');
          this.process.kill('SIGKILL');
        }
      }, 5000);
    } catch (error) {
      this.logger.error('Error killing Claude process', { 
        error: error.message 
      });
    }
  }

  async restart(prompt, usesContinue = true, systemPrompt = null) {
    this.logger.info('Restarting Claude process');
    await this.kill();
    
    // Wait a bit before restarting
    setTimeout(() => {
      this.spawn(prompt, usesContinue, systemPrompt);
    }, 1000);
  }

  getStatus() {
    return {
      role: this.role,
      isRunning: this.isRunning,
      hasSession: this.hasSession,
      workspacePath: this.workspacePath
    };
  }
}

export default ClaudeProcessManager;