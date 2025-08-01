# Migration Status: Dual-Claude Architecture

## Completed Tasks ✅

### 1. Removed Old Implementation
- Deleted `/lib/gemini-process.js` (tmux-based Gemini management)

### 2. Created New Infrastructure
- Created workspace directories:
  - `/workspaces/requirements-discovery/` (for Requirements AI)
  - `/workspaces/technical-review/` (for Review AI)
  - `/shared-context/` (for shared project files)
- Added symlinks from workspaces to shared-context
- Copied instruction files:
  - GEMINI.md → `/workspaces/requirements-discovery/CLAUDE.md`
  - CLAUDE2.md → `/workspaces/technical-review/CLAUDE.md`

### 3. Implemented New Components
- **ClaudeProcessManager** (`/lib/claude-process-manager.js`)
  - Manages individual Claude Code processes
  - Handles --continue for stateful conversations
  - Direct process spawning (no tmux)
  - Structured output parsing

- **DualProcessOrchestrator** (`/lib/dual-process-orchestrator.js`)
  - Coordinates between two Claude processes
  - Routes messages based on collaboration state
  - Manages handoffs between Requirements and Review
  - Detects specifications and feedback

- **ClaudeMessageParser** (`/lib/claude-message-parser.js`)
  - Parses Claude's structured output
  - Handles conversation format (Human:/Assistant:)
  - Processes tool usage and JSON output

### 4. Updated Server Integration
- Modified `server.js` to use new architecture
- New Socket.IO events:
  - `requirements_message` / `review_message`
  - `active_process_changed`
  - `switch_process`
  - `trigger_review`
  - `orchestrator_status`

## Next Steps 🚀

### Frontend Updates Needed
1. Update `App.jsx` to handle new event types
2. Modify `ChatPanel.jsx` to show active process
3. Add process switching UI
4. Update message display for dual processes

### Testing Required
1. Verify Claude Code spawns correctly
2. Test --continue functionality
3. Validate message routing
4. Check collaboration handoffs

### Known Issues
- CollaborationDetector.js is no longer used (was Gemini-specific)
- Frontend still expects old event names
- No error recovery implemented yet

## How to Test

```bash
# Start the server
npm run server

# In another terminal, start frontend
npm run frontend

# Claude Code should spawn in both workspaces
# Check logs for process startup
```

## Architecture Summary

```
User → Frontend → Server → Orchestrator
                              ├── Requirements Process (GEMINI.md)
                              └── Review Process (CLAUDE2.md)
```

Two stateful Claude processes working together through server orchestration!