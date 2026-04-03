# Clawmon

CLI companion ecosystem -- AI buddies with roles, skills, and memory that live in your terminal.

## Project Structure

```
src/
├── cli.ts              # CLI entry point + natural language router + REPL
├── index.ts            # Re-export of cli.ts
├── types.ts            # Core types: ClawmonBones, ClawmonSoul, Clawmon, stats, 30 species
├── hatch.ts            # Hatching: Mulberry32 PRNG, role suggestions, ceremony
├── talk.ts             # Conversation: streaming output, REPL loop, skill activity display
├── show.ts             # Card display (sprite, stats, role, notes)
├── roles.ts            # 19 role definitions across 5 categories with trigger/cadence/voice
├── api.ts              # Claude API: soul gen (Sonnet) + streaming agentic chat (Opus 4.6)
├── debug.ts            # --debug flag support
├── context.ts          # Owner context (date, time, TZ-derived location, late-night/weekend)
├── memory/
│   └── store.ts        # File-based storage: clawmon CRUD, memory, conversations, export/import
├── sprites/
│   └── render.ts       # ASCII sprite renderer (18 species, hats, eyes)
├── skills/
│   ├── types.ts        # Skill interface
│   ├── registry.ts     # Role-based skill assignment (maps roles to skill sets)
│   ├── calculator.ts   # Math expressions (safe eval)
│   ├── web-search.ts   # Brave Search API
│   ├── date-time.ts    # Date/time calculations
│   └── note-taker.ts   # Save observations to clawmon memory
├── mcp/
│   └── server.ts       # MCP server: 5 tools for Claude Code integration
bin/
└── clawmon-mcp.sh      # MCP launcher with 1Password secret injection
```

## Running

```bash
# Load secrets + run (preferred)
op run --env-file .env.op --account SVS64DAWHJFZRHZEWRLJVT6W5Q -- npx tsx src/index.ts <command>

# Commands
npx tsx src/index.ts hatch                      # see role suggestions
npx tsx src/index.ts hatch financial-advisor     # hatch with role
npx tsx src/index.ts "@penny how's my budget?"  # one-shot @mention
npx tsx src/index.ts chat penny                 # interactive REPL
npx tsx src/index.ts council                    # list your council
npx tsx src/index.ts --debug <any command>      # verbose debug output
```

## Key Patterns

- **Mulberry32 PRNG** for deterministic hatching (same as Claude Code's buddy system)
- **Role-first hatching** -- you pick a role, creature is generated for it. No roleless clawmons.
- **Natural language routing** -- non-command input treated as message, `@name` routes to specific clawmon
- **Streaming** -- Opus 4.6 responses stream token-by-token. Skill activity shows in real-time.
- **Agentic tool loop** -- clawmon decides which skills to use (calculator, web search, date/time, save_note), up to 5 iterations
- **REPL mode** -- `chat` command opens interactive back-and-forth with history preserved in-session
- **File-based storage** at `~/.clawmon/` -- markdown with YAML frontmatter for memories, JSON for state
- **MCP server** -- 5 tools (talk_to_clawmon, show_clawmon, council, clawmon_notes, clawmon_skills) exposed via stdio

## Models

- **Chat**: `claude-opus-4-6` -- smart, streams responses
- **Soul generation**: `claude-sonnet-4-20250514` -- fast, cheap, just needs JSON

## Secrets

Managed via 1Password CLI (`op run --env-file`). Never use local .env files with plaintext secrets.

- `.env.op` -- contains `op://` secret references, safe to commit
- `bin/clawmon-mcp.sh` -- wraps MCP server launch with `op run`
- 1Password account: `SVS64DAWHJFZRHZEWRLJVT6W5Q`
- Required keys: `ANTHROPIC_API_KEY`, `BRAVE_API_KEY`

## Design Docs

Full design docs in `private-docs/` (gitignored):
- ARCHITECTURE.md, ROLES.md, SPECIES.md, CLI.md, MEMORY-SYSTEM.md
- CHANNELS.md (WhatsApp), VISION.md (long-term phases), ROADMAP.md
- USE-CASES.md (CV Keeper, Budget Owl, etc.), RESEARCH.md (Claude Code source analysis)

## Current Phase: POC

README and public docs only reflect what's shipped. Vision stays in private-docs.
Next: lifecycle (evolution, rebirth), more species sprites, Claude Code hooks.
