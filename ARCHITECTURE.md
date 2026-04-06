# Architecture

## System Overview

Clawmon is a CLI companion ecosystem where AI creatures live in your terminal. It has two entry points:

- **CLI** (`src/cli.ts`) -- interactive commands, natural language routing, REPL chat
- **MCP Server** (`src/mcp/server.ts`) -- exposes clawmon tools to any MCP-compatible host (e.g. Claude Code)

Both entry points share the same core modules: API, memory, roles, skills, and sprites.

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│                    Entry Points                     │
│                                                     │
│   cli.ts ────────────────  mcp/server.ts            │
│     │                          │                    │
│     ├── hatch.ts               │                    │
│     ├── talk.ts                │                    │
│     └── show.ts                │                    │
└─────────┬──────────────────────┤────────────────────┘
          │                      │
┌─────────▼──────────────────────▼────────────────────┐
│                   Core Layer                        │
│                                                     │
│   api.ts ◄──── skills/registry.ts ◄── skills/*.ts   │
│     │                │                              │
│     ▼                ▼                              │
│   roles.ts       types.ts                           │
│     │                │                              │
│     ▼                ▼                              │
│   context.ts     sprites/render.ts                  │
│                                                     │
└─────────┬───────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────┐
│                 Storage Layer                        │
│                                                     │
│   memory/store.ts                                   │
│     ~/.clawmon/                                     │
│       ├── config.json                               │
│       └── clawmons/<id>/                            │
│             ├── clawmon.json                         │
│             ├── memory/*.md                          │
│             └── conversations/*.json                 │
└─────────────────────────────────────────────────────┘
```

## Data Model

### ClawmonBones (deterministic, from PRNG)

Rolled at hatch time using Mulberry32 PRNG seeded from `userId + salt + index`. Fully deterministic -- same user always gets the same creature for a given slot.

```
ClawmonBones {
  species    → one of 30 species across 5 categories
  rarity     → common (50%) | uncommon (25%) | rare (15%) | epic (8%) | legendary (2%)
  eye        → one of 6 eye characters
  hat        → none (common) or one of 6 hats (uncommon+)
  shiny      → 1% chance boolean
  stats      → 5 stats (INSIGHT, CREATIVITY, FOCUS, EMPATHY, WIT) in 1-100 range
}
```

Stats have a peak stat (boosted) and a dump stat (lowered), with rarity raising the floor.

### ClawmonSoul (LLM-generated)

Generated once at hatch via Claude Sonnet. Not deterministic -- different each time.

```
ClawmonSoul {
  name         → short, memorable (3-8 chars)
  personality  → one sentence
  catchphrase  → greeting that hints at role
  voice        → how they communicate
}
```

### Clawmon (full entity)

```
Clawmon {
  id           → lowercase name, used as directory name
  bones        → ClawmonBones
  soul         → ClawmonSoul
  roleId       → references a Role from the registry
  customRole?  → for prompt-spawned clawmons with evolving roles
  familyId?    → groups clawmons spawned together
  hatchedAt    → ISO date
  interactions → counter
}
```

### MemoryEntry

```
MemoryEntry {
  name        → title
  description → one-line summary
  type        → observation | pattern | preference | fact | goal | insight
  content     → full text
  createdAt   → ISO date
  updatedAt   → ISO date
}
```

## Data Flow: Talking to a Clawmon

```
User input
  │
  ▼
CLI routing (cli.ts)
  │  parses @mentions, routes to clawmon
  │
  ▼
talkToClawmon (talk.ts)
  │  loads memories + conversation history from disk
  │
  ▼
chat() (api.ts)
  │  builds system prompt from: soul, role, context, memories, skills
  │  sends to Claude API with tool definitions
  │
  ▼
Agentic tool loop (up to 5 iterations)
  │  model calls tools → skills execute → results fed back
  │  save_note writes to memory/store.ts
  │  calculator, web_search, date_time return data
  │
  ▼
Final text response
  │
  ▼
talk.ts displays response + saves conversation to disk
```

## Hatching Flow

```
User: clawmon hatch financial-advisor
  │
  ▼
Validate role exists (roles.ts)
  │
  ▼
rollBones(userId, index) → deterministic ClawmonBones
  │  Mulberry32 PRNG from hashString(userId + salt + index)
  │  rolls: species, rarity, eye, hat, shiny, stats
  │
  ▼
generateSoul(bones, role) → ClawmonSoul via Claude Sonnet
  │  fallback to NICKNAME_POOL if API unavailable
  │
  ▼
saveClawmon() → writes to ~/.clawmon/clawmons/<id>/clawmon.json
```

## Skill System

Skills are the clawmon's abilities -- tools in the Claude API sense. The system works in three layers:

1. **Skill definitions** (`skills/*.ts`) -- each skill implements the `Skill` interface with `name`, `description`, `inputSchema`, and `execute()`
2. **Registry** (`skills/registry.ts`) -- maps roles to skill sets. All clawmons get `save_note` + `date_time`. Role determines bonus skills (e.g. financial-advisor gets `calculator` + `web_search`)
3. **Agentic loop** (`api.ts`) -- passes skill definitions as tools to the Claude API. The model decides when to use them. Up to 5 iterations per message.

### Skill mapping

| Skill | Roles that get it |
|-------|------------------|
| save_note | all |
| date_time | all |
| calculator | financial-advisor, strategist, dream-tracker, chaos-agent |
| web_search | financial-advisor, career-coach, learning-guide, creative-muse, chaos-agent |

## Storage

All data lives in `~/.clawmon/` as plain files. No database.

```
~/.clawmon/
├── config.json                          # { version, userId, clawmons: [ids] }
└── clawmons/
    └── penny/
        ├── clawmon.json                 # full Clawmon object
        ├── memory/
        │   └── savings-goal.md          # YAML frontmatter + content
        └── conversations/
            └── 2026-04-03.json          # array of {role, content} messages
```

Memory files use Markdown with YAML frontmatter:

```markdown
---
name: Savings goal
description: Owner wants to save €5,000
type: goal
createdAt: 2026-04-03T10:00:00Z
updatedAt: 2026-04-03T10:00:00Z
---
Owner wants to save €5,000 by December 2026, requiring approximately €560 per month
```

Conversations are stored as JSON arrays of `{role, content}` objects, loaded as history context for the next message (last 10 messages).

## MCP Server

The MCP server (`src/mcp/server.ts`) exposes clawmon functionality over stdio transport using the Model Context Protocol SDK. Tools:

| Tool | What it does |
|------|-------------|
| `talk_to_clawmon` | Send a message, get a response (runs the full agentic loop) |
| `show_clawmon` | Get the profile card (sprite, stats, role) |
| `family` | List all clawmons |
| `clawmon_notes` | Read a clawmon's memory |
| `clawmon_skills` | List available skills |

The MCP path does not stream -- it returns the complete response as a single text block. This is a limitation of the MCP protocol (tools can't stream results).

## Sprite System

18 species have hand-crafted 5-line ASCII sprites defined in `sprites/render.ts`. Each sprite uses `{E}` placeholders replaced with the clawmon's eye character at render time.

Hats are applied by replacing the first line of the sprite (if blank) with the hat line. Species with non-blank first lines (like ashphoenix) don't render hats.

Compact face rendering (`renderFace`) produces inline emoji-like representations for list views (e.g. `=◉w◉=` for termikitty).

## Context System

`context.ts` provides environmental awareness without external APIs:

- Derives approximate location from the system timezone
- Detects late-night sessions (23:00–05:00) and weekends
- Formats context for the system prompt so clawmons are aware of when/where the owner is

## Custom Roles and Evolution

Beyond the 19 predefined roles, clawmons can be spawned with a free-text purpose (e.g. "support me going through a breakup"). The system:

1. Generates an initial role name + description via LLM
2. Stores evolution history in `CustomRole.evolution[]`
3. Roles can evolve as the user's needs change (e.g. "Breakup Support" → "Fresh Start Guide")

## Models

| Use case | Model | Why |
|----------|-------|-----|
| Chat (agentic loop) | claude-opus-4-6 | Highest quality for persistent agent interactions with tool use |
| Soul generation | claude-sonnet-4-20250514 | Fast, cheap, only needs to produce a small JSON object |
