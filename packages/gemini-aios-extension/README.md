# AIOX Gemini CLI Extension

Brings Synkra AIOX multi-agent orchestration to Gemini CLI.

## Installation

```bash
gemini extensions install github.com/synkra/aiox-core/packages/gemini-aios-extension
```

Or manually copy to `~/.gemini/extensions/aios/`

## Features

### Agents
Access all AIOX agents via `@agent-name`:
- `@dev` - Developer (Dex)
- `@architect` - Architect (Aria)
- `@qa` - QA Engineer (Quinn)
- `@pm` - Product Manager (Morgan)
- `@devops` - DevOps (Gage)
- And more...

### Commands
- `/aios-status` - Show system status
- `/aios-agents` - List available agents
- `/aios-validate` - Validate installation

### Hooks
Automatic integration with AIOX memory and security:
- Session context loading
- Gotchas and patterns injection
- Security validation (blocks secrets)
- Audit logging

## Requirements

- Gemini CLI v0.26.0+
- AIOX Core installed (`npx aiox-core install`)
- Node.js 18+

## Cross-CLI Compatibility

AIOX skills work identically in both Claude Code and Gemini CLI. Same agents, same commands, same format.

## License

MIT
