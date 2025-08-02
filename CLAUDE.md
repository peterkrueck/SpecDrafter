# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecDrafter is an AI collaboration tool that facilitates real-time specification drafting through dual-Claude architecture. It provides a browser-based interface where two Claude instances work together - one focused on requirements discovery and one on technical review - to create comprehensive technical specifications.

## Common Development Commands

### Development
```bash
# Install dependencies
npm install

# Start development servers (both frontend and backend)
npm start
# OR
npm run dev

# Run individual services
npm run server    # Backend only (port 3002)
npm run frontend  # Frontend only (port 3001)

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing & Code Quality
Currently, no test framework or linting is configured. When implementing tests or linting:
- Consider adding ESLint for JavaScript/React linting
- Consider Jest or Vitest for testing React components
- Add appropriate scripts to package.json

## Architecture & Code Structure

### High-Level Architecture Pattern
Dual-Claude SDK Integration → Socket.IO Real-time Communication → React Frontend → Specification Generation

### Technology Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + Socket.IO Client
- **Backend**: Node.js (ES Modules) + Express + Socket.IO
- **AI Integration**: Dual Claude instances via @anthropic-ai/claude-code SDK
- **Real-time**: WebSocket communication for chat and collaboration

### Key Architectural Components

#### 1. Dual-Claude Process Management
- **ClaudeSDKManager** (`backend/lib/claude-sdk-manager.js`): Manages individual Claude instances using the SDK
- **DualProcessOrchestrator** (`backend/lib/dual-process-orchestrator.js`): Coordinates between two Claude processes
- **Workspace-based Architecture**: Each Claude instance has its own workspace with custom CLAUDE.md instructions

#### 2. Claude Instance Roles
- **Discovery AI** (workspace: `backend/workspaces/requirements-discovery/`)
  - Uses Discovery AI instructions (via CLAUDE.md in its workspace)
  - Focuses on user interaction and requirements gathering
  - Identifies when specifications are ready for review
  - Initiates AI-to-AI communication using `@review:` markers
  
- **Review AI** (workspace: `backend/workspaces/technical-review/`)
  - Backend service that only communicates with Discovery AI
  - Lazy initialization - starts on-demand when Discovery AI needs review
  - Provides technical analysis and feasibility review
  - All output automatically routed to Discovery AI (no user interaction)

#### 3. Socket.IO Event Architecture
- **Client → Server**: 
  - `user_message`: User chat messages
  - `start_processes`: Manual process initialization
  - `switch_process`: Switch active AI (Discovery only - cannot switch to Review)
  - `trigger_review`: Initiate specification review
  - `reset_session`: Clear and restart
  - `change_model`: Switch between Claude 4 models (Opus/Sonnet)
  - `get_available_models`: Request list of available models
  
- **Server → Client**: 
  - `discovery_message`: Messages from Discovery AI
  - `ai_collaboration_message`: AI-to-AI communication events
  - `typing_indicator`: Show which AI is typing
  - `collaboration_detected`: AI-to-AI interaction events
  - `spec_file_generated`: New specification created
  - `spec_file_updated`: Existing specification modified
  - `orchestrator_status`: Current system state
  - `processes_ready`: Claude instances initialized
  - `available_models`: List of available Claude models
  - `model_changed`: Confirmation of model change

#### 4. React Component Hierarchy
```
App.jsx
├── ChatPanel.jsx (left panel)
│   ├── Message.jsx (with speaker identification)
│   ├── TypingIndicator.jsx
│   └── Generate & Review Spec Button (triggers automated workflow)
└── CollaborationPanel.jsx (right panel)
    ├── CollaborationView.jsx
    └── SpecView.jsx
```

### Message Flow

**User-to-AI Communication:**
1. User sends message via ChatPanel
2. Server always routes to Discovery AI (users cannot talk to Review AI)
3. ClaudeSDKManager processes with Claude SDK
4. Response emitted as `discovery_message`
5. Frontend displays in chat panel

**AI-to-AI Communication:**
1. AI includes `@review:` or `@discovery:` marker in response
2. Orchestrator detects marker and extracts message content
3. Message routed to target AI via ClaudeSDKManager
4. `ai_collaboration_message` event emitted to frontend
5. CollaborationView displays real-time AI conversation

### AI-to-AI Communication Protocol
The system implements autonomous AI-to-AI communication:

**Communication Flow:**
- `@review:` - Discovery AI sends messages to Review AI
- Review AI responses are automatically routed back to Discovery AI (no markers needed)

**Message Routing:**
1. Discovery AI includes `@review:` marker to send messages to Review AI
2. Content after marker is extracted and forwarded to Review AI
3. ALL Review AI output is automatically routed to Discovery AI via `ai_collaboration_message`
4. Review AI operates as a backend service with no direct user interaction
5. Real-time collaboration appears in CollaborationView.jsx panel

**Implementation Details:**
- Review AI uses lazy initialization - starts only when first needed
- `handleAIToAICommunication()` manages Discovery→Review routing
- `handleReviewOutput()` automatically routes all Review output to Discovery
- All AI-to-AI communication is logged and displayed in collaboration tab

### Specification Generation Flow

#### Automatic Workflow (User-Triggered via Button)
1. **User Initiation**: User clicks "Generate & Review Spec" button in chat panel
2. **Prompt Injection**: System sends predefined technical-focused prompt to Discovery AI
3. **Specification Writing**: Discovery AI creates technical spec at `/Users/peterkruck/repos/SpecDrafter/specs/[ProjectName]/spec.md`
4. **Automatic Review**: Discovery AI immediately sends `@review:` message to Review AI
5. **Technical Analysis**: Review AI reads spec file and provides implementation feedback
6. **Iterative Refinement**: Discovery uses `@review:`, Review responses auto-route back
7. **Real-time Display**: File watcher detects changes and updates SpecView automatically

#### Manual Workflow (Conversation-Based)
1. **Discovery Phase**: Discovery AI gathers project details from user
2. **Draft Detection**: When draft specification is detected, orchestrator notifies frontend
3. **AI-to-AI Review**: Discovery AI sends `@review:` message with specification
4. **Technical Feedback**: Review AI analyzes and responds (automatically routed to Discovery)
5. **Autonomous Iteration**: AIs continue collaborating until consensus
6. **File Generation**: Specifications saved to `specs/[ProjectName]/spec.md`
7. **UI Display**: File watcher detects and displays final specs in UI

#### Generated Specification Format
The system generates technical-focused specifications emphasizing:
- Implementation architecture and patterns
- Data models and schemas
- API endpoints and contracts
- Component structure and hierarchy
- Integration points and dependencies
- Security considerations
- Performance requirements

Explicitly avoids:
- Project timelines
- Budget information
- Non-technical content

### File Watcher System
The file watcher monitors the `specs/` directory for markdown files:

**Configuration** (`backend/lib/file-watcher.js`):
- Watches pattern: `specs/**/*.md` from project root
- Uses Chokidar library with `ignoreInitial: false`
- Detects both new files and modifications
- Converts markdown to HTML before emitting events

**Events**:
- `spec_file_generated`: Emitted when new `.md` files are created
  - Frontend auto-switches to spec view
  - Shows latest created specification
- `spec_file_updated`: Emitted when existing files are modified
  - Frontend updates content without view switching
  - Preserves user's current view (chat/collaboration)

**Important Behavior**:
- **Single Spec Display**: System shows only ONE specification at a time
- **Last Updated Wins**: Most recently created/modified spec is displayed
- **No File Selection UI**: Cannot switch between multiple specs
- **Automatic Detection**: All changes detected in real-time via WebSocket

## Important Development Notes

### Environment Requirements
- Node.js 18+ (for ES modules and Claude SDK support)
- Claude Code must be installed: `npm install -g @anthropic-ai/claude-code`
- Valid Claude API credentials in ~/.claude/.credentials.json

### Port Configuration
- Frontend development server: http://localhost:3001
- Backend Socket.IO server: http://localhost:3002
- Frontend proxies Socket.IO requests to backend

### Project Structure
```
SpecDrafter/
├── backend/                    # Server-side code
│   ├── server.js              # Express/Socket.IO server
│   ├── lib/                   # Backend libraries
│   │   ├── claude-sdk-manager.js
│   │   ├── dual-process-orchestrator.js
│   │   ├── file-watcher.js
│   │   ├── logger.js
│   │   ├── claude-message-parser.js
│   │   └── models.js          # Claude model configuration
│   ├── shared-context/        # Shared context between Claude instances
│   └── workspaces/            # Claude workspaces
│       ├── requirements-discovery/
│       │   ├── CLAUDE.md (contains Discovery AI instructions)
│       │   └── shared/ (symlink to ../shared-context)
│       └── technical-review/
│           ├── CLAUDE.md (contains Review AI instructions)
│           └── shared/ (symlink to ../shared-context)
├── frontend/                  # Client-side code
│   ├── index.html            # Main HTML file
│   ├── src/                  # React source code
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── styles/
│   ├── public/               # Static assets
│   ├── vite.config.js       # Vite configuration
│   ├── tailwind.config.js   # Tailwind configuration
│   └── postcss.config.js    # PostCSS configuration
├── specs/                    # Generated specifications (user deliverables)
├── dist/                     # Production build output
├── package.json             # Project dependencies and scripts
└── CLAUDE.md                # This file
```

### File System Considerations
- Each workspace has its own CLAUDE.md for custom behavior
- The `specs/` directory at project root is auto-created if missing
- Generated specifications follow pattern: `specs/[ProjectName]/spec.md`
- Backend and frontend code are cleanly separated into their respective directories
- The `backend/shared-context/` directory is symlinked into both workspaces for sharing files
- Both Discovery and Review AIs have explicit knowledge of spec file locations
- Review AI can directly access spec files for iterative improvements

### Working Directory and Path Context
**Critical for File Operations**:
- **Server runs from**: Project root (`/Users/peterkruck/repos/SpecDrafter`)
- **Discovery AI workspace**: `backend/workspaces/requirements-discovery/`
- **File watcher monitors**: `specs/**/*.md` relative to project root
- **Discovery AI MUST use absolute paths**: `/Users/peterkruck/repos/SpecDrafter/specs/[ProjectName]/spec.md`

**Why Absolute Paths Matter**:
- Discovery AI's working directory is deep in the workspace hierarchy
- Relative paths from AI workspace would create files in wrong location
- File watcher only monitors the project root `specs/` directory
- Mismatched paths = files created but never detected

### Real-time Communication
- Socket.IO handles all real-time messaging
- Auto-reconnection built-in for resilience
- Each Claude process maintains stateful conversations
- Session IDs preserved for conversation continuity

### Styling Approach
- Tailwind CSS with FreigeistAI-inspired design
- Custom animations defined in `tailwind.config.js`
- Glassmorphism effects using backdrop-blur
- Speaker identification (blue for Discovery AI, orange/red for Review AI)
- Real-time collaboration display with chat-like interface

## Claude SDK Integration Details

### SDK Configuration
- Uses `@anthropic-ai/claude-code` package
- Permission mode: `bypassPermissions` for automated operation
- Models: 
  - **Claude 4 Opus** (`claude-opus-4-20250514`): Best for complex reasoning and detailed analysis
  - **Claude 4 Sonnet** (`claude-sonnet-4-20250514`): Balanced performance and speed (default)
- Model selection: Dynamic switching between models via UI
- Max turns: 10 per conversation segment

### Session Management
- Sessions persist using `resume` option with session IDs
- Each Claude instance maintains independent session state
- Graceful process lifecycle management with proper cleanup

### Error Handling
- SDK errors propagated through EventEmitter pattern
- Process exit handling with automatic status updates
- Comprehensive logging at all stages

## Development Best Practices

### When Adding Features
1. Consider which Claude instance should handle the feature (Discovery vs Review AI)
2. Update appropriate Socket.IO event handlers
3. Maintain clear separation between discovery and review roles
4. Consider impact on AI-to-AI communication protocol
5. Test with both Claude instances active and autonomous collaboration
6. Ensure CollaborationView properly displays new AI interactions
7. For user-facing features, consider adding UI controls in ChatPanel
8. Update both AI CLAUDE.md files if the feature affects their behavior

### Debugging
- Check browser console for frontend logs
- Server logs show Claude process initialization and messages
- Each Claude instance logs with role prefix (CLAUDE-DISCOVERY, CLAUDE-REVIEW)
- Orchestrator logs show routing decisions and AI-to-AI communication
- CollaborationView shows real-time AI conversation flow

### Common Issues
- If messages don't appear: Check event name matching (discovery_message/ai_collaboration_message)
- If Claude doesn't respond: Verify SDK installation and credentials
- If sessions don't persist: Check session ID handling in ClaudeSDKManager
- If AI-to-AI communication fails: Check marker parsing in handleAIToAICommunication
- If spec files don't appear: 
  - Check file watcher is monitoring correct path (should be `specs/**/*.md` from project root)
  - Verify Discovery AI uses absolute paths (`/Users/peterkruck/repos/SpecDrafter/specs/[ProjectName]/spec.md`)
  - Check server logs for file watcher events
- If spec updates don't show: Ensure both `spec_file_generated` and `spec_file_updated` handlers exist in frontend

---

## SPECIFICATION REVIEW MODE

When working on this project, Claude Code should be aware of the dual-AI architecture and help maintain the separation of concerns between requirements discovery and technical review. The project demonstrates advanced AI-to-AI collaboration patterns using modern SDK integration instead of terminal-based approaches.