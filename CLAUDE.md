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
- **Requirements Discovery** (workspace: `backend/workspaces/requirements-discovery/`)
  - Uses GEMINI.md instructions (via CLAUDE.md in its workspace)
  - Focuses on user interaction and requirements gathering
  - Identifies when specifications are ready for review
  
- **Technical Review** (workspace: `backend/workspaces/technical-review/`)
  - Uses CLAUDE2.md instructions (via CLAUDE.md in its workspace)
  - Provides technical analysis and feasibility review
  - Challenges assumptions and suggests improvements

#### 3. Socket.IO Event Architecture
- **Client → Server**: 
  - `user_message`: User chat messages
  - `start_processes`: Manual process initialization
  - `switch_process`: Switch active AI
  - `trigger_review`: Initiate specification review
  - `reset_session`: Clear and restart
  
- **Server → Client**: 
  - `requirements_message`: Messages from Requirements AI
  - `review_message`: Messages from Review AI
  - `typing_indicator`: Show which AI is typing
  - `collaboration_detected`: AI-to-AI interaction events
  - `spec_file_generated`: New specification created
  - `orchestrator_status`: Current system state
  - `processes_ready`: Claude instances initialized

#### 4. React Component Hierarchy
```
App.jsx
├── ChatPanel.jsx (left panel)
│   ├── Message.jsx (with speaker identification)
│   └── TypingIndicator.jsx
└── CollaborationPanel.jsx (right panel)
    ├── CollaborationView.jsx
    └── SpecView.jsx
```

### Message Flow
1. User sends message via ChatPanel
2. Server routes to active Claude process (default: requirements)
3. ClaudeSDKManager processes with Claude SDK
4. Response emitted as `requirements_message` or `review_message`
5. Frontend displays with appropriate speaker identification

### Specification Generation Flow
1. Requirements AI gathers project details from user
2. When draft specification is detected, orchestrator notifies frontend
3. User can trigger review to send spec to Technical Review AI
4. Review AI provides feedback and technical analysis
5. Specifications saved to `specs/[ProjectName]/spec.md`
6. File watcher detects and displays in UI

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
│   │   └── claude-message-parser.js
│   ├── shared-context/        # Shared context between Claude instances
│   └── workspaces/            # Claude workspaces
│       ├── requirements-discovery/
│       │   ├── CLAUDE.md (contains GEMINI.md instructions)
│       │   └── shared/ (symlink to ../shared-context)
│       └── technical-review/
│           ├── CLAUDE.md (contains CLAUDE2.md instructions)
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

### Real-time Communication
- Socket.IO handles all real-time messaging
- Auto-reconnection built-in for resilience
- Each Claude process maintains stateful conversations
- Session IDs preserved for conversation continuity

### Styling Approach
- Tailwind CSS with FreigeistAI-inspired design
- Custom animations defined in `tailwind.config.js`
- Glassmorphism effects using backdrop-blur
- Speaker identification (blue for Requirements, red for Review)

## Claude SDK Integration Details

### SDK Configuration
- Uses `@anthropic-ai/claude-code` package
- Permission mode: `bypassPermissions` for automated operation
- Models: claude-3-5-sonnet (primary), claude-3-sonnet (fallback)
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
1. Consider which Claude instance should handle the feature
2. Update appropriate Socket.IO event handlers
3. Maintain clear separation between requirements and review roles
4. Test with both Claude instances active

### Debugging
- Check browser console for frontend logs
- Server logs show Claude process initialization and messages
- Each Claude instance logs with role prefix (CLAUDE-REQUIREMENTS, CLAUDE-REVIEW)
- Orchestrator logs show routing decisions

### Common Issues
- If messages don't appear: Check event name matching (requirements_message/review_message)
- If Claude doesn't respond: Verify SDK installation and credentials
- If sessions don't persist: Check session ID handling in ClaudeSDKManager

---

## SPECIFICATION REVIEW MODE

When working on this project, Claude Code should be aware of the dual-AI architecture and help maintain the separation of concerns between requirements discovery and technical review. The project demonstrates advanced AI-to-AI collaboration patterns using modern SDK integration instead of terminal-based approaches.