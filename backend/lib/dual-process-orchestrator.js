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
      this.emit('error', { process: 'discovery', error });
    });

    this.discoveryProcess.on('exit', (exitInfo) => {
      this.logger.warn('Discovery process exited', exitInfo);
      this.emit('process_exit', { process: 'discovery', ...exitInfo });
    });

    // Review process handlers
    this.reviewProcess.on('data', (data) => {
      this.handleReviewOutput(data);
    });

    this.reviewProcess.on('error', (error) => {
      this.logger.error('Review process error', { error: error.message });
      this.emit('error', { process: 'review', error });
    });

    this.reviewProcess.on('exit', (exitInfo) => {
      this.logger.warn('Review process exited', exitInfo);
      this.emit('process_exit', { process: 'review', ...exitInfo });
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
      
      // Check for AI-to-AI communication markers
      if (textContent.includes('@review:')) {
        this.handleAIToAICommunication('discovery', 'review', textContent);
        return; // Don't emit regular message
      }
      
      // Emit to frontend
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
      
      // Automatically forward to Discovery AI
      this.activeProcess = 'discovery';
      const forwardMessage = `Technical Review feedback:\n\n${textContent}`;
      this.logger.info('🔄 Forwarding Review AI output to Discovery AI', { 
        messageLength: forwardMessage.length 
      });
      
      // Use spawn to send the message to Discovery AI
      await this.discoveryProcess.spawn(forwardMessage, true);
      
      // Update collaboration state
      this.collaborationState = 'refining';
      
      this.emit('collaboration_detected', {
        type: 'feedback_ready',
        from: 'review',
        to: 'discovery'
      });
    }
  }

  async startProcesses() {
    this.logger.info('🚀 startProcesses() called');
    
    // Log workspace paths for debugging
    const discoveryPath = path.join(__dirname, '../workspaces/requirements-discovery');
    const reviewPath = path.join(__dirname, '../workspaces/technical-review');
    this.logger.info('🔍 ORCHESTRATOR WORKSPACE DIAGNOSTICS:');
    this.logger.info(`  Discovery AI workspace: ${discoveryPath}`);
    this.logger.info(`  Review AI workspace: ${reviewPath}`);
    this.logger.info(`  Discovery workspace exists: ${fs.existsSync(discoveryPath)}`);
    this.logger.info(`  Review workspace exists: ${fs.existsSync(reviewPath)}`);
    
    try {
      // Requirements process uses the GEMINI.md instructions via CLAUDE.md in its workspace
      // Just send an initial greeting to establish the session
      const discoveryPrompt = `Hello! I'm ready to help discover requirements for a new project. Please tell me what you'd like to build.`;
      
      this.logger.info('🤖 Spawning discovery process...');
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

    // ALWAYS route user messages to Discovery AI
    // Review AI is a backend service that doesn't interact with users
    const prompt = `The user says: "${message}"`;
    this.logger.info('🔄 Sending message to Discovery AI', { promptLength: prompt.length });
    
    // Ensure we're on discovery process
    this.activeProcess = 'discovery';
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
    // Extract the message after the marker
    const marker = `@${to}:`;
    const markerIndex = fullContent.indexOf(marker);
    const message = fullContent.substring(markerIndex + marker.length).trim();
    
    this.logger.info('🤖↔️🤖 AI-to-AI communication detected', { 
      from, 
      to, 
      messageLength: message.length,
      marker,
      fullContentLength: fullContent.length
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
      
      // Check if Review AI needs to be started (lazy initialization)
      if (!this.reviewProcess.isRunning) {
        this.logger.info('🚀 Starting Review AI on demand for first review request');
        await this.reviewProcess.spawn(message, false); // false = not continue, this is the first message
      } else {
        this.logger.info('🔄 Routing AI message to Review AI', { messageLength: message.length });
        await this.reviewProcess.spawn(message, true); // true = continue existing session
      }
    } else if (to === 'discovery') {
      this.activeProcess = 'discovery';
      this.logger.info('🔄 Routing AI message to Discovery AI', { messageLength: message.length });
      await this.discoveryProcess.spawn(message, true);
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
}

export default DualProcessOrchestrator;