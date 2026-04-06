<div align="center">

# Clawmon

### Your life council. Hatch. Evolve. Rebirth.

![Clawmon Hero](assets/hero.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Hatch AI companions that live in your terminal. They have personalities, roles, skills, memories -- and they remember you across sessions.**

</div>

---

## What is Clawmon?

Clawmon is a companion ecosystem that lives in your terminal. You hatch companions, give them roles -- financial advisor, career coach, best friend, sleep guardian -- and they observe your life, collect notes, and speak up when they have something worth saying.

Each clawmon has a species, a personality, stats, and skills. A Financial Advisor can search the web for ETF prices and calculate compound interest. A Sleep Guardian notices your late-night sessions. A Best Friend just listens.

They're not chatbots. They're persistent creatures with memory, character, and purpose.

## Quick Start

```bash
cd ~/clawmon
op run --env-file .env.op --account <your-op-account> -- npx tsx src/index.ts hatch
```

No role specified? You'll see suggestions:

```
  Who do you need in your life?

  1) The Best Friend (Inner Circle)
     Knows your life, celebrates wins, listens when it's hard.
     "You mentioned feeling stuck yesterday. How'd the meeting go today?"

  2) The Financial Advisor (Growth Circle)
     Budgeting, spending patterns, saving goals.
     "Dining out 4 times this week -- that's about EUR 120. Want me to track it?"

  3) The Career Coach (Growth Circle)
     Tracks your professional growth and helps you level up.
     "You've been doing a lot of architecture work lately. Is that where you want your career heading?"

  To hatch, pick a role:
  clawmon hatch best-friend
  clawmon hatch financial-advisor
```

Pick a role and hatch:

```
  ~~ Clawmon Hatching Ceremony ~~
  Role: The Financial Advisor

     \^^^/
     .----.
    ( @  @ )
    (      )
     `----'

  Species: pyroclaw (epic)
  Name: Penny

  "Let's turn those coins into treasures!"

  What Penny will do for you:
  Tracks spending you mention, maintains a budget picture,
  nudges you toward your savings goals.
  Cadence: Daily

  [Penny has joined your council as: The Financial Advisor]
```

## Talk to Your Clawmon

Natural language with `@mentions`:

```bash
clawmon "@penny I want to save 5000 euros by december"
```

```
  Penny (busy): checking the time...
  Penny (busy): counting days until 2026-12-31...
  Penny (busy): calculating "Monthly savings needed"...
  Penny (busy): remembering "Savings goal: EUR 5,000 by December 2026"...

  (@@) Penny (The Financial Advisor)

  That's about EUR 560 per month. What's this nest egg for?
  Knowing the "why" helps keep the savings fire burning!
```

Penny autonomously checked the date, calculated the monthly target, and saved the goal to her memory -- all in character.

## Interactive Chat (REPL)

Stay in a conversation instead of one-shot messages:

```bash
clawmon chat penny
```

```
  (@@) Penny (The Financial Advisor)
  "Let's turn those coins into treasures!"
  Type your message. Ctrl+C to exit.

  you > how's my savings goal?
  (@@) Penny
  You're aiming for EUR 5,000 by December...

  you > what about ETFs?
  Penny (busy): searching for "best ETFs Germany 2026"...
  (@@) Penny
  German investors often gravitate toward MSCI World trackers...

  you > /notes
  Penny's Notes (2)
  [goal] Savings goal: EUR 5,000 by December 2026
  [preference] Owner prefers direct financial advice

  you > /exit
```

## Skills

Clawmons have skills based on their role. A Financial Advisor gets different tools than a Best Friend.

```bash
clawmon skills penny
```

```
  Penny's Skills
  Role: The Financial Advisor

  calculator    -- math, budgets, compound interest
  web_search    -- current prices, rates, comparisons (via Brave API)
  date_time     -- date calculations, deadline tracking
  save_note     -- remember important things about you
```

The clawmon decides when to use skills -- you just talk naturally.

## Commands

```bash
# Hatching
clawmon hatch                           # see role suggestions
clawmon hatch financial-advisor         # hatch with a specific role
clawmon roles                           # list all 19 available roles

# Talking
clawmon "@penny how's my budget?"       # one-shot with @mention
clawmon "hey, how are you?"             # routes to first clawmon
clawmon chat penny                      # interactive REPL
clawmon talk penny "quick question"     # explicit one-shot

# Viewing
clawmon council                         # see all your clawmons
clawmon show penny                      # full card with sprite and stats
clawmon notes penny                     # see collected observations
clawmon skills penny                    # see available skills

# Portability
clawmon export penny                    # export to JSON
clawmon import penny.json               # import from JSON

# Debug
clawmon --debug "@penny hello"          # verbose output for troubleshooting
```

## MCP Integration

Clawmon runs as an MCP server. Talk to your clawmons directly in any MCP-compatible host:

> "Talk to Penny about my budget"
> "Show me Penny's card"
> "What has Penny noticed about me?"
> "Show my council"

Setup:

```bash
claude mcp add clawmon -- bash ~/clawmon/bin/clawmon-mcp.sh
```

## Roles

19 roles across 5 categories. Each shapes the clawmon's personality, skills, and what it pays attention to.

| Circle | Roles |
|--------|-------|
| **Inner Circle** | best-friend, organizer, cheerleader, memory-keeper, mirror |
| **Growth** | career-coach, financial-advisor, fitness-buddy, creative-muse, learning-guide |
| **Reflection** | journaler, relationship-coach, strategist, dream-tracker |
| **Life Skills** | sleep-guardian, social-connector |
| **Wild Cards** | philosopher, chaos-agent, companion |

## Secrets

Clawmon needs two API keys. No plaintext `.env` files -- use your preferred secret manager.

**Required keys:**
- `ANTHROPIC_API_KEY` -- Claude API (Opus 4.6 for chat, Sonnet for soul generation)
- `BRAVE_API_KEY` -- Brave Search API for web search skill (free at brave.com/search/api)

**Option 1: 1Password CLI**

Create a `.env.op` file with `op://` references:

```
ANTHROPIC_API_KEY=op://Private/your-item/ANTHROPIC_API_KEY
BRAVE_API_KEY=op://Private/your-item/BRAVE_API_KEY
```

Then run with:

```bash
op run --env-file .env.op --account <your-account-id> -- npx tsx src/index.ts chat penny
```

**Option 2: Environment variables**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export BRAVE_API_KEY=BSA...
npx tsx src/index.ts chat penny
```

**MCP server:**

```bash
# npm script (bring your own secrets)
npm run mcp

# Or wrap with op for MCP host
claude mcp add clawmon -- op run --env-file .env.op --account <your-id> -- npm run mcp
```

## How It Works

- **Hatching** -- Mulberry32 PRNG rolls species, rarity, and stats deterministically from your user ID. LLM generates name + personality based on species + role.
- **Roles** -- each role defines what the clawmon pays attention to, how often it engages, and what skills it gets.
- **Skills** -- Claude API tool use. The clawmon decides when to calculate, search, or save notes. Up to 5 tool iterations per message.
- **Memory** -- markdown files with YAML frontmatter in `~/.clawmon/clawmons/<name>/memory/`. Human-readable, inspectable, yours.
- **Streaming** -- responses stream token-by-token via Opus 4.6. Skill activity shows in real-time.
- **MCP** -- runs as a stdio MCP server exposing 10 tools to any MCP-compatible host.

## Backlog

See [BACKLOG.md](BACKLOG.md) for the prioritized task list, MVP gap analysis, and time estimates.

## License

[MIT](LICENSE)
