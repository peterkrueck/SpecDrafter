import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import DualProcessOrchestrator from './lib/dual-process-orchestrator.js';
import FileWatcher from './lib/file-watcher.js';
import { createLogger } from './lib/logger.js';
import { getAllModels, getModelById } from './lib/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('SERVER');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3002;

// Initialize managers
// Orchestrator will be initialized with model when client connects
let orchestrator = null;
const fileWatcher = new FileWatcher();

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id, totalClients: io.engine.clientsCount + 1 });

  // Initialize orchestrator if not already initialized
  if (!orchestrator) {
    orchestrator = new DualProcessOrchestrator();
    setupOrchestratorHandlers();
  }

  // Send current orchestrator status and available models
  if (orchestrator) {
    const status = orchestrator.getStatus();
    logger.info('Sending orchestrator status to client', status);
    socket.emit('orchestrator_status', status);
  }
  
  // Send available models
  socket.emit('available_models', getAllModels());
  
  // Send project path info
  const projectRoot = path.resolve(__dirname, '..');
  socket.emit('project_info', { 
    projectRoot,
    specsDir: path.join(projectRoot, 'specs')
  });

  // Handle user messages
  socket.on('user_message', async (data) => {
    logger.info('User message received', logger.truncateOutput(data.message, 100));
    
    // Route message through orchestrator
    await orchestrator.routeUserMessage(data.message);
  });

  // Handle process switching
  socket.on('switch_process', (data) => {
    logger.info('Process switch requested', { targetProcess: data.process });
    orchestrator.switchActiveProcess(data.process);
  });

  // Handle collaboration trigger
  socket.on('trigger_review', async () => {
    logger.info('Review trigger requested');
    await orchestrator.triggerReview();
  });

  // Handle manual process start request with optional model and initial message
  socket.on('start_processes', async (data = {}) => {
    logger.info('Manual process start requested', { 
      model: data.modelId,
      hasInitialMessage: !!data.initialMessage 
    });
    
    try {
      // If model specified, update orchestrator
      if (data.modelId && orchestrator) {
        const modelConfig = getModelById(data.modelId);
        if (modelConfig) {
          // Recreate orchestrator with new model
          await orchestrator.shutdown();
          orchestrator = new DualProcessOrchestrator(modelConfig);
          setupOrchestratorHandlers();
        }
      }
      
      // Start processes with optional initial message
      await orchestrator.startProcesses(data.initialMessage);
      
      // If initial message provided, route it as the first user message
      if (data.initialMessage) {
        await orchestrator.routeUserMessage(data.initialMessage);
      }
    } catch (error) {
      logger.error('Failed to start processes manually', { error: error.message });
      socket.emit('error', { message: `Failed to start processes: ${error.message}` });
    }
  });
  
  // Handle model change request
  socket.on('change_model', async (data) => {
    logger.info('Model change requested', { modelId: data.modelId });
    
    if (!orchestrator) {
      socket.emit('error', { message: 'Orchestrator not initialized' });
      return;
    }
    
    try {
      await orchestrator.changeModel(data.modelId);
      
      // Send updated status to all clients
      const status = orchestrator.getStatus();
      io.emit('orchestrator_status', status);
      io.emit('model_changed', { 
        model: status.currentModel,
        success: true 
      });
    } catch (error) {
      logger.error('Failed to change model', { error: error.message });
      socket.emit('error', { message: `Failed to change model: ${error.message}` });
    }
  });
  
  // Handle get available models request
  socket.on('get_available_models', () => {
    socket.emit('available_models', getAllModels());
  });

  // List available specifications
  socket.on('list_specs', async () => {
    logger.info('📋 Listing available specifications');
    try {
      const specsDir = path.join(projectRoot, 'specs');
      const specs = [];
      
      // Check if specs directory exists
      if (fs.existsSync(specsDir)) {
        const projects = await fs.promises.readdir(specsDir);
        
        for (const project of projects) {
          const specPath = path.join(specsDir, project, 'spec.md');
          try {
            const stats = await fs.promises.stat(specPath);
            specs.push({
              projectName: project,
              path: specPath,
              lastModified: stats.mtime.toISOString(),
              size: stats.size
            });
          } catch (err) {
            // Skip if spec.md doesn't exist
            logger.debug(`No spec.md found for project: ${project}`);
          }
        }
      }
      
      logger.info(`📋 Found ${specs.length} specifications`);
      socket.emit('specs_list', { specs });
    } catch (error) {
      logger.error('❌ Error listing specs', { error: error.message });
      socket.emit('error', { message: 'Failed to list specifications' });
    }
  });

  // Start with an existing specification
  socket.on('start_with_existing_spec', async (data) => {
    const { projectName, modelId, skillLevel } = data;
    logger.info('🔄 Starting with existing specification', { projectName, modelId, skillLevel });
    
    try {
      // Ensure specs directory path is absolute
      const specPath = path.resolve(path.join(projectRoot, 'specs', projectName, 'spec.md'));
      
      // Verify the spec file exists
      if (!fs.existsSync(specPath)) {
        socket.emit('error', { message: `Specification not found for project: ${projectName}` });
        return;
      }
      
      // Create or update orchestrator with model
      if (data.modelId) {
        const modelConfig = getModelById(data.modelId);
        if (modelConfig) {
          if (orchestrator) {
            await orchestrator.shutdown();
          }
          orchestrator = new DualProcessOrchestrator(modelConfig);
          setupOrchestratorHandlers();
        }
      } else if (!orchestrator) {
        // Create orchestrator with default model if none exists
        orchestrator = new DualProcessOrchestrator();
        setupOrchestratorHandlers();
      }
      
      // Map skill level to user-friendly text
      const skillLevelText = {
        'non-tech': 'Non-Tech',
        'tech-savvy': 'Tech-Savvy',
        'software-professional': 'Software Professional'
      }[skillLevel] || skillLevel;
      
      // Create context message with absolute path for Discovery AI
      const contextMessage = `I'm continuing work on project "${projectName}".
User's Technical Background: ${skillLevelText}
The current specification is located at: ${specPath}
Please read this specification file to understand the project. Keep in mind the user's technical background when communicating. Let me know how you'd like to proceed.`;
      
      logger.info('📝 Sending context message to Discovery AI', { 
        projectName, 
        specPath,
        skillLevel: skillLevelText,
        messageLength: contextMessage.length 
      });
      
      // Start processes with the context message
      await orchestrator.startProcesses(contextMessage);
      
      // Send project info to frontend
      socket.emit('project_info', { 
        projectPath: projectRoot,
        specsPath: path.join(projectRoot, 'specs')
      });
      
    } catch (error) {
      logger.error('❌ Error starting with existing spec', { error: error.message });
      socket.emit('error', { message: 'Failed to start with existing specification' });
    }
  });

  // Handle session reset
  socket.on('reset_session', async () => {
    logger.info('Session reset requested');
    
    // Reset orchestrator
    if (orchestrator) {
      await orchestrator.resetProcesses();
    }
    
    socket.emit('session_reset');
    logger.debug('Session reset complete');
  });

  // Handle stop AI response
  socket.on('stop_ai_response', async () => {
    logger.info('Stop AI response requested');
    
    if (orchestrator) {
      try {
        await orchestrator.stopAllProcesses();
        socket.emit('ai_stopped', { success: true });
        logger.info('AI processes stopped successfully');
      } catch (error) {
        logger.error('Failed to stop AI processes', { error: error.message });
        socket.emit('ai_stopped', { success: false, error: error.message });
      }
    } else {
      socket.emit('ai_stopped', { success: false, error: 'Orchestrator not initialized' });
    }
  });

  socket.on('disconnect', () => {
    const remainingClients = io.engine.clientsCount - 1;
    logger.info('Client disconnected', { socketId: socket.id, remainingClients });
    
    // If no more clients, shutdown orchestrator
    if (remainingClients === 0) {
      logger.info('No more clients, shutting down orchestrator');
      if (orchestrator) {
        orchestrator.shutdown();
      }
    }
  });
});

// Function to setup orchestrator event handlers
function setupOrchestratorHandlers() {
  if (!orchestrator) return;
  
  orchestrator.on('discovery_message', (data) => {
    logger.info('Discovery message', logger.truncateOutput(data.content, 100));
    io.emit('discovery_message', data);
    
    // Hide typing indicator
    io.emit('typing_indicator', { isTyping: false, speaker: 'Discovery AI' });
  });

  orchestrator.on('review_message', (data) => {
    logger.info('Review message', logger.truncateOutput(data.content, 100));
    io.emit('review_message', data);
    
    // Hide typing indicator
    io.emit('typing_indicator', { isTyping: false, speaker: 'Review AI' });
  });

  orchestrator.on('collaboration_detected', (data) => {
    logger.info('Collaboration detected', data);
    io.emit('collaboration_detected', data);
  });

  orchestrator.on('active_process_changed', (data) => {
    logger.info('Active process changed', data);
    io.emit('active_process_changed', data);
  });

  orchestrator.on('processes_started', () => {
    logger.info('Orchestrator emitted processes_started event');
    io.emit('processes_ready');
    
    // Send updated status to all clients
    const status = orchestrator.getStatus();
    logger.info('Broadcasting updated orchestrator status', status);
    io.emit('orchestrator_status', status);
  });

  orchestrator.on('error', (error) => {
    logger.error('Orchestrator error', { 
      process: error.process, 
      message: error.error.message 
    });
    io.emit('error', { 
      message: `${error.process} process error: ${error.error.message}` 
    });
  });

  orchestrator.on('process_exit', (exitInfo) => {
    logger.warn('Process exited', exitInfo);
    io.emit('process_exit', exitInfo);
  });

  orchestrator.on('model_changed', (data) => {
    logger.info('Model changed', data);
    io.emit('model_changed', data);
  });
  
  orchestrator.on('ai_collaboration_message', (data) => {
    logger.info('AI-to-AI collaboration message', { from: data.from, to: data.to });
    io.emit('ai_collaboration_message', data);
  });
  
  orchestrator.on('ai_collaboration_typing', (data) => {
    logger.info('AI collaboration typing indicator', { speaker: data.speaker, isTyping: data.isTyping });
    io.emit('ai_collaboration_typing', data);
  });
  
  orchestrator.on('hide_chat_typing', (data) => {
    logger.info('Hiding chat typing indicator', { speaker: data.speaker });
    io.emit('typing_indicator', { isTyping: false, speaker: data.speaker });
  });
  
  orchestrator.on('typing_indicator', (data) => {
    logger.info('Typing indicator from orchestrator', { speaker: data.speaker, isTyping: data.isTyping });
    io.emit('typing_indicator', data);
  });
  
  orchestrator.on('processes_stopped', () => {
    logger.info('Processes stopped event from orchestrator');
    io.emit('processes_stopped');
  });
}

// File watcher event handlers
fileWatcher.on('spec_file_generated', (data) => {
  logger.info('📄 Spec file generated, emitting to clients', { filePath: data.filePath, clientCount: io.engine.clientsCount });
  io.emit('spec_file_generated', data);
});

fileWatcher.on('spec_file_updated', (data) => {
  logger.info('✏️  Spec file updated, emitting to clients', { filePath: data.filePath, clientCount: io.engine.clientsCount });
  io.emit('spec_file_updated', data);
});

fileWatcher.on('error', (error) => {
  logger.error('❌ File watcher error', { message: error.message });
});

// Startup diagnostics
import fs from 'fs';
const specsDir = path.resolve(__dirname, '../specs');
logger.info('🔍 SERVER STARTUP DIAGNOSTICS:');
logger.info(`  Server working directory: ${process.cwd()}`);
logger.info(`  Backend directory: ${__dirname}`);
logger.info(`  Expected specs directory: ${specsDir}`);
logger.info(`  Specs directory exists: ${fs.existsSync(specsDir)}`);

if (fs.existsSync(specsDir)) {
  try {
    const contents = fs.readdirSync(specsDir, { withFileTypes: true });
    logger.info(`  Specs directory contents (${contents.length} items):`);
    contents.forEach(item => {
      logger.info(`    ${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name}`);
      if (item.isDirectory()) {
        const subDir = path.join(specsDir, item.name);
        try {
          const subContents = fs.readdirSync(subDir);
          logger.info(`      └─ Contents: ${subContents.join(', ')}`);
        } catch (err) {
          logger.info(`      └─ Error reading: ${err.message}`);
        }
      }
    });
  } catch (error) {
    logger.error(`  Error reading specs directory: ${error.message}`);
  }
}

// Start file watcher
logger.info('🚀 Starting file watcher...');
fileWatcher.start();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  
  if (orchestrator) {
    await orchestrator.shutdown();
  }
  fileWatcher.stop();
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down');
  
  if (orchestrator) {
    await orchestrator.shutdown();
  }
  fileWatcher.stop();
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info('SpecDrafter server started', { 
    port: PORT, 
    frontend: 'http://localhost:3001',
    logLevel: process.env.LOG_LEVEL || 'INFO'
  });
  
  logger.info('Dual-Claude architecture ready');
  logger.info('Workspaces configured:', {
    requirements: 'workspaces/requirements-discovery/',
    review: 'workspaces/technical-review/'
  });
});