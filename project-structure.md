# SpecDrafter Project Structure

This document provides the complete technology stack and file tree structure for SpecDrafter. **AI agents MUST read this file to understand the project organization before making any changes.**

## Project Overview

SpecDrafter is a browser-based chat interface that wraps Gemini CLI and Claude Code collaboration. It provides a modern chat UI for user-Gemini interaction while detecting AI-to-AI collaboration in the background and automatically displaying generated specifications.

**Architecture Pattern:** Hidden AI Process → Chat Interface → Real-time Collaboration Detection → Specification Generation

## Technology Stack

### Frontend Technologies
- **React 18.2.0+** - Modern component-based UI with hooks for state management
- **Vite 5.0.0+** - Lightning-fast development server with hot module replacement
- **Tailwind CSS 3.4.0+** - Utility-first CSS for rapid, professional styling with FreigeistAI-inspired design
- **Socket.IO Client 4.7.0+** - Reliable real-time messaging with auto-reconnection
- **PostCSS 8.4.0+** with **Autoprefixer 10.4.0+** - CSS processing and vendor prefixing

### Backend Technologies
- **Node.js 16+** with **ES Modules** - Modern JavaScript runtime with native module support
- **Express 4.18.0+** - Web framework for HTTP server and static file serving
- **Socket.IO 4.7.0+** - Real-time WebSocket communication with fallbacks
- **node-pty 1.0.0+** - Cross-platform process spawning for hidden Gemini CLI management

### AI Integration & Process Management
- **Gemini CLI** - Primary AI orchestrator for requirements discovery and specification drafting
- **Claude Code** - Technical analysis specialist and specification reviewer (invoked by Gemini)
- **Hidden Process Architecture** - Background Gemini CLI process managed via node-pty
- **AI Collaboration Detection** - Real-time parsing of terminal output for AI-to-AI interactions

### Message Processing & Communication
- **strip-ansi 7.1.0+** - Robust terminal output cleaning (handles all ANSI escape codes)
- **marked 9.1.0+** - Professional markdown parsing with full GitHub Flavored Markdown support
- **chokidar 3.5.0+** - File system watching for automatic specification detection

### Development & Build Tools
- **concurrently 8.2.0+** - Parallel development server execution
- **nodemon 3.0.0+** - Backend auto-restart on file changes
- **Vite Plugin React 4.2.0+** - React integration with fast refresh

## Complete Project Structure

```
SpecDrafter/
├── package.json                    # Dependencies and npm scripts
├── vite.config.js                  # Vite configuration with Socket.IO proxy
├── tailwind.config.js              # Tailwind CSS configuration with custom animations
├── postcss.config.js               # PostCSS configuration for Tailwind processing
├── index.html                      # Vite HTML template and React entry point
├── server.js                       # Main Express server with Socket.IO integration
├── project-structure.md            # Complete project documentation (this file)
├── CLAUDE.md                       # Claude Code behavioral rules and collaboration context
├── GEMINI.md                       # Gemini AI orchestrator rules and requirements discovery
├── IMPLEMENTATION_PLAN.md          # Technical implementation plan and architecture decisions
│
├── src/                            # React frontend application
│   ├── main.jsx                   # React application entry point with global styles
│   ├── App.jsx                    # Main application component with Socket.IO integration
│   ├── components/                # React UI components
│   │   ├── ChatPanel.jsx          # Left panel chat interface with message handling
│   │   ├── CollaborationPanel.jsx # Right panel with AI Collab/Spec View toggle
│   │   ├── Message.jsx            # Individual chat message component with timestamps
│   │   ├── TypingIndicator.jsx    # Animated typing indicator for real-time feedback
│   │   ├── CollaborationView.jsx  # AI-to-AI collaboration display with command/response pairs
│   │   └── SpecView.jsx           # Markdown specification display with download functionality
│   ├── hooks/                     # Custom React hooks
│   │   └── useSocket.js           # Socket.IO React hook with connection management
│   └── styles/                    # CSS and styling
│       └── globals.css            # Global styles and Tailwind imports
│
├── lib/                           # Backend utility modules
│   ├── gemini-process.js          # Hidden Gemini CLI process management with node-pty
│   ├── message-parser.js          # Terminal I/O to chat message conversion
│   ├── collaboration-detector.js  # AI collaboration detection via regex patterns
│   └── file-watcher.js           # Specs directory monitoring with chokidar
│
├── specs/                         # Generated specification outputs
│   └── [ProjectName]/            # Dynamic project directories
│       └── spec.md               # Generated markdown specifications
│
└── node_modules/                  # Installed dependencies (npm managed)
```

## Architecture Components

### 1. Hidden Process Management (`lib/gemini-process.js`)
- **Process Spawning**: Uses node-pty to spawn hidden Gemini CLI process in background
- **Working Directory Validation**: Ensures CLAUDE.md and GEMINI.md files exist
- **Process Lifecycle**: Handles start, restart, and graceful shutdown
- **Event System**: Provides data, error, and exit event handlers
- **Cross-platform Compatibility**: Works on macOS, Linux, and Windows

**Key Features:**
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

### 2. Message Parsing (`lib/message-parser.js`)
- **ANSI Code Removal**: Uses strip-ansi for clean terminal output
- **Response Filtering**: Filters out system messages, prompts, and empty lines
- **Buffer Management**: Handles incomplete terminal output streams
- **Deduplication**: Prevents duplicate message display

**Processing Pipeline:**
1. Raw terminal output → ANSI stripping
2. Line splitting and filtering → System message removal
3. Response validation → Message formatting
4. Timestamp addition → Client transmission

### 3. AI Collaboration Detection (`lib/collaboration-detector.js`)
- **Pattern Matching**: Detects Claude command patterns in terminal output
- **Response Extraction**: Captures Claude responses from terminal stream
- **Real-time Processing**: Streams collaboration data to frontend
- **Context Awareness**: Maintains collaboration session state

**Detection Patterns:**
```javascript
const collabPatterns = [
  /claude\s+-p\s+"([^"]+)"/g,
  /claude\s+--continue\s+-p\s+"([^"]+)"/g,
  /claude\s+-p\s+'([^']+)'/g,
  /claude\s+--continue\s+-p\s+'([^']+)'/g
];
```

### 4. File System Monitoring (`lib/file-watcher.js`)
- **Specs Directory Watching**: Monitors specs/**/*.md files
- **Markdown Processing**: Converts markdown to HTML using marked
- **Auto-switching**: Triggers spec view when files are generated
- **Change Detection**: Handles both new files and modifications

### 5. React Component Architecture

#### Main Application (`src/App.jsx`)
- **State Management**: Centralized state for messages, collaboration, and specs
- **Socket.IO Integration**: Real-time communication with backend
- **View Coordination**: Manages chat and collaboration panel states
- **Error Handling**: Connection status and error display

#### Chat Panel (`src/components/ChatPanel.jsx`)
- **Message Display**: Renders chat history with user/AI distinction
- **Input Handling**: Text input with Enter key support and send button
- **Typing Indicators**: Real-time typing feedback
- **Session Reset**: Clear chat and restart Gemini process

#### Collaboration Panel (`src/components/CollaborationPanel.jsx`)
- **View Toggle**: Switch between AI Collaboration and Spec View
- **Dynamic Content**: Renders different components based on active view
- **State Coordination**: Manages collaboration and spec content display

### 6. Real-time Communication (Socket.IO)

#### Client → Server Events
- `user_message`: Send user input to Gemini process
- `reset_session`: Clear session and restart Gemini process

#### Server → Client Events
- `gemini_message`: Gemini response for chat display
- `typing_indicator`: Real-time typing status
- `collaboration_detected`: AI collaboration command detection
- `claude_response`: Claude response extraction
- `spec_file_generated`: New specification file with markdown content

### 7. Styling System (Tailwind CSS)

#### Design Philosophy
- **FreigeistAI-inspired**: Gradients, glassmorphism, backdrop blur effects
- **Professional Color Palette**: Slate, blue, indigo, purple gradients
- **Responsive Design**: Mobile-first with `lg:` breakpoints
- **Component-based**: Each React component encapsulates styling

#### Custom Animations
```javascript
// tailwind.config.js custom animations
animation: {
  'fade-in': 'fadeIn 0.5s ease-in-out',
  'slide-up': 'slideUp 0.3s ease-out',
  'typing': 'typing 1.4s infinite ease-in-out'
}
```

## Development Workflow

### Quick Start Commands
```bash
# Initial setup
git clone <repository>
cd SpecDrafter
npm install

# Development (starts both backend and frontend)
npm start
# OR
npm run dev

# Individual services
npm run server    # Backend only (port 3000)
npm run frontend  # Frontend only (port 3001)

# Production build
npm run build     # Create optimized build
npm run preview   # Preview production build
```

### Development Features
- **Hot Module Replacement**: React components update instantly without page refresh
- **Automatic Browser Opening**: Vite opens browser to http://localhost:3001
- **Backend Proxy**: Frontend automatically proxies Socket.IO to backend on port 3000
- **Concurrent Development**: Both servers start simultaneously with `npm start`
- **Process Auto-restart**: Backend restarts on file changes via nodemon

### Port Configuration
- **Frontend (Vite)**: http://localhost:3001
- **Backend (Express + Socket.IO)**: http://localhost:3000
- **Proxy Configuration**: Frontend proxies `/socket.io` to backend

## Environment Requirements

### Prerequisites
- **Node.js 16+**: Required for ES modules and React build tools
- **Gemini CLI**: Must be installed and accessible in PATH
- **Claude Code**: Must be installed and accessible in PATH
- **Working Directory**: Must run from SpecDrafter root directory

### Installation Links
- **Gemini CLI**: https://github.com/google-gemini/gemini-cli
- **Claude Code**: https://github.com/anthropics/claude-code

### File System Requirements
- **CLAUDE.md**: Must exist in project root (Claude instructions)
- **GEMINI.md**: Must exist in project root (Gemini instructions)
- **specs/ directory**: Auto-created for specification outputs
- **Write permissions**: Required for specs directory and file generation

### Browser Compatibility
- **Modern browsers**: Required for React 18 features
- **WebSocket support**: Required for Socket.IO communication
- **ES6 modules**: Required for Vite build system

## Configuration Files

### Package.json Scripts
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

### Vite Configuration (`vite.config.js`)
- **React Plugin**: Fast refresh and JSX transformation
- **Development Server**: Port 3001 with Socket.IO proxy
- **Build Optimization**: Production-ready bundling

### Tailwind Configuration (`tailwind.config.js`)
- **Content Scanning**: HTML and React files
- **Custom Animations**: Fade-in, slide-up, typing indicators
- **Extended Theme**: Custom keyframes and timing functions

## Error Handling & Recovery

### Process Management
- **Automatic Restart**: Gemini process restarts on unexpected exit
- **Error Display**: Connection status and error messages in UI
- **Graceful Shutdown**: Proper cleanup on application exit

### File System Resilience
- **Permission Handling**: Clear error messages for file system issues
- **Path Validation**: Working directory and file existence checks
- **Graceful Degradation**: Continue operation if file watching fails

### Network Resilience
- **Auto-reconnection**: Socket.IO automatically reconnects on disconnection
- **Connection Status**: Visual indicator for connection state
- **Message Queuing**: Handles temporary connection losses