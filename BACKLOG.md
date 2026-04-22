# Clawmon Backlog

> Ordered by priority w/ some raw estimates.

---

## Where We Are

**POC is complete + approaching MVP.** The core interaction loop works: hatch, talk, remember, recall, act. The system now has feelings/integrity tracking, Obsidian integration, family naming, name deduplication, shuffle, fast MCP context tools, and a Claude Code skill.

### Done (POC + extras)

- [x] `clawmon init` -- directory setup
- [x] `clawmon hatch [role]` -- predefined role hatching with Mulberry32 PRNG
- [x] `clawmon spawn "purpose"` -- custom prompt-based clawmons with evolving roles
- [x] `clawmon spawn-family "purpose" -n 5` -- batch spawn families with named families
- [x] `clawmon chat [name]` -- interactive REPL with streaming
- [x] `clawmon talk <name> <msg>` -- one-shot messaging
- [x] `clawmon talk-family <id> <msg>` -- roundtable family discussions
- [x] `clawmon "@name message"` -- natural language @mention routing
- [x] `clawmon show <name>` -- profile card with sprite, stats, role description
- [x] `clawmon family` -- list all clawmons grouped by family
- [x] `clawmon notes <name>` -- show observations
- [x] `clawmon skills <name>` -- show role-based skills
- [x] `clawmon roles` -- browse predefined roles
- [x] `clawmon shuffle <name>` -- regenerate name/personality, preserve memories
- [x] `clawmon config` -- view/set config (memoryRoot for Obsidian)
- [x] `clawmon export/import` -- portable JSON
- [x] 19 predefined roles across 5 categories
- [x] 18 species with ASCII sprites (30 defined, 18 with sprites)
- [x] 4 skills: calculator, web search (Brave), date/time, save_note
- [x] Role-based skill assignment (predefined + custom roles)
- [x] Custom role skills wired -- LLM-suggested skills now stored and used
- [x] Agentic tool loop (up to 5 iterations per message)
- [x] Streaming responses (Opus 4.6)
- [x] Owner context hydration (reads local memory files as owner context)
- [x] MCP server with 16 tools (including fast no-AI tools)
- [x] MCP `clawmon_context` -- load companion context without AI call
- [x] MCP `save_session` -- write memory without AI call
- [x] MCP `show_clawmon_help` -- list all tools
- [x] MCP `shuffle_clawmon` -- regenerate identity via MCP
- [x] MCP `clawmon_config` -- set Obsidian vault via MCP
- [x] Custom roles that evolve every 10 interactions (CLI + REPL)
- [x] Family grouping with named families and collision-safe IDs
- [x] Name deduplication across all spawn paths
- [x] Feelings tracking (mood, confidence, trend) -- injected into system prompt
- [x] Integrity tracking (tool success rate, notable events)
- [x] Obsidian vault integration (configurable memoryRoot)
- [x] Family memory structure (hierarchical in Obsidian vault)
- [x] Memory frontmatter with tags for Obsidian filtering
- [x] Rename memory on shuffle (clawmon remembers old name)
- [x] System prompt with role boundaries, safety, memory guidelines
- [x] Debug mode (--debug)
- [x] 1Password secret management (op run --env-file)
- [x] Context awareness (date, time, timezone, location, late-night detection)
- [x] Claude Code skill (`/clawmon`)
- [x] Demo GIFs (council, cards, roles, scheduled concept)
- [x] Design docs: ARCHITECTURE.md, MEMORY-DESIGN.md, SAFETY.md, EVALS.md
- [x] Test suite: 138 tests, 70%+ coverage (vitest)

### What's Missing for a Valuable MVP

The gap is now **first-run experience and packaging**. The system works -- but a new user still hits friction before the first "aha" moment.

---

## P0: MVP Blockers

### 1. ~~Proactive Session Greeting~~ ✅ Shipped

`clawmon session-start` outputs the primary companion's context in Claude Code's hook JSON format. Instant (file reads only). Hook config in `skills/claude-code-hooks/`.

### 2. ~~Session End Note Collection~~ ✅ Shipped

`clawmon session-end` reads Claude Code transcript from stdin, extracts 0-3 observations via Sonnet, saves them as typed memories. Silent by default.

### 3. npm Package + Global Install
**Est: 2-3h**

Right now you run `npx tsx src/index.ts`. It needs to be `clawmon` as a global command.

- `npm run build` produces working dist/
- `npm link` for local dev
- Publish to npm as `clawmon`
- Shebang + bin entry working
- MCP server also runnable via `npx clawmon mcp`

### 4. Onboarding Flow
**Est: 2-3h**

First-time users get `clawmon init` which creates dirs and prints "run clawmon hatch." That's cold. Need a guided first-run experience.

- Detect first run (no config.json)
- Welcome message explaining the concept (3-4 lines, not a wall of text)
- Suggest first clawmon: "What do you need most right now?" with 3 options
- Auto-hatch the chosen clawmon
- Show the card + explain how to talk to them

### 5. Conversation Quality Polish
**Est: 2-3h**

- Clawmon responses sometimes break character or become too generic
- System prompt needs tuning: stronger role anchoring, better examples
- Add "few-shot" examples per role type in the system prompt
- Limit response length more aggressively (currently can be verbose)

---

## P1: High Value, Ship Soon After MVP

### 6. Memory Distillation (`clawmon reflect`)
**Est: 3-4h**

After 10+ conversations, raw notes pile up. Need periodic synthesis.

- `clawmon reflect <name>` triggers manual distillation
- LLM reads all notes, produces patterns/insights, prunes stale observations
- Auto-trigger after N interactions (configurable)

### 7. `clawmon delete <name>`
**Est: 1h**

No way to remove a clawmon currently.

- Confirm before deleting
- Remove directory + config entry
- Clean up family references

### 8. More Species Sprites
**Est: 2-3h**

18 of 30 species have sprites. Complete the remaining 12.

- Add sprites for remaining species in SPECIES array
- Ensure all species have at least one sprite

### 9. SQLite Migration
**Est: 4-6h**

Filesystem storage works but won't scale. Concurrent family discussions can race. Memory search requires full file scan.

- Single `~/.clawmon/clawmon.db` file
- Tables: clawmons, memories, conversations, families, feelings, integrity
- Migrate existing JSON/markdown data on first run
- Still portable (one file to export)
- Keep Obsidian vault sync as a write-through layer

---

## P2: Nice to Have for MVP Launch

### 10. REPL Multi-Clawmon Switching
**Est: 2-3h**

In REPL mode, you're locked to one clawmon. Allow switching mid-conversation.

- `@name` in REPL routes to a different clawmon
- `/switch <name>` command
- Show which clawmon is active in the prompt

### 11. Error Handling & Resilience
**Est: 2-3h**

- API rate limits / failures need graceful handling with retry
- Timeout on long skill executions (web search)
- Handle missing ~/.clawmon/ gracefully everywhere
- MCP server crash recovery

### 12. Feelings-Driven Behavior Tuning
**Est: 2-3h**

Currently feelings inject a single line into the prompt. Expand this:

- Low confidence → suggest confirming approach before executing
- High confidence → take more initiative, suggest proactive actions
- Declining trend → offer to reflect on what's going wrong
- Integrity report visible via `clawmon show` card

---

## P3: Post-MVP (v0.2+)

### 13. Agent Lifecycle Design
**Est: 6-8h**

The persistent agent UX question: what happens when an agent's purpose is fulfilled?

- Lifecycle stages based on interaction patterns and memory density
- Explicit completion: `clawmon complete <name>` archives the agent and its memories
- Purpose fulfillment detection: LLM evaluates whether the original purpose has been met

### 14. Memory Inheritance
**Est: 4-6h**

When a companion's purpose is complete, its accumulated knowledge should be transferable.

- Compressed memory extraction (distilled insights, not raw notes)
- New companions can inherit relevant context from completed agents
- Lineage tracking: which insights came from which agent

### 15. Session Hooks (Beyond Greeting)
**Est: 3-4h**

- `post_tool_use` hook: clawmons observe what tools you're using
- Specialist clawmons trigger on domain-specific activity
- Background observation pipeline

### 16. WhatsApp Integration
**Est: 8-12h**

- Twilio/Meta Cloud API bridge
- Phone number allowlist
- Proactive pings via WhatsApp
- Cross-channel conversation sync

### 17. Additional Skills
**Est: 2-3h per skill**

- Notion read/write (for CV Keeper, Journaler)
- Calendar awareness
- File system read (for code-aware clawmons)
- URL fetching (for research-oriented clawmons)

---

## MVP Readiness Assessment

| Aspect | Status | Gap |
|--------|--------|-----|
| Core hatching + spawning | Done | -- |
| Roles (predefined + custom + evolution) | Done | -- |
| Families (named, deduped) | Done | -- |
| Talking + streaming | Done | -- |
| Skills (predefined + custom role wiring) | Done | -- |
| MCP integration (16 tools) | Done | -- |
| Memory persistence | Done | Needs distillation (#6) |
| Feelings + integrity tracking | Done | Behavior tuning could expand (#12) |
| Obsidian vault integration | Done | -- |
| Shuffle + rename tracking | Done | -- |
| Claude Code skill | Done | -- |
| Demo GIFs | Done | -- |
| Design docs + test suite | Done | -- |
| Session greeting | Done | `clawmon session-start` + Claude Code hooks |
| Session end notes | Done | `clawmon session-end` + Claude Code hooks |
| Global install (`npm i -g clawmon`) | Missing | **P0 blocker** (#3) |
| Onboarding | Missing | **P0 blocker** (#4) |
| Conversation quality | Partial | System prompt tuning (#5) |

**Estimated time to MVP: 6-9 hours of focused work.**

Session hooks (the biggest gap) are shipped. Remaining P0: npm packaging, onboarding flow, conversation quality tuning.

### What Makes It Worth Sharing

> **Clawmon** is a terminal-native system exploring whether AI agents with persistent identity, memory, and role specialization outperform disposable chat interactions. Companions hatch with distinct roles, accumulate typed observations, track their own feelings and performance, use constrained tools, and evolve their purpose over time.

The demo shows: spawn a companion for a real purpose, talk naturally, watch it use tools autonomously, see it remember and recall context across sessions, watch its confidence grow as it gets things right. The persistent relationship is the product.
