---
name: clawmon
user_invocable: true
description: Interact with your clawmon companions via MCP. Use when the user mentions a clawmon by name, asks about their companions, wants to load companion context, save session notes, hatch/spawn companions, or manage their clawmon family. Proactively use clawmon_context at session start when companions are relevant, and save_session at session end.
trigger_keywords:
  - clawmon
  - companion
  - penny
  - talk to
  - hatch
  - spawn
  - family
  - clawmon context
  - save session
  - shuffle
  - clawmon notes
  - clawmon config
  - obsidian vault
---

# Clawmon MCP Skill

Clawmon is a persistent agent companion system. Each companion has a role, personality, memory, and skills. They remember the owner across sessions.

## Available MCP Tools

### Fast tools (no AI call -- instant)

- **`clawmon_context`** `{name}` -- Load a companion's full context (personality, role, memories, recent conversation) into the current session. Use this at the start of a session when the user wants a companion's knowledge available as reference. Returns structured text, not an AI response.

- **`save_session`** `{name, title, content, type}` -- Save an observation directly to a companion's memory. Use at the end of a session to capture what happened. Types: `observation`, `pattern`, `preference`, `fact`, `goal`, `insight`.

- **`clawmon_config`** `{key?, value?}` -- View or set configuration. Key: `memoryRoot` (set to Obsidian vault path). No args = show current config.

### Conversation tools (AI call -- slower)

- **`talk_to_clawmon`** `{name?, message}` -- Talk to a companion. They respond in character with personality and can use tools (calculator, web search, date/time, save_note). This runs a full agentic loop via Claude Opus.

- **`talk_to_family`** `{message, family_id?}` -- Roundtable discussion with all family members. Each responds from their role's perspective.

### Creating and managing

- **`hatch_clawmon`** `{role?}` -- Hatch a companion with a predefined role. No role = show available roles. Roles: best-friend, financial-advisor, career-coach, sleep-guardian, etc. (19 total).

- **`spawn_clawmon`** `{purpose}` -- Spawn a companion from a natural language purpose. Role evolves over time. Example: "help me through a career change".

- **`spawn_family`** `{purpose, count?}` -- Spawn a team of complementary companions. Default count: 5. Example: "I'm training for a triathlon".

- **`shuffle_clawmon`** `{name}` -- Regenerate a companion's name and personality while keeping role, memories, and conversations.

### Viewing

- **`show_clawmon`** `{name}` -- Full profile card with ASCII sprite, stats, role, personality.
- **`family`** -- List all companions with roles, species, rarity, interaction counts.
- **`clawmon_notes`** `{name}` -- See what a companion has remembered about the owner.
- **`clawmon_skills`** `{name}` -- See what tools a companion has access to.
- **`clawmon_roles`** -- Browse all 19 predefined roles.
- **`clawmon_export`** `{name}` -- Export a companion to portable JSON.
- **`show_clawmon_help`** -- List all MCP tools with descriptions.

## Recommended Workflow

### Start of session
If a companion is relevant to the current work, load their context:
```
clawmon_context({name: "penny"})
```
This gives you their memories and role without an AI call. Use the context to inform your responses.

### During session
If the user wants to talk to a companion in character:
```
talk_to_clawmon({name: "penny", message: "how's my savings goal?"})
```

### End of session
Save relevant observations:
```
save_session({name: "penny", title: "Refactored auth module", content: "Owner spent the session refactoring the authentication middleware. Mentioned wanting to simplify the token refresh flow.", type: "observation"})
```

## Key Design Details

- Each companion has **feelings** (mood, confidence) that change based on tool success/failure. Low confidence makes them prefer simpler approaches.
- Each companion has an **integrity** file tracking tool success rate and notable events.
- Memories are markdown with YAML frontmatter and tags -- Obsidian-compatible.
- Family members share a parent folder when using Obsidian vault integration.
- Custom roles evolve every 10 interactions based on accumulated context.
- Names are unique across all companions. Shuffle regenerates identity but preserves memories.
