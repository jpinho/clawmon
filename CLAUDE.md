# Clawmon

Terminal-native persistent agent UX system -- identity, memory, role specialization, and tool-mediated collaboration.

## Project Structure

```
src/
├── cli.ts              # CLI entry point + natural language router + REPL
├── index.ts            # Re-export of cli.ts
├── types.ts            # Core types: ClawmonBones, ClawmonSoul, Clawmon, stats, 30 species (18 with sprites)
├── hatch.ts            # Hatching: Mulberry32 PRNG, role suggestions, ceremony
├── talk.ts             # Conversation: streaming output, REPL loop, skill activity display
├── show.ts             # Card display (sprite, stats, role, notes)
├── roles.ts            # 19 role definitions across 5 categories with trigger/cadence/voice
├── api.ts              # Claude API: soul gen (Sonnet) + streaming agentic chat (Opus 4.6)
├── debug.ts            # --debug flag support
├── context.ts          # Owner context (date, time, TZ-derived location, late-night/weekend)
├── claude-context.ts   # Reads ~/.claude/ memory files for owner context enrichment
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
│   └── server.ts       # MCP server: 10 tools via stdio transport
bin/
└── clawmon-mcp.sh      # MCP launcher with 1Password secret injection
```

## Running

```bash
# Load secrets + run (preferred)
op run --env-file .env.op --account <your-op-account-id> -- npx tsx src/index.ts <command>

# Commands
npx tsx src/index.ts hatch                      # see role suggestions
npx tsx src/index.ts hatch financial-advisor     # hatch with role
npx tsx src/index.ts "@penny how's my budget?"  # one-shot @mention
npx tsx src/index.ts chat penny                 # interactive REPL
npx tsx src/index.ts family                     # list your family
npx tsx src/index.ts config                     # view/set config (memoryRoot for Obsidian)
npx tsx src/index.ts --debug <any command>      # verbose debug output
```

## Key Patterns

- **Mulberry32 PRNG** for deterministic hatching from user ID
- **Role-first hatching** -- you pick a role, creature is generated for it. No roleless clawmons.
- **Natural language routing** -- non-command input treated as message, `@name` routes to specific clawmon
- **Streaming** -- Opus 4.6 responses stream token-by-token via `messages.stream()`. Skill activity shows in real-time.
- **Agentic tool loop** -- clawmon decides which skills to use (calculator, web search, date/time, save_note), up to 5 iterations
- **REPL mode** -- `chat` command opens interactive back-and-forth with history preserved in-session
- **File-based storage** at `~/.clawmon/` -- markdown with YAML frontmatter for memories, JSON for state
- **MCP server** -- 13 tools via stdio. Key fast tools: `clawmon_context` (load companion context, no API), `save_session` (write memory, no API), `clawmon_config` (set Obsidian vault). Full list: talk_to_clawmon, show_clawmon, family, clawmon_notes, clawmon_skills, clawmon_context, save_session, clawmon_config, hatch, spawn, spawn_family, talk_to_family, clawmon_export

## Models

- **Chat**: `claude-opus-4-6` -- streams via `messages.stream()`
- **Soul generation**: `claude-sonnet-4-20250514` -- fast, cheap, just needs JSON

## Testing

- `npm test` -- vitest, 70%+ line coverage
- Tests are co-located: `hatch.test.ts` next to `hatch.ts`, not in `__tests__/`
- `api.test.ts` mocks `@anthropic-ai/sdk` (both `messages.create` and `messages.stream`)
- `store.test.ts` mocks `homedir()` to use a temp dir -- never touches real `~/.clawmon/`
- `NODE_NO_WARNINGS=1` suppresses punycode deprecation from SDK

## Public Design Docs

- `ARCHITECTURE.md` -- module graph, data model, data flows
- `MEMORY-DESIGN.md` -- storage, retrieval, decay, open questions
- `SAFETY.md` -- behavior boundaries, refusal, memory constraints
- `EVALS.md` -- eval framework (designed, not yet implemented)

Each doc has an Implementation Status table showing what's built vs planned.

## Demo GIFs

- `demo/*.gif` -- committed, referenced by README
- `demo/*.tape` and `demo/*.sh` -- gitignored (VHS source files)
- Regenerate: `vhs demo/demo-council.tape` (requires `brew install vhs`)
- Mock script for concept demos: `demo/mock-scheduled.sh`

## Secrets

Managed via 1Password CLI (`op run --env-file`). Never use local .env files with plaintext secrets. Never commit 1Password account IDs or real secret values.

- `.env.op` -- contains `op://` secret references, safe to commit
- `bin/clawmon-mcp.sh` -- wraps MCP server launch with `op run`
- Required keys: `ANTHROPIC_API_KEY`, `BRAVE_API_KEY`

## Gotchas

- `api.ts` uses `messages.stream()` not `messages.create()` for chat -- mock both in tests
- System prompt is large (~2KB) with safety/memory/role boundary instructions -- read `buildSystemPrompt()` before modifying
- Clawmon IDs derive from LLM-generated names -- collision-safe with timestamp suffix (see `hatch.ts`)
- `console.log` is monkey-patched in MCP hatch handler to suppress ceremony output on stdio transport

## Private Design Docs

Private design docs in `private-docs/` (gitignored):
- ARCHITECTURE.md, ROLES.md, SPECIES.md, CLI.md, MEMORY-SYSTEM.md
- CHANNELS.md (WhatsApp), VISION.md (long-term phases), ROADMAP.md
- USE-CASES.md (CV Keeper, Budget Owl, etc.), RESEARCH.md (prior art analysis)

## Current Phase: POC

Framing: persistent agent UX research, "cute terminal pets" are the surface layer (to keep it fun #funmatters).
Next: memory compression, relevance-filtered retrieval, proactive schedules, eval baseline.
