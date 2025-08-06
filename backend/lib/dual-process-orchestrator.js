import { EventEmitter } from 'events';
import ClaudeSDKManager from './claude-sdk-manager.js';
import ClaudeMessageParser from './claude-message-parser.js';
import messageSplitter from './message-splitter.js';
import { createLogger } from './logger.js';
import { getDefaultModel, getModelById } from './models.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DualProcessOrchestrator extends EventEmitter {
  constructor(modelConfig = null) {
    super();
    this.logger = createLogger('ORCHESTRATOR');
    
    // Initialize message parser for filtering thinking tags
    this.messageParser = new ClaudeMessageParser();
    
    // Model configuration - both processes use the same model
    this.currentModelConfig = modelConfig || getDefaultModel();
    this.logger.info('Initializing orchestrator with model', { 
      model: this.currentModelConfig.id 
    });
    
    // Initialize both Claude processes
    const discoveryPath = path.join(__dirname, '../workspaces/requirements-discovery');
    const reviewPath = path.join(__dirname, '../workspaces/technical-review');
    
    this.discoveryProcess = new ClaudeSDKManager('discovery', discoveryPath, this.currentModelConfig);
    this.reviewProcess = new ClaudeSDKManager('review', reviewPath, this.currentModelConfig);
    
    // Current state
    this.activeProcess = 'discovery';
    this.collaborationState = 'discovering'; // discovering → drafting → reviewing → refining
    
    // Conversation history tracking
    this.conversationHistory = [];
    this.hasReviewBeenTriggered = false;
    
    // Setup event handlers
    this.setupProcessHandlers();
  }

  setupProcessHandlers() {
    // Discovery process handlers
    this.discoveryProcess.on('data', (data) => {
      this.handleDiscoveryOutput(data);
    });

    this.discoveryProcess.on('error', (error) => {
      this.logger.error('Discovery process error', { error: error.message });
      // Clear typing indicators on error
      this.emit('typing_indicator', { isTyping: false, speaker: 'Discovery AI' });
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Discovery AI' });
      this.emit('error', { process: 'discovery', error });
    });

    this.discoveryProcess.on('exit', (exitInfo) => {
      this.logger.warn('Discovery process exited', exitInfo);
      // Clear typing indicators on exit
      this.emit('typing_indicator', { isTyping: false, speaker: 'Discovery AI' });
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Discovery AI' });
      this.emit('process_exit', { process: 'discovery', ...exitInfo });
    });

    // Add handler for abort
    this.discoveryProcess.on('aborted', () => {
      this.logger.info('Discovery process aborted');
      // Clear typing indicators on abort
      this.emit('typing_indicator', { isTyping: false, speaker: 'Discovery AI' });
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Discovery AI' });
    });

    // Review process handlers
    this.reviewProcess.on('data', (data) => {
      this.handleReviewOutput(data);
    });

    this.reviewProcess.on('error', (error) => {
      this.logger.error('Review process error', { error: error.message });
      // Clear typing indicators on error
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Review AI' });
      this.emit('error', { process: 'review', error });
    });

    this.reviewProcess.on('exit', (exitInfo) => {
      this.logger.warn('Review process exited', exitInfo);
      // Clear typing indicators on exit
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Review AI' });
      this.emit('process_exit', { process: 'review', ...exitInfo });
    });

    // Add handler for abort
    this.reviewProcess.on('aborted', () => {
      this.logger.info('Review process aborted');
      // Clear typing indicators on abort
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Review AI' });
    });
  }

  handleDiscoveryOutput(data) {
    this.logger.debug('Discovery output', { 
      type: data.type, 
      contentType: typeof data.content,
      preview: data.content ? JSON.stringify(data.content).substring(0, 100) : 'No content'
    });

    // Handle messages from Claude SDK
    if (data.type === 'tool_use') {
      // Handle tool usage events
      this.logger.info('🔧 Tool usage detected from Discovery AI', {
        toolName: data.toolName,
        toolId: data.toolId
      });
      
      // Check if it's a Write tool being used to create spec.md
      if (data.toolName === 'Write' && data.toolInput?.file_path?.includes('spec.md')) {
        this.logger.info('📝 Spec writing started', {
          filePath: data.toolInput.file_path,
          toolId: data.toolId
        });
        
        this.emit('spec_writing_started', {
          filePath: data.toolInput.file_path,
          toolId: data.toolId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Only emit specific tool usage for visual feedback in collaboration view
      const allowedToolsForUI = [
        'Task', 'WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'MultiEdit',
        'mcp__context7__get-library-docs', 'mcp__deepwiki__ask_question'
      ];
      
      if (allowedToolsForUI.includes(data.toolName)) {
        let description = '';
        switch (data.toolName) {
          case 'Task':
            description = `Running task: ${data.toolInput?.description || 'Complex task'}`;
            break;
          case 'WebSearch':
            description = `Searching web for: ${data.toolInput?.query || 'information'}`;
            break;
          case 'WebFetch':
            description = `Fetching content from: ${data.toolInput?.url || 'web resource'}`;
            break;
          case 'Write':
            description = `Writing to: ${data.toolInput?.file_path?.split('/').pop() || 'file'}`;
            break;
          case 'Edit':
          case 'MultiEdit':
            description = `Editing: ${data.toolInput?.file_path?.split('/').pop() || 'file'}`;
            break;
          case 'Read':
            description = `Reading: ${data.toolInput?.file_path?.split('/').pop() || 'file'}`;
            break;
          case 'mcp__context7__get-library-docs':
            description = `Fetching documentation for: ${data.toolInput?.context7CompatibleLibraryID || 'library'}`;
            break;
          case 'mcp__deepwiki__ask_question':
            description = `Asking about: ${data.toolInput?.repoName || 'repository'}`;
            break;
        }
        
        this.emit('ai_collaboration_tool_usage', {
          from: 'Discovery AI',
          toolName: data.toolName,
          toolId: data.toolId,
          description: description,
          timestamp: new Date().toISOString(),
          isSystemMessage: true
        });
      }
      
      return;
    }
    
    if (data.type === 'assistant_response') {
      const rawContent = data.content;
      
      // CRITICAL: Filter thinking tags BEFORE any routing logic
      const textContent = this.messageParser.filterThinkingTags(rawContent);
      
      // Emit tools complete event since assistant is now responding
      this.emit('ai_collaboration_tools_complete', {
        from: 'Discovery AI',
        timestamp: new Date().toISOString()
      });
      
      // Store filtered Discovery AI response in conversation history
      this.conversationHistory.push({
        role: 'discovery',
        content: textContent, // Store filtered content
        timestamp: new Date().toISOString()
      });
      
      // Use the message splitter for consistent splitting logic
      const splitResult = messageSplitter.split(textContent);
      
      // Extract the same variables for backward compatibility
      const reviewMarkerIndex = splitResult.markerIndex;
      const beforeReview = splitResult.beforeMarker;
      const afterReview = splitResult.afterMarker;
      
      // Add comprehensive logging for debugging
      this.logger.info('📊 Message split decision', {
        hasMarker: splitResult.hasMarker,
        markerPosition: splitResult.markerIndex,
        markerType: splitResult.markerType,
        stats: splitResult.stats,
        beforePreview: beforeReview ? beforeReview.substring(0, 50) : '',
        afterPreview: afterReview ? afterReview.substring(0, 50) : ''
      });
      
      if (reviewMarkerIndex !== -1) {
        // Split the message: before @review: goes to user, after goes to Review AI
        
        this.logger.info('🔄 @review: marker found, splitting message', {
          markerPosition: reviewMarkerIndex,
          beforeLength: beforeReview.length,
          afterLength: afterReview.length
        });
        
        // If there's content before @review:, send it to the user first
        if (beforeReview.length > 0) {
          this.logger.info('📤 Sending pre-review content to USER', {
            contentLength: beforeReview.length,
            preview: beforeReview.substring(0, 50) + (beforeReview.length > 50 ? '...' : '')
          });
          
          this.emit('discovery_message', {
            content: beforeReview,
            type: 'assistant',
            metadata: data.metadata,
            timestamp: new Date().toISOString()
          });
        }
        
        // Hide chat typing indicator since we're starting AI collaboration
        this.emit('hide_chat_typing', { speaker: 'Discovery AI' });
        // Stop Discovery AI typing in collaboration panel (it just finished)
        this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Discovery AI' });
        
        // Send everything from @review: onward to Review AI
        this.handleAIToAICommunication('discovery', 'review', afterReview);
        return;
      }
      
      // No @review: marker found, emit entire message to user
      
      // Emit typing stopped for AI collaboration if we were in collaboration
      if (this.activeProcess === 'discovery' && this.collaborationState !== 'discovering') {
        this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Discovery AI' });
      }
      
      // Emit to frontend (this goes to users)
      this.logger.info('📤 Sending message to USER via chat panel', {
        contentLength: textContent.length,
        preview: textContent.substring(0, 50) + (textContent.length > 50 ? '...' : '')
      });
      
      this.emit('discovery_message', {
        content: textContent,
        type: 'assistant',
        metadata: data.metadata,
        timestamp: new Date().toISOString()
      });

    }
  }

  async handleReviewOutput(data) {
    this.logger.debug('Review output', { 
      type: data.type, 
      contentType: typeof data.content,
      preview: data.content ? JSON.stringify(data.content).substring(0, 100) : 'No content'
    });

    // Handle messages from Claude SDK
    if (data.type === 'tool_use') {
      // Emit Review AI tool usage for visual feedback in collaboration view
      this.logger.info('🔧 Review AI tool usage detected', {
        toolName: data.toolName,
        toolId: data.toolId
      });
      
      // Only emit specific tool usage for visual feedback
      const allowedReviewTools = [
        'Task', 'WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'MultiEdit',
        'mcp__context7__get-library-docs', 'mcp__deepwiki__ask_question'
      ];
      
      if (allowedReviewTools.includes(data.toolName)) {
        let description = '';
        switch (data.toolName) {
          case 'Task':
            description = `Running analysis task: ${data.toolInput?.description || 'Complex analysis'}`;
            break;
          case 'WebSearch':
            description = `Searching web for: ${data.toolInput?.query || 'information'}`;
            break;
          case 'WebFetch':
            description = `Fetching content from: ${data.toolInput?.url || 'web resource'}`;
            break;
          case 'Read':
            description = `Reading file: ${data.toolInput?.file_path?.split('/').pop() || 'file'}`;
            break;
          case 'Write':
            description = `Writing to: ${data.toolInput?.file_path?.split('/').pop() || 'file'}`;
            break;
          case 'Edit':
          case 'MultiEdit':
            description = `Editing: ${data.toolInput?.file_path?.split('/').pop() || 'file'}`;
            break;
          case 'mcp__context7__get-library-docs':
            description = `Fetching documentation for: ${data.toolInput?.context7CompatibleLibraryID || 'library'}`;
            break;
          case 'mcp__deepwiki__ask_question':
            description = `Asking about: ${data.toolInput?.repoName || 'repository'}`;
            break;
        }
        
        // Emit as a special collaboration message for visual feedback
        this.emit('ai_collaboration_tool_usage', {
          from: 'Review AI',
          toolName: data.toolName,
          toolId: data.toolId,
          description: description,
          timestamp: new Date().toISOString(),
          isSystemMessage: true
        });
      }
      
      return;
    }
    
    if (data.type === 'assistant_response') {
      const rawContent = data.content;
      
      // Filter thinking tags from Review AI output too
      const textContent = this.messageParser.filterThinkingTags(rawContent);
      
      // Emit tools complete event since assistant is now responding
      this.emit('ai_collaboration_tools_complete', {
        from: 'Review AI',
        timestamp: new Date().toISOString()
      });
      
      // ALL Review AI output goes to Discovery AI via collaboration channel
      this.logger.info('🤖➡️🤖 Review AI output always routes to Discovery AI', { 
        contentLength: textContent.length 
      });
      
      // Emit AI-to-AI collaboration message for the collaboration tab (with filtered content)
      const collaborationData = {
        from: 'Review AI',
        to: 'Discovery AI',
        content: textContent, // Use filtered content
        timestamp: new Date().toISOString()
      };
      
      // Stop typing indicator for Review AI BEFORE emitting the message
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Review AI' });
      
      // Emit AI-to-AI collaboration message for the collaboration tab
      this.emit('ai_collaboration_message', collaborationData);
      
      // Automatically forward to Discovery AI
      this.activeProcess = 'discovery';
      
      // Emit typing indicator for Discovery AI receiving feedback
      this.emit('ai_collaboration_typing', { isTyping: true, speaker: 'Discovery AI' });
      
      const forwardMessage = `Technical Review feedback:\n\n${textContent}`;
      this.logger.info('🔄 Forwarding Review AI output to Discovery AI', { 
        messageLength: forwardMessage.length,
        hasThinkingTrigger: true 
      });
      
      // Use spawn to send the message to Discovery AI with "think harder" trigger
      await this.discoveryProcess.spawn(forwardMessage + ' think harder', true);
      
      // Update collaboration state
      this.collaborationState = 'refining';
      
      this.emit('collaboration_detected', {
        type: 'feedback_ready',
        from: 'review',
        to: 'discovery'
      });
    }
  }

  async startProcesses(initialMessage = null) {
    this.logger.info('🚀 startProcesses() called', { hasInitialMessage: !!initialMessage });
    
    // Log workspace paths for debugging
    const discoveryPath = path.join(__dirname, '../workspaces/requirements-discovery');
    const reviewPath = path.join(__dirname, '../workspaces/technical-review');
    this.logger.info('🔍 ORCHESTRATOR WORKSPACE DIAGNOSTICS:');
    this.logger.info(`  Discovery AI workspace: ${discoveryPath}`);
    this.logger.info(`  Review AI workspace: ${reviewPath}`);
    this.logger.info(`  Discovery workspace exists: ${fs.existsSync(discoveryPath)}`);
    this.logger.info(`  Review workspace exists: ${fs.existsSync(reviewPath)}`);
    
    try {
      // If initial message provided, use it as the first prompt
      // Otherwise, send a generic greeting (for backward compatibility)
      const discoveryPrompt = initialMessage || 
        `Hello! I'm ready to help discover requirements for a new project. Please tell me what you'd like to build.`;
      
      this.logger.info('🤖 Spawning discovery process...', { 
        usingInitialMessage: !!initialMessage 
      });
      await this.discoveryProcess.spawn(discoveryPrompt, false);
      this.logger.info('✅ Discovery process spawned successfully');

      // Review AI will be started on-demand when needed
      // No need to spawn it during initialization
      this.logger.info('ℹ️ Review AI will be started on-demand when needed');
      
      this.logger.info('🎉 Discovery process ready, emitting processes_started event');
      this.emit('processes_started');
    } catch (error) {
      this.logger.error('❌ Failed to start processes', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async routeUserMessage(message) {
    this.logger.info('📨 Routing user message', { 
      activeProcess: this.activeProcess,
      collaborationState: this.collaborationState,
      messageLength: message.length
    });

    // Store user message in conversation history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // ALWAYS route user messages to Discovery AI
    // Review AI is a backend service that doesn't interact with users
    // Append "think hard" to trigger reasoning mode (invisible to user)
    const prompt = `The user says: "${message}" think hard`;
    this.logger.info('🔄 Sending message to Discovery AI', { 
      promptLength: prompt.length,
      hasThinkingTrigger: true 
    });
    
    // Ensure we're on discovery process
    this.activeProcess = 'discovery';
    
    // Emit typing indicator as Discovery AI is about to process the message
    this.emit('typing_indicator', { isTyping: true, speaker: 'Discovery AI' });
    
    await this.discoveryProcess.spawn(prompt, true);
  }


  switchActiveProcess(processName) {
    // Review AI is now a backend service - users can't switch to it
    if (processName === 'review') {
      this.logger.warn('Cannot switch to Review AI - it is a backend service for Discovery AI');
      return;
    }
    
    if (processName !== 'discovery' && processName !== 'requirements') {
      this.logger.error('Invalid process name', { processName });
      return;
    }

    // Map 'requirements' to 'discovery' for backward compatibility
    this.activeProcess = processName === 'requirements' ? 'discovery' : processName;
    this.logger.info('Switched active process', { activeProcess: this.activeProcess });
    
    this.emit('active_process_changed', { 
      activeProcess: this.activeProcess 
    });
  }


  async handleAIToAICommunication(from, to, fullContent) {
    // Extract the message after the marker (we know it starts with @review: from the caller)
    const marker = `@${to}:`;
    const markerIndex = fullContent.indexOf(marker);
    
    if (markerIndex === -1) {
      this.logger.error('❌ AI-to-AI marker not found in message', {
        marker,
        from,
        to,
        contentPreview: fullContent.substring(0, 50)
      });
      return;
    }
    
    // Extract the message after the marker
    const message = fullContent.substring(markerIndex + marker.length).trim();
    
    this.logger.info('🤖↔️🤖 AI-to-AI communication detected', { 
      from, 
      to, 
      messageLength: message.length,
      marker,
      fullContentLength: fullContent.length,
      messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : '')
    });
    
    // Emit the AI-to-AI message for the collaboration tab
    const collaborationData = {
      from: from === 'discovery' ? 'Discovery AI' : 'Review AI',
      to: to === 'discovery' ? 'Discovery AI' : 'Review AI',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    this.logger.info('📡 Emitting ai_collaboration_message event', { 
      from: collaborationData.from, 
      to: collaborationData.to,
      contentLength: collaborationData.content.length
    });
    
    // Route the message to the target AI
    if (to === 'review') {
      this.activeProcess = 'review';
      
      // Emit typing indicator for Review AI BEFORE the message
      this.emit('ai_collaboration_typing', { isTyping: true, speaker: 'Review AI' });
    }
    
    // Emit the AI-to-AI message for the collaboration tab (after typing indicator)
    this.emit('ai_collaboration_message', collaborationData);
    
    // Continue with review processing
    if (to === 'review') {
      
      // Check if this is the first review message
      let messageToSend = message;
      if (!this.hasReviewBeenTriggered) {
        // Include conversation history for first Review AI message
        const conversationContext = this.formatConversationHistory();
        messageToSend = conversationContext + message;
        this.hasReviewBeenTriggered = true;
        this.logger.info('📋 Including conversation history for first Review AI message', {
          historyLength: this.conversationHistory.length,
          totalMessageLength: messageToSend.length
        });
      }
      
      // Check if Review AI needs to be started (lazy initialization)
      if (!this.reviewProcess.isRunning) {
        this.logger.info('🚀 Starting Review AI on demand for first review request', {
          hasThinkingTrigger: true
        });
        // Append "think harder" trigger for AI reasoning mode
        await this.reviewProcess.spawn(messageToSend + ' think harder', false); // false = not continue, this is the first message
      } else {
        this.logger.info('🔄 Routing AI message to Review AI', { 
          messageLength: messageToSend.length,
          hasThinkingTrigger: true 
        });
        // Append "think harder" trigger for AI reasoning mode
        await this.reviewProcess.spawn(messageToSend + ' think harder', true); // true = continue existing session
      }
    } else if (to === 'discovery') {
      this.activeProcess = 'discovery';
      
      // Emit typing indicator for Discovery AI
      this.emit('ai_collaboration_typing', { isTyping: true, speaker: 'Discovery AI' });
      
      this.logger.info('🔄 Routing AI message to Discovery AI', { 
        messageLength: message.length,
        hasThinkingTrigger: true 
      });
      // Append "think harder" trigger for AI reasoning mode
      await this.discoveryProcess.spawn(message + ' think harder', true);
    }
  }

  async resetProcesses() {
    this.logger.info('Resetting processes');
    
    // Kill both processes if they're running
    await this.discoveryProcess.kill();
    if (this.reviewProcess.isRunning) {
      await this.reviewProcess.kill();
    }
    
    this.activeProcess = 'discovery';
    this.collaborationState = 'discovering';
    
    // Clear conversation history
    this.conversationHistory = [];
    this.hasReviewBeenTriggered = false;
    
    // Restart only Discovery AI after a delay
    // Review AI will be started on-demand
    setTimeout(() => {
      this.startProcesses();
    }, 2000);
  }

  async changeModel(modelId) {
    this.logger.info('Changing model for both processes', { modelId });
    
    // Update model configuration
    const newModelConfig = getModelById(modelId);
    if (!newModelConfig) {
      this.logger.error('Invalid model ID', { modelId });
      throw new Error(`Invalid model ID: ${modelId}`);
    }
    
    this.currentModelConfig = newModelConfig;
    
    // Change model for both processes
    await Promise.all([
      this.discoveryProcess.changeModel(modelId),
      this.reviewProcess.changeModel(modelId)
    ]);
    
    this.emit('model_changed', {
      model: this.currentModelConfig,
      activeProcess: this.activeProcess
    });
  }

  getStatus() {
    return {
      activeProcess: this.activeProcess,
      collaborationState: this.collaborationState,
      currentModel: this.currentModelConfig,
      processes: {
        discovery: this.discoveryProcess.getStatus(),
        review: this.reviewProcess.getStatus()
      }
    };
  }

  async shutdown() {
    this.logger.info('Shutting down orchestrator');
    await this.discoveryProcess.kill();
    await this.reviewProcess.kill();
  }

  async stopAllProcesses() {
    this.logger.info('Stopping all AI processes immediately');
    
    // Kill both processes
    await this.discoveryProcess.kill();
    await this.reviewProcess.kill();
    
    // Clear all typing indicators
    this.emit('typing_indicator', { isTyping: false, speaker: 'Discovery AI' });
    this.emit('typing_indicator', { isTyping: false, speaker: 'Review AI' });
    this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Discovery AI' });
    this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Review AI' });
    
    // Emit a confirmation event
    this.emit('processes_stopped');
    
    this.logger.info('All processes stopped');
  }

  formatConversationHistory() {
    if (this.conversationHistory.length === 0) {
      return '';
    }

    let formattedHistory = '=== PREVIOUS CONVERSATION CONTEXT ===\n\n';
    formattedHistory += 'This is the conversation that occurred before your first involvement:\n\n';

    for (const entry of this.conversationHistory) {
      const role = entry.role === 'user' ? 'USER' : 'DISCOVERY AI';
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      formattedHistory += `[${timestamp}] ${role}:\n${entry.content}\n\n`;
    }

    formattedHistory += '=== END OF CONVERSATION CONTEXT ===\n\n';
    formattedHistory += 'Now, please address the following request with full awareness of the above context:\n\n';

    return formattedHistory;
  }
}

export default DualProcessOrchestrator;