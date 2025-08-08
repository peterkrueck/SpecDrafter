# SpecDrafter

[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE.md)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Claude SDK](https://img.shields.io/badge/Claude%20SDK-Latest-blue)](https://github.com/anthropics/claude-code)

An AI collaboration platform that helps technical specification writing through dual-Claude architecture, ensuring you build the right thing before you write a single line of code.

> **SpecDrafter** - Where two AI minds collaborate to transform your ideas into crystal-clear technical specifications.

## 🎯 Why SpecDrafter?

> *Ever spent weeks building a feature only to realize it wasn't what you actually needed?*

Building software without clear specifications is like constructing a house without blueprints. SpecDrafter ensures you build the right thing from the start.

### The Problem: AI Coding tools performs much better with clear specifications

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




<img width="3024" height="1890" alt="Screenshot 2025-08-08 at 21 34 16" src="https://github.com/user-attachments/assets/4660965b-df59-40b4-8a87-ea474822c244" />



<img width="3024" height="1890" alt="Screenshot 2025-08-08 at 21 06 15" src="https://github.com/user-attachments/assets/7d14a209-bfa7-4029-ad6f-f9669c9853d0" />



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


## Architecture

### Dual-Claude Intelligence System

```
┌─────────────────────────────── USER INTERFACE ───────────────────────────────┐
│                                                                              │
│  ┌─────────────────────┐                    ┌──────────────────────────────┐ │
│  │                     │                    │                              │ │
│  │    CHAT PANEL       │                    │   COLLABORATION PANEL        │ │
│  │                     │                    │                              │ │
│  │  User ←→ Discovery  │                    │  ┌────────────────────────┐  │ │
│  │                     │                    │  │  AI Dialogue Tab       │  │ │
│  │  - Natural language │                    │  │                        │  │ │
│  │  - Requirements     │                    │  │  Discovery ←→ Review   │  │ │
│  │  - Q&A flow         │                    │  │  Real-time dialogue    │  │ │
│  │                     │                    │  └────────────────────────┘  │ │
│  │                     │                    │  ┌────────────────────────┐  │ │
│  │  [Generate & Review │                    │  │  Specification Tab     │  │ │
│  │   Spec Button]      │                    │  │                        │  │ │
│  │                     │                    │  │  Live spec preview     │  │ │
│  │                     │                    │  │  Markdown → HTML       │  │ │
│  └──────────┬──────────┘                    │  └────────────────────────┘  │ │
│             │                               └──────────────────────────────┘ │
└─────────────┼────────────────────────────────────────────────────────────────┘
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
│ • Anti-over-engineering │                    │ • Architecture review   │
│ • Spec drafting         │                    │ • No user interaction   │
└────────────┬────────────┘                    └─────────────────────────┘
             │
             │ Final specification
             ▼
      ┌──────────────┐
      │ SPEC OUTPUT  │
      │              │
      │ specs/*/     │
      │  spec.md     │
      └──────────────┘
```



<img width="3024" height="1890" alt="Screenshot 2025-08-08 at 21 33 12" src="https://github.com/user-attachments/assets/d6d56a5b-ed18-4884-a1e7-e61c3c2dfc50" />



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

## Best Practices

1. **Don't Use Claude Code While Using SpecDrafter**: Avoid using Claude Code simultaneously as this can lead to context mixing
2. **Use Opus 4.1 Model**: Opus 4.1 is recommended as it follows instructions best
3. **Let Discovery AI Lead**: Don't jump straight to technical details
4. **Trust the Process**: The anti-over-engineering principle works
5. **Watch the Collaboration**: Understanding AI reasoning helps you make better decisions
6. **Iterate**: Use the Review AI's feedback to refine requirements
7. **Export Early**: Download specs as markdown for version control

## Frequently Asked Questions

### **Can I use SpecDrafter without Claude Code installed?**

> No. SpecDrafter is built with the Claude Code SDK which requires a locally installed Claude Code CLI. You must have Claude Code installed (`npm install -g @anthropic-ai/claude-code`) and connected to your Anthropic account with valid API credentials. The entire dual-AI architecture depends on the Claude Code SDK for managing the AI instances.

---

### **How is this different from just using Claude or ChatGPT?**

> SpecDrafter implements a dual-AI system where two specialized Claude instances collaborate. Discovery AI focuses on understanding your actual needs while Review AI ensures technical feasibility. You get the benefit of two expert perspectives working together, plus a structured specification process.

---

### **Can I use this with languages other than English?**

> Currently, SpecDrafter is optimized for English. The AI instructions and prompts are in English, though Claude can understand other languages.

---

### **What happens to my specifications?**

> All specifications are stored locally in your `specs/` directory. Nothing is sent to external servers except the Claude API calls for AI processing.

---

### **Can I customize the AI behavior?**

> Yes! Each AI's behavior is controlled by its `CLAUDE.md` file in the workspaces directory. You can modify these to adjust how the AIs interact with users and each other.

---

### **Why two AIs instead of one?**

> Separation of concerns. Discovery AI can focus entirely on understanding user needs without getting bogged down in implementation details. Review AI can be brutally honest about technical feasibility without worrying about user relationships. This creates better outcomes than a single AI trying to balance both roles.

---

### **Is this suitable for non-technical users?**

> Absolutely! SpecDrafter adapts its communication style based on your technical background. Non-technical users get plain English explanations, while developers can dive into technical details.

---

### **What about security? Can the Claude Code SDK access my files or execute system commands?**

> **No. SpecDrafter implements strict security sandboxing for both AI instances:**
>
> **File System Access:**
> - Both AIs can ONLY access the `specs/` directory in your project
> - No access to your home directory, system files, or other projects
> - Discovery AI can read/write specifications only
> - Review AI has read-only access (cannot modify any files)
>
> **Tool Restrictions:**
> - **No shell/bash access** - Neither AI can execute system commands
> - **No arbitrary code execution** - AIs cannot run scripts or programs
> - **Limited to safe operations**: File reading, web searches, and documentation lookups
> - Discovery AI cannot spawn sub-agents (no Task tool)
> - Review AI cannot modify files (no Write/Edit tools)
>
> **What Each AI Can Do:**
> - **Discovery AI**: Read/write specs, search web, fetch documentation
> - **Review AI**: Read specs only, analyze code, spawn analysis sub-agents
>
> This sandboxing is enforced through Claude Code's permission system (`.claude/settings.json` in each workspace), ensuring the AIs can help you create specifications without any risk to your system or other files. You can verify these restrictions yourself in the `backend/workspaces/` directory.

---

### **How can I contribute to SpecDrafter?**

> We welcome contributions in many ways:
> - **Code Contributions**: Submit PRs for bug fixes, features, or improvements
> - **Documentation**: Help improve docs, add examples, or translate content
> - **Testing & Feedback**: Use SpecDrafter and share your experience
> - **Report Issues**: Found a bug? Let us know!
> - **Feature Ideas**: Share your ideas for making SpecDrafter better
>
> Check the `Open_Issues/` folder to see documented challenges where we'd especially appreciate help. Each file contains detailed investigation notes that can help you understand the codebase better.



## License

Apache License 2.0 - see [LICENSE.md](LICENSE.md) for details.

## Acknowledgments

- Built with [Claude Code SDK](https://github.com/anthropics/claude-code)
- Inspired by the need for better requirements engineering
- UI design inspired by [Freigeist.dev](https://www.freigeist.dev) aesthetics

---

**Remember**: The best code is the code you don't have to write because you built the right thing the first time. 🎯

Feel free to contact me on LinkedIn: https://www.linkedin.com/in/peterkrueck/
