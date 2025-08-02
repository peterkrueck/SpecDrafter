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

  handleReviewOutput(data) {
    this.logger.debug('Review output', { 
      type: data.type, 
      contentType: typeof data.content,
      preview: JSON.stringify(data.content).substring(0, 100) 
    });

    // Handle messages from Claude SDK
    if (data.type === 'assistant_response') {
      const textContent = data.content;
      
      // Check for AI-to-AI communication markers
      if (textContent.includes('@discovery:')) {
        this.handleAIToAICommunication('review', 'discovery', textContent);
        return; // Don't emit regular message
      }
      
      // Emit to frontend
      this.emit('review_message', {
        content: textContent,
        type: 'assistant',
        metadata: data.metadata,
        timestamp: new Date().toISOString()
      });

      // Check if this is feedback that should go back to discovery
      if (this.isFeedback(textContent)) {
        this.collaborationState = 'refining';
        
        this.emit('collaboration_detected', {
          type: 'feedback_ready',
          from: 'review',
          to: 'discovery'
        });
      }
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

      // Review process uses the CLAUDE2.md instructions via CLAUDE.md in its workspace
      // Initialize it but it will wait for specifications to review
      const reviewPrompt = `I'm ready to provide technical review and analysis when needed.`;
      
      this.logger.info('🤖 Spawning review process...');
      await this.reviewProcess.spawn(reviewPrompt, false);
      this.logger.info('✅ Review process spawned successfully');
      
      this.logger.info('🎉 Both processes spawned, emitting processes_started event');
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

    if (this.activeProcess === 'discovery') {
      // Send to discovery process with --continue to maintain context
      const prompt = `The user says: "${message}"`;
      this.logger.info('🔄 Sending message to Discovery AI', { promptLength: prompt.length });
      await this.discoveryProcess.spawn(prompt, true);
    } else {
      // User is directly talking to review process (rare but possible)
      const prompt = `The user says: "${message}"`;
      this.logger.info('🔄 Sending message to Review AI', { promptLength: prompt.length });
      await this.reviewProcess.spawn(prompt, true);
    }
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
    if (processName !== 'requirements' && processName !== 'review') {
      this.logger.error('Invalid process name', { processName });
      return;
    }

    this.activeProcess = processName;
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
      this.logger.info('🔄 Routing AI message to Review AI', { messageLength: message.length });
      await this.reviewProcess.spawn(message, true);
    } else if (to === 'discovery') {
      this.activeProcess = 'discovery';
      this.logger.info('🔄 Routing AI message to Discovery AI', { messageLength: message.length });
      await this.discoveryProcess.spawn(message, true);
    }
  }

  async resetProcesses() {
    this.logger.info('Resetting both processes');
    
    await this.discoveryProcess.kill();
    await this.reviewProcess.kill();
    
    this.activeProcess = 'discovery';
    this.collaborationState = 'discovering';
    this.currentSpecDraft = null;
    
    // Restart after a delay
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