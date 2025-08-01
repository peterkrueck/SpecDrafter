# AI Implementation Blueprint for SpecDrafter

## Context for Future Claude Instances

This document serves as the technical blueprint for transforming SpecDrafter from a Gemini CLI/tmux-based system to a dual-Claude architecture. Read this to understand what you're building and why.

## The Problem We're Solving

**Current State**: SpecDrafter uses tmux to manage Gemini CLI, which has:
- Complex terminal output parsing
- TTY/interactive mode issues with node-pty
- React/Ink UI that blocks programmatic integration
- Single AI instance handling both requirements discovery and technical review

**Target State**: Two separate Claude Code processes with different instructions:
- Process 1: Requirements Discovery (GEMINI.md instructions)
- Process 2: Technical Review (CLAUDE2.md instructions)
- Clean JSON communication instead of terminal scraping
- Proper stateful conversations with `--continue`

## Core Architecture

### Process Management Structure

```
SpecDrafter Server (Node.js)
    ├── ClaudeProcessManager (requirements)
    │   ├── Workspace: ./workspaces/requirements-discovery/
    │   ├── CLAUDE.md: Contains GEMINI.md content
    │   └── Session State: Maintained with --continue
    │
    └── ClaudeProcessManager (review)
        ├── Workspace: ./workspaces/technical-review/
        ├── CLAUDE.md: Contains CLAUDE2.md content
        └── Session State: Maintained with --continue
```

### Why This Architecture Works

1. **Workspace Isolation**: Each Claude instance has its own directory with its own CLAUDE.md
2. **Stateful Conversations**: Both processes can use `--continue` to maintain context
3. **No Direct Communication**: Processes communicate through the server, preventing context pollution
4. **Incremental Updates**: Only new messages are passed between processes (no context bloat)

## Implementation Components

### 1. ClaudeProcessManager (Replace TmuxGeminiManager)

**Purpose**: Manage individual Claude Code processes

**Key Implementation Details**:
```javascript
class ClaudeProcessManager {
  constructor(role, workspacePath) {
    this.role = role; // 'requirements' or 'review'
    this.workspacePath = workspacePath;
    this.process = null;
    this.hasSession = false;
  }
  
  async spawn(prompt, usesContinue = false) {
    const args = ['-p', prompt];
    if (usesContinue && this.hasSession) {
      args.splice(0, 0, '--continue'); // Add --continue at the beginning
    }
    
    this.process = spawn('claude', args, {
      cwd: this.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Parse JSON output instead of terminal output
    this.process.stdout.on('data', this.handleJSONOutput);
  }
}
```

### 2. DualProcessOrchestrator (New Component)

**Purpose**: Coordinate between the two Claude processes

**Key Responsibilities**:
- Route messages to appropriate process
- Manage collaboration state (discovering → drafting → reviewing)
- Handle process lifecycle
- Coordinate handoffs between processes

**Critical State Machine**:
```
User Input → Requirements Process
    ↓
Requirements Process creates draft
    ↓
Orchestrator detects completion → Sends to Review Process
    ↓
Review Process provides feedback
    ↓
Orchestrator sends feedback → Requirements Process
    ↓
(Iterate until consensus)
```

### 3. Workspace Setup

**Directory Structure**:
```
workspaces/
├── requirements-discovery/
│   ├── CLAUDE.md (copy of GEMINI.md)
│   ├── .claude/ (session storage)
│   └── shared -> ../../shared-context/
└── technical-review/
    ├── CLAUDE.md (copy of CLAUDE2.md)
    ├── .claude/ (session storage)
    └── shared -> ../../shared-context/
```

**Symlink Strategy**: Both workspaces have symlinks to shared-context for accessing project files

### 4. Message Routing Logic

**Key Principle**: Server maintains conversation context, processes maintain specialized context

**Routing Patterns**:
```javascript
// User message → Requirements Process
if (collaborationState === 'discovering') {
  requirementsProcess.send(userMessage);
}

// Requirements output → Review Process (when draft detected)
if (isDraftSpecification(requirementsOutput)) {
  reviewProcess.send({
    type: 'review_request',
    content: requirementsOutput
  });
}

// Review feedback → Requirements Process
if (reviewOutput.type === 'feedback') {
  requirementsProcess.send({
    type: 'technical_feedback',
    content: reviewOutput.content
  });
}
```

### 5. Socket.IO Event Restructuring

**Old Events** (to maintain):
- `user_message`
- `reset_session`
- `spec_file_generated`

**New Events** (to add):
```javascript
// Server → Client
'active_process' // Which AI is currently active
'requirements_output' // From Process 1
'review_output' // From Process 2
'collaboration_event' // AI-to-AI communication

// Client → Server
'switch_process' // Manual process switching
'trigger_review' // Force collaboration
```

### 6. Frontend Modifications

**App.jsx Changes**:
- Add `activeProcess` state ('requirements' | 'review')
- Add `requirementsHistory` and `reviewHistory` arrays
- Update message handlers for dual processes

**ChatPanel.jsx Changes**:
- Add process indicator badge
- Filter messages based on active process
- Add process switch button

**New Component**: ProcessIndicator.jsx
- Shows which AI is active
- Displays collaboration state
- Allows manual switching

## Critical Implementation Notes

### Claude Code Invocation Patterns

**First Message** (no session):
```bash
claude -p "You are working on a project..."
```

**Subsequent Messages** (with session):
```bash
claude --continue -p "The user responded with..."
```

**Key**: Track `hasSession` state per process

### Output Parsing

Claude Code with `-p` outputs structured data. Parse for:
- User messages
- AI responses  
- Tool usage
- Session information

### Error Handling

Each process needs:
- Spawn error handling
- Unexpected exit recovery
- Output parsing error handling
- Timeout management

### State Persistence

- Each workspace maintains its own `.claude/` directory
- Sessions persist across server restarts
- Use `--continue` to resume conversations

## File Changes Summary

### Files to Create:
- `/lib/claude-process-manager.js` (new process management)
- `/lib/dual-process-orchestrator.js` (coordination logic)
- `/lib/workspace-manager.js` (workspace setup)
- `/src/components/ProcessIndicator.jsx` (UI component)

### Files to Modify:
- `server.js` - Add orchestrator, update Socket.IO events
- `App.jsx` - Dual process state management
- `ChatPanel.jsx` - Process-aware message display
- `/lib/message-parser.js` - Adapt for Claude JSON output

### Files to Remove:
- `/lib/gemini-process.js` (replaced by claude-process-manager)

## Testing Approach

### Manual Testing Checklist:
1. Both processes spawn successfully
2. Messages route to correct process
3. `--continue` maintains conversation state
4. Process switching works in UI
5. Collaboration handoffs work correctly
6. Error recovery functions properly

### Key Test Scenarios:
- User → Requirements → Review → Requirements flow
- Process crash and recovery
- Server restart with session persistence
- Concurrent message handling

## Common Pitfalls to Avoid

1. **Don't share CLAUDE.md**: Each process needs its own file
2. **Don't mix contexts**: Keep process conversations separate
3. **Don't forget --continue**: Track session state per process
4. **Don't parse terminal output**: Use Claude's structured output
5. **Don't copy full history**: Only pass new messages between processes

## The Vision

Two specialized AI agents collaborating through your application:
- **Requirements AI**: Empathetic, user-focused, asks clarifying questions
- **Technical AI**: Pragmatic, detail-oriented, ensures feasibility

Your server orchestrates their collaboration, creating better specifications through AI teamwork.

## Next Session Quick Start

1. Read this document first
2. Check current implementation progress in `/lib/`
3. Look for TODO comments in modified files
4. Run `npm run dev` to see current state
5. Continue implementation following this blueprint

Remember: The goal is clean separation of concerns with two stateful Claude processes working together through server orchestration.