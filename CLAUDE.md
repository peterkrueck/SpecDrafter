# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecDrafter is an AI collaboration tool that facilitates real-time specification drafting through dual-Claude architecture. It provides a browser-based interface where two Claude instances work together - one focused on requirements discovery and one on technical review - to create comprehensive technical specifications.

**Note on Paths**: All file paths in this documentation use placeholders like `[project-root]` which are dynamically resolved based on where the project is cloned. The system automatically handles path resolution for different installations.

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
- **MessageSplitter** (`backend/lib/message-splitter.js`): Pure function for splitting messages at `@review:` markers
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
  - `start_processes`: Initialize Discovery AI with optional `initialMessage` parameter (sent when user submits welcome form)
  - `list_specs`: Request list of existing specifications
  - `start_with_existing_spec`: Start session with existing spec (includes projectName, modelId, skillLevel)
  - `switch_process`: Switch active AI (Discovery only - cannot switch to Review)
  - `trigger_review`: Initiate specification review
  - `reset_session`: Clear and restart
  - `change_model`: Switch between Claude 4 models (Opus/Sonnet)
  - `get_available_models`: Request list of available models
  - `stop_ai_response`: Immediately stop both AI processes
  
- **Server → Client**: 
  - `discovery_message`: Messages from Discovery AI
  - `ai_collaboration_message`: AI-to-AI communication events
  - `typing_indicator`: Show which AI is typing in chat panel
  - `ai_collaboration_typing`: Show which AI is typing in collaboration panel
  - `collaboration_detected`: AI-to-AI interaction events
  - `spec_file_generated`: New specification created
  - `spec_file_updated`: Existing specification modified
  - `specs_list`: List of available specifications
  - `orchestrator_status`: Current system state
  - `processes_ready`: Claude instances initialized
  - `available_models`: List of available Claude models
  - `model_changed`: Confirmation of model change
  - `ai_stopped`: Confirmation that AI processes were stopped
  - `processes_stopped`: Event fired when all processes have been terminated

### Message Flow

**Initialization Flow:**
1. User chooses between "Start New Project" or "Continue Existing Project"
2. For new projects:
   - User fills welcome form with project details and technical background
   - On submit, frontend emits `start_processes` with user's project info as `initialMessage`
   - Server starts Discovery AI using project details as first prompt
3. For existing projects:
   - User selects technical background and chooses from available specifications
   - Frontend emits `start_with_existing_spec` with projectName, modelId, and skillLevel
   - Discovery AI receives spec file path and user's technical background
4. Discovery AI adapts communication style based on technical background (Non-Tech, Tech-Savvy, or Software Professional)
5. Session continues with contextual understanding

**User-to-AI Communication:**
1. User sends message via ChatPanel
2. Server always routes to Discovery AI (users cannot talk to Review AI)
3. ClaudeSDKManager processes with Claude SDK
4. Response emitted as `discovery_message`
5. Frontend displays in chat panel

**AI-to-AI Communication:**
1. Discovery AI includes `@review:` marker anywhere in its message
2. Orchestrator splits the message: content before `@review:` goes to user, content from `@review:` onward goes to Review AI
3. Message routed to Review AI via ClaudeSDKManager
4. `ai_collaboration_message` event emitted to frontend
5. CollaborationView displays real-time AI conversation

### AI-to-AI Communication Protocol
The system implements autonomous AI-to-AI communication:

**Communication Flow:**
- `@review:` - Discovery AI sends messages to Review AI (can appear anywhere in the message)
- Review AI responses are automatically routed back to Discovery AI (no markers needed)

**Message Routing:**
1. Discovery AI includes `@review:` marker in message to route to Review AI
2. Thinking tags are filtered out BEFORE routing check (prevents `@review:` inside thinking from triggering)
3. Content before marker goes to user, content from marker onward goes to Review AI
4. ALL Review AI output is automatically routed to Discovery AI via `ai_collaboration_message`
5. Review AI operates as a backend service with no direct user interaction
6. Real-time collaboration appears in CollaborationView.jsx panel

**Implementation Details:**
- Review AI uses lazy initialization - starts only when first needed
- `MessageSplitter.split()` handles all message splitting logic at `@review:` markers
- `handleDiscoveryOutput()` filters thinking tags, uses splitter, then routes messages
- `handleAIToAICommunication()` processes the Review AI portion of split messages
- `handleReviewOutput()` filters thinking tags then automatically routes all Review output to Discovery
- All AI-to-AI communication is logged and displayed in collaboration tab
- **Thinking Tag Filtering**: Backend `ClaudeMessageParser.filterThinkingTags()` removes all `<thinking>` variations before routing (single source of truth)
- **Split Decision Logging**: Every routing decision logged with `📊 Message split decision` for debugging
- **Typing Indicators**: 
  - Main chat uses `typing_indicator` events, collaboration uses `ai_collaboration_typing`
  - 100ms delays prevent race conditions when switching between AI speakers
  - Discovery exit events don't clear collaboration typing during active AI-to-AI communication
  - Discovery AI typing stops explicitly after processing Review feedback
  - `hasReviewBeenTriggered` flag resets when Review AI exits to ensure proper state

### Thinking Mode Implementation
The system automatically triggers Claude's thinking/reasoning mode for deeper analysis:

**Automatic Triggers:**
- **User → Discovery AI**: All user messages have "think hard" appended (invisible to users)
- **AI ↔️ AI**: All AI-to-AI messages have "think harder" appended (invisible in UI)
- **Generate & Review Button**: Includes "ultrathink" keyword for maximum depth analysis

**Implementation in Orchestrator:**
- Located in `backend/lib/dual-process-orchestrator.js`
- `routeUserMessage()`: Appends "think hard" to user messages
- `handleAIToAICommunication()`: Appends "think harder" when routing to Review AI
- `handleReviewOutput()`: Appends "think harder" when forwarding Review responses

**Key Features:**
- Completely invisible to users - original messages displayed in UI
- Triggers stored only in backend routing, not in conversation history
- Enables deeper reasoning for all interactions automatically
- "ultrathink" reserved for critical specification generation tasks

**Logging:**
- All thinking triggers logged with `hasThinkingTrigger: true` for debugging
- Original message lengths preserved in logs for monitoring

### Specification Generation Flow

#### Automatic Workflow (User-Triggered via Button)
1. **User Initiation**: User clicks "Generate & Review Spec" button in chat panel
2. **Prompt Injection**: System sends predefined technical-focused prompt to Discovery AI
3. **Specification Writing**: Discovery AI creates technical spec at `[project-root]/specs/[ProjectName]/spec.md`
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
- **Continue Existing Projects**: Users can now select and continue working on existing specifications
- **Technical Background Adaptation**: Discovery AI adapts communication style based on user's technical level
- **Automatic Detection**: All changes detected in real-time via WebSocket

### Promotional Modal System
The system includes a non-intrusive promotional modal for FreigeistAI (https://www.freigeist.dev):

**Implementation** (`frontend/src/components/PromoModal.jsx`):
- Displays 30 seconds after spec generation or update
- Shows creator's photo for personal touch
- Glassmorphism styling matching app aesthetic
- Three action buttons:
  - "Check out FreigeistAI" - Opens website in new tab
  - "Maybe later" - Closes modal for current session
  - "Don't show again" - Permanently dismisses via localStorage

**Trigger Logic** (`frontend/src/App.jsx`):
- `triggerPromoModalTimer()` function handles timing
- Triggers on both events:
  - `spec_file_generated` - New specification files
  - `spec_file_updated` - Existing files being overwritten
- Only shows once per session
- Respects localStorage preference for permanent dismissal
- Timer resets if multiple specs are generated

**Key Features**:
- **30-Second Delay**: Allows users to review spec before showing
- **Session Control**: `hasShownPromoThisSession` state prevents spam
- **Persistent Preference**: `specdrafter-promo-dismissed` localStorage key
- **Human Touch**: Includes creator photo at `frontend/src/assets/creator-photo.jpeg`

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
├── backend/                          # Server-side code
│   ├── server.js                    # Express/Socket.IO server
│   ├── lib/                        # Backend libraries
│   │   ├── claude-sdk-manager.js   # Claude SDK integration
│   │   ├── dual-process-orchestrator.js # AI process coordination
│   │   ├── message-splitter.js    # Message splitting at @review: markers
│   │   ├── file-watcher.js         # File system monitoring
│   │   ├── logger.js               # Logging utilities
│   │   ├── claude-message-parser.js # Message parsing utilities
│   │   └── models.js               # Claude model configuration
│   └── workspaces/                 # Claude AI workspaces
│       ├── requirements-discovery/  # Discovery AI workspace
│       │   ├── .claude/            # Claude workspace config
│       │   └── CLAUDE.md           # Discovery AI instructions
│       └── technical-review/       # Review AI workspace
│           ├── .claude/            # Claude workspace config
│           └── CLAUDE.md           # Review AI instructions
├── frontend/                        # Client-side code
│   ├── index.html                  # Main HTML entry point
│   ├── src/                        # React source code
│   │   ├── App.jsx                 # Main React component
│   │   ├── main.jsx                # React entry point
│   │   ├── components/             # React components
│   │   │   ├── ChatPanel.jsx       # User chat interface
│   │   │   ├── CollaborationPanel.jsx # AI collaboration container
│   │   │   ├── CollaborationView.jsx # AI-to-AI conversation display
│   │   │   ├── Message.jsx         # Individual message component
│   │   │   ├── SpecSelector.jsx    # Existing spec selection
│   │   │   ├── SpecView.jsx        # Generated spec display
│   │   │   ├── TypingIndicator.jsx # AI typing indicator
│   │   │   ├── WelcomeScreen.jsx   # Initial project setup
│   │   │   └── PromoModal.jsx      # Promotional modal for FreigeistAI
│   │   ├── config/                 # Configuration files
│   │   │   └── models.js           # Frontend model configuration
│   │   ├── assets/                 # Static assets
│   │   │   └── creator-photo.jpeg  # Creator photo for promo modal
│   │   ├── hooks/                  # React hooks
│   │   │   └── useSocket.js        # Socket.IO connection hook
│   │   └── styles/                 # CSS styles
│   │       └── globals.css         # Global CSS with Tailwind
│   ├── vite.config.js              # Vite build configuration
│   ├── tailwind.config.js          # Tailwind CSS configuration
│   └── postcss.config.js           # PostCSS configuration
├── specs/                          # Generated specifications (user deliverables)
├── dist/                           # Production build output
├── .env.local                      # Environment variables
├── package.json                    # Project dependencies and scripts
├── package-lock.json               # Locked dependency versions
├── README.md                       # Project documentation
├── LICENSE.md                      # Project license
└── CLAUDE.md                       # This file
```

### File System Considerations
- Each workspace has its own CLAUDE.md for custom behavior
- The `specs/` directory at project root is auto-created if missing
- Generated specifications follow pattern: `specs/[ProjectName]/spec.md`
- Backend and frontend code are cleanly separated into their respective directories
- Both Discovery and Review AIs have explicit knowledge of spec file locations
- Review AI can directly access spec files for iterative improvements
- Workspace configuration stored in `.claude/` subdirectories

### Working Directory and Path Context
**Critical for File Operations**:
- **Server runs from**: Project root (where the project is cloned)
- **Discovery AI workspace**: `backend/workspaces/requirements-discovery/`
- **File watcher monitors**: `specs/**/*.md` relative to project root
- **Discovery AI receives full paths**: The system provides complete paths in messages

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
- **Stop Button**: Users can immediately terminate both AI processes mid-response
  - Appears only when AI is actively typing
  - Uses AbortController to cleanly cancel Claude SDK queries
  - Clears all typing indicators in both panels
  - Allows immediate user input without waiting

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

**Fresh Session Behavior**:
- **New Projects**: Both Discovery and Review AI start with completely empty context windows
- **Existing Projects**: Discovery AI starts fresh - only receives spec file path in initial message
- **Review AI Initialization**: Always starts fresh when first spawned in a project
- **Key Mechanism**: `usesContinue=false` in spawn() prevents `resume` option, ensuring clean slate

**Session Continuity**:
- Sessions persist using `resume` option with session IDs when `usesContinue=true`
- Each Claude instance maintains independent session state
- Within a project session, follow-up messages maintain context via resume
- **Session Isolation**: Each project session is completely isolated - no cross-contamination

**Technical Implementation**:
- `ClaudeSDKManager.spawn()` controls session behavior via `usesContinue` parameter
- When `false`: No `resume` option added to query options → fresh session
- When `true`: Adds `resume: this.sessionId` to maintain conversation context
- **AbortController Integration**: Proper cancellation support for Claude SDK queries
  - Each query gets its own AbortController instance
  - Clean termination without leaving hanging processes
  - Handles AbortError gracefully in catch blocks

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
- **Message splitting**: Look for `📊 Message split decision` logs showing routing details
- CollaborationView shows real-time AI conversation flow

### Common Issues
- If messages don't appear: Check event name matching (discovery_message/ai_collaboration_message)
- If Claude doesn't respond: Verify SDK installation and credentials
- If sessions don't persist: Check session ID handling in ClaudeSDKManager
- If AI-to-AI communication fails: 
  - Check @review: marker is present in the message
  - Verify MessageSplitter.split() is working correctly
  - Check split decision logs for routing details
- If typing indicators don't show in AI collaboration:
  - Check for `🔴 Review AI typing indicator` logs to verify emission
  - Ensure Discovery process exit doesn't occur during active collaboration (check `collaborationState`)
  - Verify 100ms delays are working to prevent race conditions
  - Check `hasReviewBeenTriggered` flag is properly reset on Review AI exit
- If spec files don't appear: 
  - Check file watcher is monitoring correct path (should be `specs/**/*.md` from project root)
  - Verify Discovery AI uses the full paths provided in messages
  - Check server logs for file watcher events
- If spec updates don't show: Ensure both `spec_file_generated` and `spec_file_updated` handlers exist in frontend

---

## SPECIFICATION REVIEW MODE

When working on this project, Claude Code should be aware of the dual-AI architecture and help maintain the separation of concerns between requirements discovery and technical review. The project demonstrates advanced AI-to-AI collaboration patterns using modern SDK integration instead of terminal-based approaches.