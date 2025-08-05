import { query } from '@anthropic-ai/claude-code';
import { EventEmitter } from 'events';
import { createLogger } from './logger.js';
import { getDefaultModel, getModelByCommand } from './models.js';

class ClaudeSDKManager extends EventEmitter {
  constructor(role, workspacePath, modelConfig = null) {
    super();
    this.role = role; // 'discovery' or 'review'
    this.workspacePath = workspacePath;
    this.currentQuery = null;
    this.abortController = null; // Add AbortController for proper cancellation
    this.sessionId = null;
    this.hasSession = false;
    this.isRunning = false;
    this.logger = createLogger(`CLAUDE-${role.toUpperCase()}`);
    
    // Model configuration
    const defaultModel = getDefaultModel();
    this.currentModel = modelConfig?.id || defaultModel.id;
    this.fallbackModel = 'claude-3-5-sonnet-20241022'; // Keep existing fallback
    this.logger.info('Initialized with model', { model: this.currentModel });
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
      // Create new AbortController for this query
      this.abortController = new AbortController();
      
      const options = {
        cwd: this.workspacePath,
        model: this.currentModel,
        fallbackModel: this.fallbackModel,
        permissionMode: 'bypassPermissions', // For automated process
        allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'Task'],
        maxTurns: 10,
        outputFormat: 'stream-json', // Enable detailed streaming events including tool usage
        abortController: this.abortController, // Pass AbortController to query
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
      // Handle AbortError specifically
      if (error.name === 'AbortError') {
        this.logger.info('Query was aborted by user');
        this.emit('aborted');
      } else {
        this.logger.error('Error processing query', {
          error: error.message,
          stack: error.stack
        });
        this.emit('error', error);
      }
    } finally {
      this.isRunning = false;
      this.currentQuery = null;
      this.abortController = null;
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
        // Debug log to see the structure
        this.logger.debug('Assistant message structure', {
          contentType: Array.isArray(message.message.content) ? 'array' : typeof message.message.content,
          contentLength: Array.isArray(message.message.content) ? message.message.content.length : 'N/A',
          role: this.role
        });
        
        // Check for tool usage in the content array first
        if (Array.isArray(message.message.content)) {
          message.message.content.forEach(item => {
            if (item.type === 'tool_use') {
              this.logger.info('Tool usage detected in assistant message', {
                toolName: item.name,
                toolId: item.id,
                role: this.role
              });
              this.emit('data', {
                type: 'tool_use',
                toolName: item.name,
                toolInput: item.input,
                toolId: item.id,
                metadata: item
              });
            }
          });
        }
        
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
    if (!this.isRunning || !this.abortController) {
      this.logger.debug('Kill called but query not running or no abort controller');
      return;
    }

    try {
      this.logger.info('Aborting Claude query');
      // Use AbortController.abort() to properly cancel the query
      this.abortController.abort();
    } catch (error) {
      this.logger.error('Error aborting Claude query', { 
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

  async changeModel(modelId) {
    if (this.isRunning && this.hasSession) {
      // If we have an active session, try to change model using /model command
      const modelConfig = getModelByCommand(modelId) || { id: modelId };
      const modelCommand = modelConfig.command;
      
      if (modelCommand) {
        this.logger.info('Attempting to change model via command', { 
          currentModel: this.currentModel,
          newModel: modelId,
          command: `/model ${modelCommand}`
        });
        
        // Send model change command
        await this.spawn(`/model ${modelCommand}`, true);
        this.currentModel = modelConfig.id || modelId;
        
        this.emit('model_changed', {
          model: this.currentModel,
          role: this.role
        });
      } else {
        this.logger.warn('Model command not found, model will change on next session', { modelId });
        this.currentModel = modelId;
      }
    } else {
      // No active session, just update the model for next spawn
      this.logger.info('Model updated for next session', { 
        currentModel: this.currentModel,
        newModel: modelId 
      });
      this.currentModel = modelId;
      
      this.emit('model_changed', {
        model: this.currentModel,
        role: this.role
      });
    }
  }

  getStatus() {
    return {
      role: this.role,
      isRunning: this.isRunning,
      hasSession: this.hasSession,
      sessionId: this.sessionId,
      workspacePath: this.workspacePath,
      currentModel: this.currentModel
    };
  }
}

export default ClaudeSDKManager;