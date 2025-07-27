# SpecDrafter Technical Implementation Plan

## Project Overview
SpecDrafter is a browser-based chat interface that wraps Gemini CLI and Claude Code collaboration. It provides a modern chat UI for user-Gemini interaction while detecting AI-to-AI collaboration in the background and automatically displaying generated specifications.

## Architecture Summary

### Chat Interface Design
- **Hidden Gemini CLI process** spawned via node-pty in background
- **Modern chat interface** with message bubbles and typing indicators
- **Real-time Socket.IO communication** between chat UI and Gemini process
- **Message parsing** to convert terminal I/O into clean chat messages
- **No separate Claude terminal** - Claude executes within Gemini's background process

### Core Components
```
Frontend: React + Tailwind CSS + Vite (modern chat interface)
Backend: Node.js + Express + Socket.IO + node-pty
Message Parsing: strip-ansi for terminal output cleaning
Markdown Rendering: marked for professional spec display
File Watching: chokidar for specs/ directory monitoring
Process Management: node-pty for hidden terminal spawning
Build System: Vite for fast development and hot reload
```

## Technical Stack

### Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "socket.io": "^4.7.0",
    "node-pty": "^1.0.0",
    "chokidar": "^3.5.0",
    "strip-ansi": "^7.1.0",
    "marked": "^9.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "concurrently": "^8.2.0",
    "nodemon": "^3.0.0"
  }
}
```

### Frontend Stack
- **React 18**: Modern component-based UI with hooks for state management
- **Tailwind CSS**: Utility-first CSS for rapid, professional styling
- **Vite**: Lightning-fast development server with hot module replacement
- **Socket.IO Client**: Reliable real-time messaging with auto-reconnection

### Key Libraries Benefits
- **`strip-ansi`**: Robust terminal output cleaning (handles all ANSI escape codes)
- **`marked`**: Professional markdown parsing (supports full markdown spec)
- **`socket.io`**: Reliable WebSocket with auto-reconnection and fallbacks
- **`react`**: Component-based architecture for complex UI state management
- **`tailwindcss`**: Rapid styling with FreigeistAI-inspired gradients and glassmorphism
- **`vite`**: Instant hot reload and optimized production builds

## Project Structure

```
SpecDrafter/
├── package.json                    # Dependencies and scripts
├── vite.config.js                  # Vite configuration
├── tailwind.config.js              # Tailwind CSS configuration
├── postcss.config.js               # PostCSS configuration
├── server.js                       # Main server + Socket.IO handler
├── src/                            # Frontend React application
│   ├── main.jsx                   # React app entry point
│   ├── App.jsx                    # Main React component
│   ├── components/
│   │   ├── ChatPanel.jsx          # Left panel chat interface
│   │   ├── CollaborationPanel.jsx # Right panel with view toggle
│   │   ├── Message.jsx            # Individual chat message component
│   │   ├── TypingIndicator.jsx    # Typing animation component
│   │   ├── CollaborationView.jsx  # AI-to-AI collaboration display
│   │   └── SpecView.jsx           # Markdown specification display
│   ├── hooks/
│   │   └── useSocket.js           # Socket.IO React hook
│   └── styles/
│       └── globals.css            # Global styles and Tailwind imports
├── public/
│   └── index.html                 # Vite HTML template
├── lib/
│   ├── gemini-process.js          # Hidden Gemini CLI process management
│   ├── message-parser.js          # Convert terminal I/O to chat messages
│   ├── collaboration-detector.js  # Parse terminal output for AI collab
│   ├── file-watcher.js           # Monitor specs/ directory
│   └── path-validator.js         # Working directory validation
├── specs/                         # Generated specification outputs
│   └── [ProjectName]/
│       └── spec.md
├── CLAUDE.md                      # Claude instructions (existing)
├── GEMINI.md                      # Gemini instructions (existing)
└── IMPLEMENTATION_PLAN.md         # This document
```

## Core Functionality Specifications

### 1. Hidden Gemini Process Management

#### Working Directory Setup
- **Auto-detect SpecDrafter installation path** using `process.cwd()`
- **Validate CLAUDE.md and GEMINI.md existence** on startup
- **Set process working directory** to SpecDrafter root
- **Create specs/ directory** if it doesn't exist

#### Process Spawning
```javascript
// Spawn hidden Gemini CLI process
const geminiProcess = pty.spawn('gemini', [], {
  name: 'xterm-color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(), // SpecDrafter directory
  env: process.env
});
```

#### Process Lifecycle
- **Start Gemini** when Socket.IO client connects
- **Parse terminal output** into chat messages using strip-ansi
- **Send user input** to Gemini process
- **Kill process** on client disconnect
- **Handle process crashes** with error messages

### 2. React Component Architecture

#### Main App Component
```jsx
import React, { useState, useEffect } from 'react';
import ChatPanel from './components/ChatPanel';
import CollaborationPanel from './components/CollaborationPanel';
import { useSocket } from './hooks/useSocket';

function App() {
  const [messages, setMessages] = useState([]);
  const [currentView, setCurrentView] = useState('ai-collab');
  const [isTyping, setIsTyping] = useState(false);
  const [collaboration, setCollaboration] = useState([]);
  const [specContent, setSpecContent] = useState(null);
  
  const socket = useSocket();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-screen p-6">
        <ChatPanel 
          messages={messages}
          setMessages={setMessages}
          isTyping={isTyping}
          socket={socket}
        />
        <CollaborationPanel
          currentView={currentView}
          setCurrentView={setCurrentView}
          collaboration={collaboration}
          specContent={specContent}
        />
      </div>
    </div>
  );
}

export default App;
```

#### Chat Message Component
```jsx
import React from 'react';

function Message({ message, isUser, timestamp }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0">
          🔵
        </div>
      )}
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm ${
        isUser 
          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' 
          : 'bg-white/10 border border-white/20 text-gray-100'
      }`}>
        <p className="text-sm leading-relaxed">{message}</p>
        <span className="text-xs opacity-70 mt-1 block">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>
      {isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ml-3 flex-shrink-0">
          👤
        </div>
      )}
    </div>
  );
}

export default Message;
```

#### Key React Components

**ChatPanel.jsx**
```jsx
function ChatPanel({ messages, setMessages, isTyping, socket }) {
  const [inputValue, setInputValue] = useState('');
  
  const sendMessage = () => {
    if (inputValue.trim()) {
      const newMessage = {
        id: Date.now(),
        message: inputValue,
        isUser: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
      socket?.emit('user_message', { message: inputValue });
      setInputValue('');
    }
  };
  
  // Component JSX with Tailwind classes
}
```

**CollaborationPanel.jsx**
```jsx
function CollaborationPanel({ currentView, setCurrentView, collaboration, specContent }) {
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl flex flex-col h-full">
      {/* View toggle buttons */}
      <div className="flex p-4 border-b border-white/10 gap-2">
        <button 
          onClick={() => setCurrentView('ai-collab')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 ${
            currentView === 'ai-collab' 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          AI Collab
        </button>
        <button 
          onClick={() => setCurrentView('spec')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 ${
            currentView === 'spec' 
              ? 'bg-purple-500 text-white shadow-lg' 
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Spec View
        </button>
      </div>
      
      {/* Conditional view rendering */}
      {currentView === 'ai-collab' ? (
        <CollaborationView collaboration={collaboration} />
      ) : (
        <SpecView content={specContent} />
      )}
    </div>
  );
}
```

#### Tailwind Styling Approach
- **FreigeistAI-inspired design**: Gradients (`bg-gradient-to-br`), glassmorphism (`backdrop-blur-sm`, `bg-white/10`)
- **Responsive layout**: `grid-cols-1 lg:grid-cols-2` for mobile stacking
- **Modern chat bubbles**: Rounded corners, shadows, gradient backgrounds
- **Professional color palette**: Slate, blue, indigo, purple gradients
- **Smooth animations**: Built-in Tailwind transitions and hover effects
- **Component-based styling**: Each React component encapsulates its own Tailwind classes

### 3. Real-time Communication

#### Socket.IO Message Types
```javascript
// Client -> Server
{
  type: 'user_message',
  data: {
    message: 'I want to build a cooking app',
    timestamp: '2025-01-01T00:00:00Z'
  }
}

{
  type: 'reset_session',
  data: null
}

// Server -> Client
{
  type: 'gemini_message',
  data: {
    message: 'Great! Tell me more about your cooking app idea.',
    timestamp: '2025-01-01T00:00:00Z'
  }
}

{
  type: 'typing_indicator',
  data: {
    isTyping: true,
    speaker: 'Gemini'
  }
}

{
  type: 'collaboration_detected',
  data: {
    command: 'claude -p "analyze this cooking app..."',
    timestamp: '2025-01-01T00:00:00Z'
  }
}

{
  type: 'spec_file_generated',
  data: {
    filePath: 'specs/CookingApp/spec.md',
    content: 'markdown content'
  }
}
```

### 4. AI Collaboration Detection

#### Command Pattern Recognition
Monitor terminal output for these patterns:
```javascript
const collabPatterns = [
  /claude\s+-p\s+"([^"]+)"/g,
  /claude\s+--continue\s+-p\s+"([^"]+)"/g,
  /claude\s+-p\s+'([^']+)'/g,
  /claude\s+--continue\s+-p\s+'([^']+)'/g
];
```

#### Detection Logic
```javascript
function detectCollaboration(terminalOutput) {
  for (const pattern of collabPatterns) {
    const matches = terminalOutput.match(pattern);
    if (matches) {
      return {
        detected: true,
        commands: matches,
        timestamp: new Date().toISOString()
      };
    }
  }
  return { detected: false };
}
```

#### Collaboration Display
- **Parse claude commands** from terminal output
- **Extract Claude responses** from terminal stream
- **Format as AI-to-AI conversation** in collaboration view
- **Show command/response pairs** with clear speaker identification
- **Auto-scroll** to latest collaboration activity

### 5. File System Monitoring

#### Specs Directory Watching
```javascript
const chokidar = require('chokidar');

const watcher = chokidar.watch('specs/**/*.md', {
  ignored: /^\./, 
  persistent: true,
  cwd: process.cwd()
});

watcher.on('add', (filePath) => {
  // New spec file detected
  // Read content and send to client
  // Trigger auto-switch to spec view
});
```

#### Auto-switch Logic
- **Monitor specs/ directory** for new .md files
- **Read file content** when detected
- **Parse markdown** to HTML for display
- **Send spec_file_generated message** to trigger view switch
- **Highlight new file** with visual indicator

### 6. Specification Display

#### Markdown Processing
```javascript
const marked = require('marked');

function markdownToHTML(markdown) {
  // Configure marked for secure, clean HTML output
  marked.setOptions({
    breaks: true,        // Convert \n to <br>
    gfm: true,          // GitHub Flavored Markdown
    sanitize: false,    // Allow HTML (specs may contain tables, etc.)
    smartLists: true,   // Better list handling
    smartypants: false  // Don't convert quotes to smart quotes
  });
  
  return marked.parse(markdown);
}
```

#### Spec View Features
- **Formatted markdown display** with syntax highlighting
- **Download button** for spec.md file
- **File path indicator** showing specs/ProjectName/spec.md
- **Auto-refresh** when file content changes

### 7. Message Parsing & Chat Integration

#### Terminal Output to Chat Messages
```javascript
const stripAnsi = require('strip-ansi');

function parseGeminiOutput(terminalData) {
  // Remove all ANSI escape codes (colors, cursor movements, etc.)
  const cleanData = stripAnsi(terminalData);
  
  // Extract Gemini responses (filter out commands and prompts)
  const geminiResponse = cleanData
    .split('\n')
    .filter(line => !line.startsWith('$') && !line.startsWith('>'))
    .join('\n')
    .trim();
  
  return geminiResponse;
}
```

#### Typing Indicators
```javascript
function showTypingIndicator() {
  sendToClient({
    type: 'typing_indicator',
    data: { isTyping: true, speaker: 'Gemini' }
  });
}

function hideTypingIndicator() {
  sendToClient({
    type: 'typing_indicator',
    data: { isTyping: false, speaker: 'Gemini' }
  });
}
```

### 8. React State Management & Session Control

#### Socket.IO React Hook
```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    
    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to SpecDrafter server');
    });
    
    newSocket.on('disconnect', () => {
      setConnected(false);
    });
    
    setSocket(newSocket);
    
    return () => newSocket.close();
  }, []);
  
  return { socket, connected };
}
```

#### React Session Reset
```jsx
function ChatPanel({ messages, setMessages, socket }) {
  const resetSession = () => {
    // Clear React state
    setMessages([]);
    setCollaboration([]);
    setSpecContent(null);
    setCurrentView('ai-collab');
    
    // Notify server to reset Gemini process
    socket?.emit('reset_session');
  };
  
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          💬 Chat with Gemini
        </h3>
        <button 
          onClick={resetSession}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-200 hover:scale-105"
        >
          Reset Session
        </button>
      </div>
      {/* Rest of chat component */}
    </div>
  );
}
```

#### Cleanup on Exit
- **Process.on('exit')** handler to kill Gemini processes
- **Socket.IO disconnect** handler for cleanup
- **Browser beforeunload** event handling
- **Graceful shutdown** of file watchers

### 9. Error Handling

#### Gemini Process Errors
- **Process crash detection** via exit code monitoring
- **Automatic restart** with user notification
- **Error message display** in chat interface
- **Fallback to basic error state** if multiple restarts fail

#### File System Errors
- **Permission error handling** for specs/ directory creation
- **File read error handling** with user feedback
- **Path validation** with clear error messages
- **Graceful degradation** if file watching fails

### 10. Development and Build

#### Package.json Scripts
```json
{
  "scripts": {
    "dev": "concurrently \"nodemon server.js\" \"vite\"",
    "start": "npm run dev",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node server.js",
    "frontend": "vite"
  }
}
```

#### Configuration Files

**vite.config.js**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,  // Frontend on 3001, backend on 3000
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
});
```

**tailwind.config.js**
```javascript
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'typing': 'typing 1.4s infinite ease-in-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-10px)' }
        }
      }
    },
  },
  plugins: [],
};
```

#### Prerequisites Validation
- **Check for Gemini CLI** installation on startup
- **Check for Claude Code** installation on startup
- **Provide installation links** if tools missing:
  - Gemini CLI: https://github.com/google-gemini/gemini-cli
  - Claude Code: https://github.com/anthropics/claude-code

#### Environment Setup
- **Node.js >= 16** required
- **npm install** for dependencies (includes React ecosystem)
- **Working directory** must be SpecDrafter root
- **Process spawning** required for hidden Gemini CLI
- **Vite development server** runs on port 3001
- **Express backend server** runs on port 3000
- **Concurrent development** - both servers start with `npm start`

#### Development Workflow

**Quick Start:**
```bash
git clone <repository>
cd SpecDrafter
npm install
npm start  # Starts both backend and frontend with hot reload
```

**Development Features:**
- **Hot Module Replacement**: React components update instantly without page refresh
- **Automatic browser opening**: Vite opens browser to http://localhost:3001
- **Backend proxy**: Frontend automatically proxies Socket.IO to backend on port 3000
- **Tailwind IntelliSense**: VS Code extension provides autocomplete for CSS classes
- **React DevTools**: Browser extension for debugging React components

**Production Build:**
```bash
npm run build    # Creates optimized production build
npm run preview  # Preview production build locally
```

## Implementation Notes

### Critical Requirements
1. **Hidden process architecture** - Gemini CLI runs in background, not visible to user
2. **React component architecture** - modern component-based UI with hooks for state management
3. **Tailwind styling system** - rapid development with professional FreigeistAI-inspired design
4. **Robust message parsing** - use strip-ansi for reliable terminal output cleaning
5. **Professional markdown rendering** - use marked for spec display with full markdown support
6. **Reliable real-time communication** - Socket.IO with auto-reconnection for long sessions
7. **Hot reload development** - Vite for instant feedback during development
8. **Working directory management** - ensure process spawns in SpecDrafter directory
9. **File watching** - monitor specs/ for automatic spec view switching
10. **Process cleanup** - proper background process management and cleanup

### Technical Constraints
- **OS compatibility** - must work on macOS, Linux, Windows
- **Node.js environment** - React build tools require Node.js 16+
- **Port availability** - needs ports 3000 (backend) and 3001 (frontend) available
- **Message parsing** - robust terminal output to chat conversion
- **File permissions** - handle various file system permission scenarios
- **Process management** - robust handling of background process lifecycle
- **Browser compatibility** - modern browsers required for React 18 features
- **Build system** - Vite requires ES modules support

### User Experience Requirements
- **Immediate chat access** - Gemini starts automatically and ready to chat
- **Modern React interface** - component-based architecture with smooth state updates
- **Professional Tailwind styling** - FreigeistAI-inspired gradients, glassmorphism, animations
- **Hot reload development** - Vite provides instant feedback during development
- **Seamless collaboration** - transparent AI-to-AI interaction detection in background
- **Automatic transitions** - smooth switching to spec view when ready
- **Visual feedback** - React-powered typing indicators, collaboration status, file generation alerts
- **Connection reliability** - Socket.IO auto-reconnection prevents lost sessions
- **Clean message parsing** - strip-ansi ensures no garbled terminal codes in chat
- **Professional spec display** - marked handles complex markdown (tables, code blocks, etc.)
- **Responsive design** - Tailwind breakpoints ensure mobile-friendly experience
- **Error recovery** - graceful handling of process failures with React error boundaries