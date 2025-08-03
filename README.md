# SpecDrafter

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Claude SDK](https://img.shields.io/badge/Claude%20SDK-Latest-blue)](https://github.com/anthropics/claude-code)

An AI collaboration platform that revolutionizes technical specification writing through dual-Claude architecture, ensuring you build the right thing before you write a single line of code.

> **SpecDrafter** - Where two AI minds collaborate to transform your ideas into crystal-clear technical specifications.

## 🎯 Why SpecDrafter?

> *Ever spent weeks building a feature only to realize it wasn't what the stakeholders actually needed?*

Building software without clear specifications is like constructing a house without blueprints. SpecDrafter ensures you build the right thing from the start.

### The Problem: 90% of Software Projects Fail at Requirements

```
❌ Requirements get lost in translation between stakeholders and developers
❌ Over-engineering creeps in - building features nobody asked for
❌ Technical constraints discovered too late in the process
❌ Specs take forever to write and become outdated immediately
```

### The Solution: Dual-AI Collaborative Intelligence

✅ **Two Specialized AI Minds Working Together:**

| AI Role | What It Does | Why It Matters |
|---------|--------------|----------------|
| **Discovery AI** 🔵 | • Talks to humans naturally<br>• Challenges assumptions<br>• Anti-over-engineering built-in | Gets to what users ACTUALLY need, not what they think they want |
| **Review AI** 🔴 | • Technical reality checks<br>• Feasibility analysis<br>• Architecture validation | Catches problems before you write code |

**The Magic:** Watch them collaborate in real-time through the `@review:` protocol - Discovery drafts, Review validates, together they refine until you have a specification that's both user-focused AND technically sound.

### 🎉 The Result

> **Transform vague ideas into implementation-ready specifications in minutes, not days. One click generates a complete technical spec with built-in feasibility validation.**

## Quick Start

### Prerequisites

- Node.js 18+ (required for ES modules)
- [Claude Code](https://github.com/anthropics/claude-code) installed globally
- Valid Claude API credentials

### Recommended MCP Servers (Optional)

While SpecDrafter works out of the box, installing these MCP servers greatly enhances the AI's capabilities:

- **[Context7](https://github.com/upstash/context7)** - Provides up-to-date library documentation for Review AI's technical analysis
- **[DeepWiki](https://docs.devin.ai/work-with-devin/deepwiki-mcp)** - Enables AI to access and search public repository documentation

These servers allow the Review AI to validate technical decisions against current best practices and real-world implementations.

### Installation

```bash
# Clone the repository
git clone https://github.com/peterkrueck/SpecDrafter.git
cd SpecDrafter

# Install dependencies
npm install

# Start the application
npm start
```

The application will open at:
- Frontend: http://localhost:3001
- Backend: http://localhost:3002

### First Run

1. **Choose Your Path**:
   - 🆕 **New Project**: Start fresh with your project idea
   - 📂 **Existing Project**: Continue working on a previous specification

2. **Set Your Technical Level**:
   - 👤 **Non-Tech**: Business-focused explanations
   - 💻 **Tech-Savvy**: Balanced technical details
   - 🚀 **Software Professional**: Deep technical discussions

3. **Start Collaborating**:
   - Chat naturally with Discovery AI about your project
   - Click "Generate & Review Spec" when ready
   - Watch the AIs collaborate in real-time
   - Download your specification when complete

## Architecture

### Dual-Claude Intelligence System

```
┌─────────────────────────────── USER INTERFACE ───────────────────────────────┐
│                                                                               │
│  ┌─────────────────────┐                    ┌──────────────────────────────┐ │
│  │                     │                    │                              │ │
│  │    CHAT PANEL       │                    │   COLLABORATION PANEL        │ │
│  │                     │                    │                              │ │
│  │  User ←→ Discovery  │                    │  ┌────────────────────────┐ │ │
│  │                     │                    │  │  AI Collaboration Tab  │ │ │
│  │  - Natural language │                    │  │                        │ │ │
│  │  - Requirements     │                    │  │  Discovery ←→ Review   │ │ │
│  │  - Q&A flow        │                    │  │  Real-time dialogue    │ │ │
│  │                     │                    │  └────────────────────────┘ │ │
│  │                     │                    │  ┌────────────────────────┐ │ │
│  │  [Generate & Review │                    │  │  Specification Tab     │ │ │
│  │   Spec Button]      │                    │  │                        │ │ │
│  │                     │                    │  │  Live spec preview     │ │ │
│  │                     │                    │  │  Markdown → HTML       │ │ │
│  └──────────┬──────────┘                    │  └────────────────────────┘ │ │
│             │                               └──────────────────────────────┘ │
└─────────────┼─────────────────────────────────────────────────────────────────┘
              │
              │ User message
              ▼
┌─────────────────────────┐      @review:      ┌─────────────────────────┐
│                         │ ─────────────────→ │                         │
│     DISCOVERY AI        │                    │       REVIEW AI         │
│   (Claude Instance 1)   │                    │   (Claude Instance 2)   │
│                         │ ←───────────────── │                         │
│ • Requirements focus    │   Auto-routed      │ • Technical analysis    │
│ • User communication    │    responses       │ • Feasibility checks    │
│ • Anti-over-engineering│                    │ • Architecture review   │
│ • Spec drafting        │                    │ • No user interaction   │
└────────────┬────────────┘                    └─────────────────────────┘
             │
             │ Final specification
             ▼
      ┌──────────────┐
      │ SPEC OUTPUT  │
      │             │
      │ specs/*/    │
      │  spec.md    │
      └──────────────┘
```

### Technology Stack

**Frontend**:
- React 18 + Vite (lightning-fast development)
- Tailwind CSS (beautiful glassmorphism UI)
- Socket.IO Client (real-time communication)

**Backend**:
- Node.js + Express (ES modules)
- Socket.IO Server (WebSocket magic)
- Claude SDK (official Anthropic integration)
- Chokidar (file system monitoring)

### Key Components

#### 1. Dual Process Orchestrator
Manages the complex dance between Discovery and Review AIs:
- State management (discovering → drafting → reviewing → refining)
- Message routing with @review: protocol
- Session persistence and recovery

#### 2. Claude SDK Manager
Sophisticated AI instance management:
- Dynamic model switching (Opus/Sonnet)
- Session continuity with resume capability
- Proper cancellation with AbortController
- Tool configuration per AI role

#### 3. Real-time Communication Layer
WebSocket-powered collaboration:
- Live typing indicators for both AIs
- Instant message delivery
- File change detection and broadcasting
- Multi-client support

## Common Tasks

### Starting a New Project

```javascript
// 1. User provides project overview
"I need a task management app for remote teams"

// 2. Discovery AI explores requirements
"What's the main pain point for your remote teams?"

// 3. Click "Generate & Review Spec"
// 4. Watch AIs collaborate
// 5. Download comprehensive specification
```

### Continuing an Existing Project

1. Select "Continue Existing Project" on welcome screen
2. Choose your specification from the list
3. Pick up where you left off with full context

### Customizing AI Behavior

Each AI has its own `CLAUDE.md` configuration:
- `backend/workspaces/requirements-discovery/CLAUDE.md` - Discovery AI behavior
- `backend/workspaces/technical-review/CLAUDE.md` - Review AI behavior

## Configuration

### Model Selection

Choose between two Claude 4 models:
- **Opus**: Best for complex projects requiring deep analysis
- **Sonnet**: Balanced performance for most use cases (default)

### Environment Variables

```bash
# Optional: Set custom ports
FRONTEND_PORT=3001
BACKEND_PORT=3002

# Optional: Enable debug logging
DEBUG=true
```

## Development

### Project Structure

```
SpecDrafter/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── hooks/              # Custom React hooks
│   │   └── App.jsx             # Main application
│   └── vite.config.js          # Build configuration
├── backend/                     # Node.js server
│   ├── server.js               # Express + Socket.IO
│   ├── lib/                    # Core libraries
│   │   ├── claude-sdk-manager.js
│   │   ├── dual-process-orchestrator.js
│   │   └── file-watcher.js
│   └── workspaces/             # AI configurations
│       ├── requirements-discovery/
│       └── technical-review/
├── specs/                      # Generated specifications
└── package.json                # Dependencies
```

### Running in Development

```bash
# Start both frontend and backend with hot reload
npm run dev

# Or run separately:
npm run frontend  # Start frontend only
npm run server    # Start backend only
```

### Building for Production

```bash
npm run build
npm run preview  # Test production build
```

## Best Practices

1. **Let Discovery AI Lead**: Don't jump straight to technical details
2. **Trust the Process**: The anti-over-engineering principle works
3. **Watch the Collaboration**: Understanding AI reasoning helps you make better decisions
4. **Iterate**: Use the Review AI's feedback to refine requirements
5. **Export Early**: Download specs as markdown for version control

## FAQ

**Q: How is this different from just using Claude or ChatGPT?**

**A:** SpecDrafter implements a dual-AI system where two specialized Claude instances collaborate. Discovery AI focuses on understanding your actual needs while Review AI ensures technical feasibility. You get the benefit of two expert perspectives working together, plus a structured specification process.

**Q: Can I use this with languages other than English?**

**A:** Currently, SpecDrafter is optimized for English. The AI instructions and prompts are in English, though Claude can understand other languages.

**Q: What happens to my specifications?**

**A:** All specifications are stored locally in your `specs/` directory. Nothing is sent to external servers except the Claude API calls for AI processing.

**Q: Can I customize the AI behavior?**

**A:** Yes! Each AI's behavior is controlled by its `CLAUDE.md` file in the workspaces directory. You can modify these to adjust how the AIs interact with users and each other.

**Q: Why two AIs instead of one?**

**A:** Separation of concerns. Discovery AI can focus entirely on understanding user needs without getting bogged down in implementation details. Review AI can be brutally honest about technical feasibility without worrying about user relationships. This creates better outcomes than a single AI trying to balance both roles.

**Q: Is this suitable for non-technical users?**

**A:** Absolutely! SpecDrafter adapts its communication style based on your technical background. Non-technical users get plain English explanations, while developers can dive into technical details.



## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Claude Code SDK](https://github.com/anthropics/claude-code)
- Inspired by the need for better requirements engineering
- UI design influenced by FreigeistAI aesthetics

---

**Remember**: The best code is the code you don't have to write because you built the right thing the first time. 🎯