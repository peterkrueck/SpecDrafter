import { EventEmitter } from 'events';
import ClaudeSDKManager from './claude-sdk-manager.js';
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
    this.currentSpecDraft = null;
    
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
      preview: JSON.stringify(data.content).substring(0, 100) 
    });

    // Handle messages from Claude SDK
    if (data.type === 'assistant_response') {
      const textContent = data.content;
      
      // Store Discovery AI response in conversation history
      this.conversationHistory.push({
        role: 'discovery',
        content: textContent,
        timestamp: new Date().toISOString()
      });
      
      // Check for AI-to-AI communication markers at the start of the message
      if (textContent.trimStart().startsWith('@review:')) {
        // Hide chat typing indicator since we're starting AI collaboration
        this.emit('hide_chat_typing', { speaker: 'Discovery AI' });
        // Show Discovery AI typing in collaboration panel
        this.emit('ai_collaboration_typing', { isTyping: true, speaker: 'Discovery AI' });
        this.handleAIToAICommunication('discovery', 'review', textContent);
        return; // Don't emit regular message
      }
      
      // Log if @review: appears but not at start (for safety)
      if (textContent.includes('@review:') && !textContent.trimStart().startsWith('@review:')) {
        this.logger.warn('⚠️ @review: detected but not at message start - routing to USER', {
          position: textContent.indexOf('@review:'),
          preview: textContent.substring(0, 100)
        });
      }
      
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

      // Check if this looks like a draft specification
      if (this.isSpecificationDraft(textContent)) {
        this.logger.info('Draft specification detected, preparing for review');
        this.currentSpecDraft = textContent;
        this.collaborationState = 'reviewing';
        
        // Notify frontend about collaboration
        this.emit('collaboration_detected', {
          type: 'draft_ready',
          from: 'discovery',
          to: 'review'
        });
      }
    }
  }

  async handleReviewOutput(data) {
    this.logger.debug('Review output', { 
      type: data.type, 
      contentType: typeof data.content,
      preview: JSON.stringify(data.content).substring(0, 100) 
    });

    // Handle messages from Claude SDK
    if (data.type === 'assistant_response') {
      const textContent = data.content;
      
      // ALL Review AI output goes to Discovery AI via collaboration channel
      this.logger.info('🤖➡️🤖 Review AI output always routes to Discovery AI', { 
        contentLength: textContent.length 
      });
      
      // Emit AI-to-AI collaboration message for the collaboration tab
      const collaborationData = {
        from: 'Review AI',
        to: 'Discovery AI',
        content: textContent,
        timestamp: new Date().toISOString()
      };
      
      this.emit('ai_collaboration_message', collaborationData);
      
      // Stop typing indicator for Review AI
      this.emit('ai_collaboration_typing', { isTyping: false, speaker: 'Review AI' });
      
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

  async triggerReview() {
    if (!this.currentSpecDraft) {
      this.logger.warn('No draft specification available for review');
      return;
    }

    this.logger.info('Triggering specification review');
    this.activeProcess = 'review';
    
    const reviewPrompt = `Please review this draft specification and provide technical feedback:

${this.currentSpecDraft}

Consider:
1. Technical feasibility
2. Missing implementation details
3. Security considerations
4. Performance implications
5. Integration challenges`;

    await this.reviewProcess.spawn(reviewPrompt, true);
  }

  async sendFeedbackToDiscovery(feedback) {
    this.logger.info('Sending feedback to discovery process');
    this.activeProcess = 'discovery';
    this.collaborationState = 'refining';

    const feedbackPrompt = `The technical reviewer provided this feedback on your specification:

${feedback}

Please revise the specification based on this feedback.`;

    await this.discoveryProcess.spawn(feedbackPrompt, true);
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

  isSpecificationDraft(content) {
    // Simple heuristic to detect specification drafts
    const specKeywords = [
      'specification',
      'requirements',
      'functional requirements',
      'non-functional requirements',
      'architecture',
      'user stories',
      'acceptance criteria'
    ];

    const lowerContent = content.toLowerCase();
    const keywordCount = specKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    ).length;

    // Also check for markdown headers that suggest a spec
    const hasHeaders = /^#{1,3}\s+/m.test(content);
    const hasLists = /^[\-\*]\s+/m.test(content);

    return keywordCount >= 2 && (hasHeaders || hasLists);
  }

  isFeedback(content) {
    // Detect if the review output is feedback vs just acknowledgment
    const feedbackIndicators = [
      'suggest',
      'recommend',
      'consider',
      'missing',
      'should',
      'could',
      'improve',
      'add',
      'clarify',
      'elaborate'
    ];

    const lowerContent = content.toLowerCase();
    return feedbackIndicators.some(indicator => 
      lowerContent.includes(indicator)
    );
  }

  async handleAIToAICommunication(from, to, fullContent) {
    // Validate marker is at the start
    const trimmedContent = fullContent.trimStart();
    const marker = `@${to}:`;
    
    if (!trimmedContent.startsWith(marker)) {
      this.logger.error('❌ AI-to-AI marker not at start of message, aborting routing', {
        marker,
        actualStart: trimmedContent.substring(0, 20),
        from,
        to
      });
      
      // Emit the message to users instead since routing failed
      this.emit('discovery_message', {
        content: fullContent,
        type: 'assistant',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Extract the message after the marker
    const message = trimmedContent.substring(marker.length).trim();
    
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
    
    this.emit('ai_collaboration_message', collaborationData);
    
    // Route the message to the target AI
    if (to === 'review') {
      this.activeProcess = 'review';
      
      // Emit typing indicator for Review AI
      this.emit('ai_collaboration_typing', { isTyping: true, speaker: 'Review AI' });
      
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
    this.currentSpecDraft = null;
    
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
      hasSpecDraft: !!this.currentSpecDraft,
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