import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import GeminiProcessManager from './lib/gemini-process.js';
import MessageParser from './lib/message-parser.js';
import CollaborationDetector from './lib/collaboration-detector.js';
import FileWatcher from './lib/file-watcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

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
  console.log('Client connected:', socket.id);

  // Start Gemini process when client connects
  if (!geminiProcess.isRunning) {
    geminiProcess.start();
  }

  // Handle user messages
  socket.on('user_message', (data) => {
    console.log('User message:', data.message);
    
    // Send typing indicator
    socket.emit('typing_indicator', { isTyping: true, speaker: 'Gemini' });
    
    // Send message to Gemini process
    geminiProcess.write(data.message + '\n');
  });

  // Handle session reset
  socket.on('reset_session', () => {
    console.log('Resetting session');
    
    // Reset all processors
    messageParser.reset();
    collaborationDetector.reset();
    
    // Restart Gemini process
    geminiProcess.restart();
    
    socket.emit('session_reset');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // If no more clients, kill Gemini process
    if (io.engine.clientsCount === 0) {
      geminiProcess.kill();
    }
  });
});

// Gemini process event handlers
geminiProcess.on('data', (data) => {
  console.log('Gemini output:', data.substring(0, 100) + '...');
  
  // Parse regular chat messages
  const messageResult = messageParser.parseGeminiOutput(data);
  if (messageResult.hasMessage) {
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
    console.log('AI collaboration detected:', collabResult.command);
    io.emit('collaboration_detected', {
      command: collabResult.command,
      timestamp: collabResult.timestamp
    });
  }
  
  // Extract Claude responses
  const responseResult = collaborationDetector.extractClaudeResponse(data);
  if (responseResult.hasResponse) {
    console.log('Claude response extracted');
    io.emit('claude_response', {
      response: responseResult.response,
      timestamp: responseResult.timestamp
    });
  }
});

geminiProcess.on('error', (error) => {
  console.error('Gemini process error:', error);
  io.emit('error', { message: 'Gemini process error: ' + error.message });
});

geminiProcess.on('exit', (exitCode) => {
  console.log('Gemini process exited with code:', exitCode);
  io.emit('process_exit', { exitCode });
  
  // Attempt restart if exit was unexpected
  if (exitCode !== 0 && io.engine.clientsCount > 0) {
    console.log('Attempting to restart Gemini process...');
    setTimeout(() => {
      geminiProcess.start();
    }, 2000);
  }
});

// File watcher event handlers
fileWatcher.on('spec_file_generated', (data) => {
  console.log('Spec file generated:', data.filePath);
  io.emit('spec_file_generated', data);
});

fileWatcher.on('spec_file_updated', (data) => {
  console.log('Spec file updated:', data.filePath);
  io.emit('spec_file_updated', data);
});

fileWatcher.on('error', (error) => {
  console.error('File watcher error:', error);
});

// Start file watcher
fileWatcher.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  
  geminiProcess.kill();
  fileWatcher.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  
  geminiProcess.kill();
  fileWatcher.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`SpecDrafter server running on port ${PORT}`);
  console.log(`Frontend should be running on http://localhost:3001`);
  
  try {
    geminiProcess.validateEnvironment();
    console.log('Environment validation passed');
  } catch (error) {
    console.error('Environment validation failed:', error.message);
    console.error('Make sure you are running the server from the SpecDrafter directory');
  }
});