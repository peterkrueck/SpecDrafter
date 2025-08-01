import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import DualProcessOrchestrator from './lib/dual-process-orchestrator.js';
import FileWatcher from './lib/file-watcher.js';
import { createLogger } from './lib/logger.js';

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
const orchestrator = new DualProcessOrchestrator();
const fileWatcher = new FileWatcher();

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id, totalClients: io.engine.clientsCount + 1 });

  // Start Claude processes when first client connects
  if (io.engine.clientsCount === 1) {
    logger.info('Starting Claude processes for first client');
    orchestrator.startProcesses()
      .then(() => {
        logger.info('Claude processes started successfully');
      })
      .catch((error) => {
        logger.error('Failed to start Claude processes', { error: error.message });
      });
  }

  // Send current orchestrator status
  const status = orchestrator.getStatus();
  logger.info('Sending orchestrator status to client', status);
  socket.emit('orchestrator_status', status);

  // Handle user messages
  socket.on('user_message', async (data) => {
    logger.info('User message received', logger.truncateOutput(data.message, 100));
    
    // Send typing indicator
    const activeProcess = orchestrator.activeProcess;
    socket.emit('typing_indicator', { 
      isTyping: true, 
      speaker: activeProcess === 'requirements' ? 'Requirements AI' : 'Review AI' 
    });
    
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

  // Handle manual process start request
  socket.on('start_processes', async () => {
    logger.info('Manual process start requested');
    try {
      await orchestrator.startProcesses();
    } catch (error) {
      logger.error('Failed to start processes manually', { error: error.message });
    }
  });

  // Handle session reset
  socket.on('reset_session', async () => {
    logger.info('Session reset requested');
    
    // Reset orchestrator
    await orchestrator.resetProcesses();
    
    socket.emit('session_reset');
    logger.debug('Session reset complete');
  });

  socket.on('disconnect', () => {
    const remainingClients = io.engine.clientsCount - 1;
    logger.info('Client disconnected', { socketId: socket.id, remainingClients });
    
    // If no more clients, shutdown orchestrator
    if (remainingClients === 0) {
      logger.info('No more clients, shutting down orchestrator');
      orchestrator.shutdown();
    }
  });
});

// Orchestrator event handlers
orchestrator.on('requirements_message', (data) => {
  logger.info('Requirements message', logger.truncateOutput(data.content, 100));
  io.emit('requirements_message', data);
  
  // Hide typing indicator
  io.emit('typing_indicator', { isTyping: false, speaker: 'Requirements AI' });
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

// File watcher event handlers
fileWatcher.on('spec_file_generated', (data) => {
  logger.info('Spec file generated', { filePath: data.filePath });
  io.emit('spec_file_generated', data);
});

fileWatcher.on('spec_file_updated', (data) => {
  logger.info('Spec file updated', { filePath: data.filePath });
  io.emit('spec_file_updated', data);
});

fileWatcher.on('error', (error) => {
  logger.error('File watcher error', { message: error.message });
});

// Start file watcher
fileWatcher.start();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  
  await orchestrator.shutdown();
  fileWatcher.stop();
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down');
  
  await orchestrator.shutdown();
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