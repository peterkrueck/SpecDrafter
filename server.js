import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import GeminiProcessManager from './lib/gemini-process.js';
import MessageParser from './lib/message-parser.js';
import CollaborationDetector from './lib/collaboration-detector.js';
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
const geminiProcess = new GeminiProcessManager();
const messageParser = new MessageParser();
const collaborationDetector = new CollaborationDetector();
const fileWatcher = new FileWatcher();

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id, totalClients: io.engine.clientsCount + 1 });

  // Start Gemini process when client connects
  if (!geminiProcess.isRunning) {
    logger.info('Starting Gemini process for new client');
    geminiProcess.start();
  } else {
    logger.debug('Gemini process already running, reusing for client');
  }

  // Handle user messages
  socket.on('user_message', (data) => {
    logger.info('User message received', logger.truncateOutput(data.message, 100));
    
    // Send typing indicator
    socket.emit('typing_indicator', { isTyping: true, speaker: 'Gemini' });
    
    // Send message to Gemini process
    geminiProcess.write(data.message + '\n');
  });

  // Handle session reset
  socket.on('reset_session', () => {
    logger.info('Session reset requested');
    
    // Reset all processors
    messageParser.reset();
    collaborationDetector.reset();
    
    // Restart Gemini process
    geminiProcess.restart();
    
    socket.emit('session_reset');
    logger.debug('Session reset complete');
  });

  socket.on('disconnect', () => {
    const remainingClients = io.engine.clientsCount - 1;
    logger.info('Client disconnected', { socketId: socket.id, remainingClients });
    
    // If no more clients, kill Gemini process
    if (remainingClients === 0) {
      logger.info('No more clients, killing Gemini process');
      geminiProcess.kill();
    }
  });
});

// Gemini process event handlers
geminiProcess.on('data', (data) => {
  logger.debug('Raw Gemini output', logger.truncateOutput(data, 200));
  
  // Parse regular chat messages
  const messageResult = messageParser.parseGeminiOutput(data);
  if (messageResult.hasMessage) {
    logger.info('Parsed Gemini message', logger.truncateOutput(messageResult.message, 100));
    io.emit('gemini_message', {
      message: messageResult.message,
      timestamp: messageResult.timestamp
    });
    
    // Hide typing indicator
    io.emit('typing_indicator', { isTyping: false, speaker: 'Gemini' });
  }
  
  // Detect AI collaboration
  const collabResult = collaborationDetector.detectCollaboration(data);
  if (collabResult.detected) {
    logger.info('AI collaboration detected', { command: collabResult.command });
    io.emit('collaboration_detected', {
      command: collabResult.command,
      timestamp: collabResult.timestamp
    });
  }
  
  // Extract Claude responses
  const responseResult = collaborationDetector.extractClaudeResponse(data);
  if (responseResult.hasResponse) {
    logger.info('Claude response extracted', logger.truncateOutput(responseResult.response, 100));
    io.emit('claude_response', {
      response: responseResult.response,
      timestamp: responseResult.timestamp
    });
  }
});

geminiProcess.on('error', (error) => {
  logger.error('Gemini process error', { message: error.message, stack: error.stack });
  io.emit('error', { message: 'Gemini process error: ' + error.message });
});

geminiProcess.on('exit', (exitCode) => {
  logger.warn('Gemini process exited', { exitCode, hasClients: io.engine.clientsCount > 0 });
  io.emit('process_exit', { exitCode });
  
  // Attempt restart if exit was unexpected
  if (exitCode !== 0 && io.engine.clientsCount > 0) {
    logger.info('Attempting to restart Gemini process after unexpected exit');
    setTimeout(() => {
      geminiProcess.start();
    }, 2000);
  }
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
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  
  geminiProcess.kill();
  fileWatcher.stop();
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down');
  
  geminiProcess.kill();
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
  
  try {
    geminiProcess.validateEnvironment();
    logger.info('Environment validation passed');
  } catch (error) {
    logger.error('Environment validation failed', { 
      message: error.message,
      hint: 'Make sure you are running the server from the SpecDrafter directory'
    });
  }
});