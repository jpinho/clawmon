# Clawmon Backlog

> Ordered by priority w/ some raw estimates.

---

## Where We Are

**POC is complete + almost MVP ready.** So far, we have way more than the POC scope -- custom roles, families, skills, MCP integration, streaming, REPL, and Claude memory hydration are all working.

### Done (POC + extras)

- [x] `clawmon init` -- directory setup
- [x] `clawmon hatch [role]` -- predefined role hatching with Mulberry32 PRNG
- [x] `clawmon spawn "purpose"` -- custom prompt-based clawmons with evolving roles
- [x] `clawmon spawn-family "purpose" -n 5` -- batch spawn families
- [x] `clawmon chat [name]` -- interactive REPL with streaming
- [x] `clawmon talk <name> <msg>` -- one-shot messaging
- [x] `clawmon talk-family <id> <msg>` -- roundtable family discussions
- [x] `clawmon "@name message"` -- natural language @mention routing
- [x] `clawmon show <name>` -- profile card with sprite and stat bars
- [x] `clawmon family` -- list all clawmons grouped by family
- [x] `clawmon notes <name>` -- show observations
- [x] `clawmon skills <name>` -- show role-based skills
- [x] `clawmon roles` -- browse predefined roles
- [x] `clawmon export/import` -- portable JSON
- [x] 19 predefined roles across 5 categories
- [x] 18 species with ASCII sprites
- [x] 4 skills: calculator, web search (Brave), date/time, save_note
- [x] Role-based skill assignment
- [x] Agentic tool loop (up to 5 iterations per message)
- [x] Streaming responses (Opus 4.6)
- [x] Owner context hydration (reads local memory files as owner context)
- [x] MCP server with 10 tools
- [x] Custom roles that evolve every 10 interactions
- [x] Family grouping with collective addressing
- [x] Debug mode (--debug)
- [x] 1Password secret management (op run --env-file)
- [x] Context awareness (date, time, timezone, location, late-night detection)

### What's Missing for a Valuable MVP

The gap between "working POC" and "something worth demoing and sharing" is **polish, reliability, and the 'aha' moment**. Users need to feel the companion is alive, not just a chatbot with a name.

---

## P0: MVP Blockers

### 1. Proactive Session Greeting
**Est: 3-4h** | The single most important missing feature

When you start a terminal session, your active clawmons should greet you unprompted. The Best Friend says "Morning! You were up late last night." The Financial Advisor says "Your savings goal is 74% on track." This is what makes them feel alive.

- Session hook: `session_start` triggers greeting from active clawmons
- Each clawmon's greeting is informed by their role + recent memories
- Configurable: which clawmons greet on start, which stay quiet
- Register hook in settings.json or via `claude` CLI

### 2. Session End Note Collection
**Est: 2-3h**

When a terminal session ends, clawmons should scan what happened and save relevant observations. The Career Coach notes "Owner worked on infrastructure all day." The Sleep Guardian notes "Session ended at 1:30 AM."

- Session hook: `session_end` triggers note collection
- Each active clawmon runs a brief observation extraction
- Notes saved to their memory partition

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

### 5. Fix: Custom Roles Need Skills
**Est: 1h**

Custom-spawned clawmons always get default skills (save_note + date_time). The LLM suggests skills but they're not wired -- the registry only maps predefined role IDs to skills.

- Read skills from `customRole` data and pass to registry
- Fallback to default if LLM suggests unknown skills

### 6. Conversation Quality Polish
**Est: 2-3h**

- Clawmon responses sometimes break character or become too generic
- System prompt needs tuning: stronger role anchoring, better examples
- Add "few-shot" examples per role type in the system prompt
- Limit response length more aggressively (currently can be verbose)

---

## P1: High Value, Ship Soon After MVP

### 7. SQLite Migration
**Est: 4-6h**

Filesystem storage works but won't scale. Concurrent family discussions can race. Memory search requires full file scan.

- Single `~/.clawmon/clawmon.db` file
- Tables: clawmons, memories, conversations, families
- Migrate existing JSON/markdown data on first run
- Still portable (one file to export)

### 8. Memory Distillation (`clawmon reflect`)
**Est: 3-4h**

After 10+ conversations, raw notes pile up. Need periodic synthesis.

- `clawmon reflect <name>` triggers manual distillation
- LLM reads all notes, produces patterns/insights, prunes stale observations
- Auto-trigger after N interactions (configurable)

### 9. More Species Sprites
**Est: 2-3h**

18 of 30 species have sprites. Complete the remaining 12.

- Add sprites for: deplorix, kubrik, hashling, querrix, pyroclaw, tideling, galecrest, terravox, voidling, paradawn, infinik, levianthan, mythora
- Ensure all species in SPECIES array have at least one sprite

### 10. `clawmon rename <name> <new-name>`
**Est: 1h**

Users should be able to rename their clawmons.

- Update soul.name, rename directory, update config

### 11. `clawmon delete <name>`
**Est: 1h**

No way to remove a clawmon currently.

- Confirm before deleting
- Remove directory + config entry

---

## P2: Nice to Have for MVP Launch

### 12. Hatching Animation Polish
**Est: 2h**

The egg-cracking animation is basic (3 lines of text). Make it feel more ceremonial.

- Progressive egg cracking with delays
- Sprite reveal with color fade-in
- Sound effect cues (terminal bell or description)

### 13. REPL Multi-Clawmon Switching
**Est: 2-3h**

In REPL mode, you're locked to one clawmon. Allow switching mid-conversation.

- `@name` in REPL routes to a different clawmon
- `/switch <name>` command
- Show which clawmon is active in the prompt

### 14. Error Handling & Resilience
**Est: 2-3h**

- API rate limits / failures need graceful handling with retry
- Timeout on long skill executions (web search)
- Handle missing ~/.clawmon/ gracefully everywhere
- MCP server crash recovery

### 15. README: Add GIF/Screenshot
**Est: 1-2h**

The README needs a visual demo. Record a terminal GIF showing:
- Hatching ceremony
- Talking to a clawmon (streaming)
- Clawmon using skills
- Show card

---

## P3: Post-MVP (v0.2+)

### 16. Agent Lifecycle Design
**Est: 6-8h**

The persistent agent UX question: what happens when an agent's purpose is fulfilled? A companion spawned for "help me through a breakup" should not persist indefinitely after the user has moved on.

- Lifecycle stages based on interaction patterns and memory density
- Explicit completion: `clawmon complete <name>` archives the agent and its memories
- Purpose fulfillment detection: LLM evaluates whether the original purpose has been met

### 17. Memory Inheritance
**Est: 4-6h**

When a companion's purpose is complete, its accumulated knowledge should be transferable.

- Compressed memory extraction (distilled insights, not raw notes)
- New companions can inherit relevant context from completed agents
- Lineage tracking: which insights came from which agent

### 18. Session Hooks (Beyond Greeting)
**Est: 3-4h**

- `post_tool_use` hook: clawmons observe what tools you're using
- Specialist clawmons trigger on domain-specific activity
- Background observation pipeline

### 19. WhatsApp Integration
**Est: 8-12h**

- Twilio/Meta Cloud API bridge
- Phone number allowlist
- Proactive pings via WhatsApp
- Cross-channel conversation sync

### 20. Additional Skills
**Est: 2-3h per skill**

- Notion read/write (for CV Keeper, Journaler)
- Calendar awareness
- File system read (for code-aware clawmons)
- URL fetching (for research-oriented clawmons)

---

## MVP Readiness Assessment

| Aspect | Status | Gap |
|--------|--------|-----|
| Core hatching | Done | -- |
| Roles (predefined + custom) | Done | -- |
| Families | Done | -- |
| Talking + streaming | Done | -- |
| Skills (calculator, search, date, notes) | Done | Custom roles need wiring (#5) |
| MCP integration | Done | -- |
| Memory persistence | Done | Needs distillation (#8) |
| Session greeting | Missing | **P0 blocker** (#1) |
| Session end notes | Missing | **P0 blocker** (#2) |
| Global install (`npm i -g clawmon`) | Missing | **P0 blocker** (#3) |
| Onboarding | Missing | **P0 blocker** (#4) |
| Polish | Partial | System prompt tuning (#6) |
| Visuals for README | Missing | GIF/screenshot (#15) |

**Estimated time to MVP: 15-20 hours of focused work.**

The 6 P0 items total ~14h. With the README GIF (#15) that's ~16h. A focused weekend sprint gets us there.

### What Makes It Worth Sharing

The hook is not "another AI CLI tool." The hook is:

> **Clawmon** is a terminal-native system exploring whether AI agents with persistent identity, memory, and role specialization outperform disposable chat interactions. Companions hatch with distinct roles, accumulate typed observations, use constrained tools, and evolve their purpose over time.

The demo shows: spawn a companion for a real purpose, talk naturally, watch it use tools autonomously, see it remember and recall context across sessions. The persistent relationship is the product.
