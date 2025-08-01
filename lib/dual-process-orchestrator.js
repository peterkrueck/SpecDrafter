import { EventEmitter } from 'events';
import ClaudeSDKManager from './claude-sdk-manager.js';
import { createLogger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DualProcessOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.logger = createLogger('ORCHESTRATOR');
    
    // Initialize both Claude processes
    const requirementsPath = path.join(__dirname, '../workspaces/requirements-discovery');
    const reviewPath = path.join(__dirname, '../workspaces/technical-review');
    
    this.requirementsProcess = new ClaudeSDKManager('requirements', requirementsPath);
    this.reviewProcess = new ClaudeSDKManager('review', reviewPath);
    
    // Current state
    this.activeProcess = 'requirements';
    this.collaborationState = 'discovering'; // discovering → drafting → reviewing → refining
    this.currentSpecDraft = null;
    
    // Setup event handlers
    this.setupProcessHandlers();
  }

  setupProcessHandlers() {
    // Requirements process handlers
    this.requirementsProcess.on('data', (data) => {
      this.handleRequirementsOutput(data);
    });

    this.requirementsProcess.on('error', (error) => {
      this.logger.error('Requirements process error', { error: error.message });
      this.emit('error', { process: 'requirements', error });
    });

    this.requirementsProcess.on('exit', (exitInfo) => {
      this.logger.warn('Requirements process exited', exitInfo);
      this.emit('process_exit', { process: 'requirements', ...exitInfo });
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

  handleRequirementsOutput(data) {
    this.logger.debug('Requirements output', { 
      type: data.type, 
      contentType: typeof data.content,
      preview: JSON.stringify(data.content).substring(0, 100) 
    });

    // Handle messages from Claude SDK
    if (data.type === 'assistant_response') {
      const textContent = data.content;
      
      // Emit to frontend
      this.emit('requirements_message', {
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
          from: 'requirements',
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
      
      // Emit to frontend
      this.emit('review_message', {
        content: textContent,
        type: 'assistant',
        metadata: data.metadata,
        timestamp: new Date().toISOString()
      });

      // Check if this is feedback that should go back to requirements
      if (this.isFeedback(textContent)) {
        this.collaborationState = 'refining';
        
        this.emit('collaboration_detected', {
          type: 'feedback_ready',
          from: 'review',
          to: 'requirements'
        });
      }
    }
  }

  async startProcesses() {
    this.logger.info('startProcesses() called');
    
    try {
      // Requirements process uses the GEMINI.md instructions via CLAUDE.md in its workspace
      // Just send an initial greeting to establish the session
      const requirementsPrompt = `Hello! I'm ready to help discover requirements for a new project. Please tell me what you'd like to build.`;
      
      this.logger.info('Spawning requirements process...');
      await this.requirementsProcess.spawn(requirementsPrompt, false);
      this.logger.info('Requirements process spawned');

      // Review process uses the CLAUDE2.md instructions via CLAUDE.md in its workspace
      // Initialize it but it will wait for specifications to review
      const reviewPrompt = `I'm ready to provide technical review and analysis when needed.`;
      
      this.logger.info('Spawning review process...');
      await this.reviewProcess.spawn(reviewPrompt, false);
      this.logger.info('Review process spawned');
      
      this.logger.info('Both processes spawned, emitting processes_started event');
      this.emit('processes_started');
    } catch (error) {
      this.logger.error('Failed to start processes', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async routeUserMessage(message) {
    this.logger.info('Routing user message', { 
      activeProcess: this.activeProcess,
      collaborationState: this.collaborationState 
    });

    if (this.activeProcess === 'requirements') {
      // Send to requirements process with --continue to maintain context
      const prompt = `The user says: "${message}"`;
      await this.requirementsProcess.spawn(prompt, true);
    } else {
      // User is directly talking to review process (rare but possible)
      const prompt = `The user says: "${message}"`;
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

  async sendFeedbackToRequirements(feedback) {
    this.logger.info('Sending feedback to requirements process');
    this.activeProcess = 'requirements';
    this.collaborationState = 'refining';

    const feedbackPrompt = `The technical reviewer provided this feedback on your specification:

${feedback}

Please revise the specification based on this feedback.`;

    await this.requirementsProcess.spawn(feedbackPrompt, true);
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

  async resetProcesses() {
    this.logger.info('Resetting both processes');
    
    await this.requirementsProcess.kill();
    await this.reviewProcess.kill();
    
    this.activeProcess = 'requirements';
    this.collaborationState = 'discovering';
    this.currentSpecDraft = null;
    
    // Restart after a delay
    setTimeout(() => {
      this.startProcesses();
    }, 2000);
  }

  getStatus() {
    return {
      activeProcess: this.activeProcess,
      collaborationState: this.collaborationState,
      hasSpecDraft: !!this.currentSpecDraft,
      processes: {
        requirements: this.requirementsProcess.getStatus(),
        review: this.reviewProcess.getStatus()
      }
    };
  }

  async shutdown() {
    this.logger.info('Shutting down orchestrator');
    await this.requirementsProcess.kill();
    await this.reviewProcess.kill();
  }
}

export default DualProcessOrchestrator;