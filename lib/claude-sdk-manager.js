import { query } from '@anthropic-ai/claude-code';
import { EventEmitter } from 'events';
import { createLogger } from './logger.js';

class ClaudeSDKManager extends EventEmitter {
  constructor(role, workspacePath) {
    super();
    this.role = role; // 'requirements' or 'review'
    this.workspacePath = workspacePath;
    this.currentQuery = null;
    this.sessionId = null;
    this.hasSession = false;
    this.isRunning = false;
    this.logger = createLogger(`CLAUDE-${role.toUpperCase()}`);
  }

  async spawn(prompt, usesContinue = false, systemPrompt = null) {
    if (this.isRunning && this.currentQuery) {
      this.logger.warn('Attempted to spawn while query already running');
      return;
    }

    this.logger.info('spawn() called', {
      role: this.role,
      promptLength: prompt.length,
      usesContinue,
      hasSystemPrompt: !!systemPrompt
    });

    try {
      const options = {
        cwd: this.workspacePath,
        model: 'claude-3-5-sonnet-20241022',
        fallbackModel: 'claude-3-sonnet-20240229',
        permissionMode: 'bypassPermissions', // For automated process
        allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'Task'],
        maxTurns: 10,
        stderr: (data) => {
          this.logger.error('Claude stderr', { data });
          this.emit('error', new Error(data));
        }
      };

      // Add continue/resume based on session state
      if (usesContinue && this.hasSession && this.sessionId) {
        options.resume = this.sessionId;
        this.logger.info('Resuming session', { sessionId: this.sessionId });
      }

      // Add system prompt if provided
      if (systemPrompt) {
        options.customSystemPrompt = systemPrompt;
      }

      this.logger.info('Starting Claude query', { 
        role: this.role, 
        workspacePath: this.workspacePath,
        usesContinue,
        hasSession: this.hasSession
      });

      this.isRunning = true;
      this.currentQuery = query({ prompt, options });
      
      this.logger.info('Query created, emitting started event');
      this.emit('started');
      
      // Process the async generator
      this.logger.info('Starting to process query async generator');
      this.processQuery();
      
    } catch (error) {
      this.logger.error('Failed to start Claude query', { 
        error: error.message,
        stack: error.stack 
      });
      this.emit('error', error);
      this.isRunning = false;
    }
  }

  async processQuery() {
    try {
      this.logger.info('processQuery: Starting async iteration');
      let messageCount = 0;
      
      for await (const message of this.currentQuery) {
        messageCount++;
        this.logger.debug(`processQuery: Received message ${messageCount}`, { type: message.type });
        this.handleMessage(message);
      }
      
      this.logger.info(`processQuery: Completed, processed ${messageCount} messages`);
    } catch (error) {
      this.logger.error('Error processing query', {
        error: error.message,
        stack: error.stack
      });
      this.emit('error', error);
    } finally {
      this.isRunning = false;
      this.currentQuery = null;
      this.emit('exit', { code: 0, signal: null });
    }
  }

  handleMessage(message) {
    this.logger.debug('Received message', { 
      type: message.type,
      preview: JSON.stringify(message).substring(0, 200)
    });

    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          this.sessionId = message.session_id;
          this.hasSession = true;
          this.logger.info('Session initialized', {
            sessionId: this.sessionId,
            model: message.model,
            tools: message.tools?.length || 0
          });
        }
        break;

      case 'assistant':
        // Extract text content from assistant messages
        const textContent = this.extractTextContent(message.message.content);
        if (textContent) {
          this.emit('data', {
            type: 'assistant_response',
            content: textContent,
            metadata: message
          });
        }
        break;

      case 'user':
        // User messages (for tracking)
        this.emit('data', {
          type: 'user_message',
          content: message.message.content,
          metadata: message
        });
        break;

      case 'result':
        // Final result with usage info
        this.logger.info('Query completed', {
          duration: message.duration_ms,
          cost: message.total_cost_usd,
          turns: message.num_turns,
          isError: message.is_error
        });
        
        this.emit('data', {
          type: 'result',
          content: message.result || '',
          metadata: message
        });
        break;

      default:
        this.logger.warn('Unknown message type', { type: message.type });
    }
  }

  extractTextContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
    }
    
    return '';
  }

  async write(input) {
    this.logger.warn('Write method called but not supported in SDK mode', { input });
    // In SDK mode, we can't write to an ongoing conversation
    // We would need to restart with a new prompt
  }

  async kill() {
    if (!this.isRunning || !this.currentQuery) {
      this.logger.debug('Kill called but query not running');
      return;
    }

    try {
      this.logger.info('Interrupting Claude query');
      if (this.currentQuery.interrupt) {
        await this.currentQuery.interrupt();
      }
    } catch (error) {
      this.logger.error('Error interrupting Claude query', { 
        error: error.message 
      });
    }
  }

  async restart(prompt, usesContinue = true, systemPrompt = null) {
    this.logger.info('Restarting Claude query');
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
      sessionId: this.sessionId,
      workspacePath: this.workspacePath
    };
  }
}

export default ClaudeSDKManager;