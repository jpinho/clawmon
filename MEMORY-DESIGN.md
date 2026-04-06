# Memory Design

How Clawmon's memory system works, and the design decisions behind it.

## The Problem

Most AI memory systems fail in one of two ways: they remember everything (context bloat, irrelevant recall) or they remember nothing useful (stateless reset every session). The challenge is deciding **what to store, what to surface, and what to let go**.

## What Gets Stored

Clawmon memories are typed. The agent decides what to save and classifies it:

| Type | When to save | Example |
|------|-------------|---------|
| **goal** | Owner states an objective | "Save €5,000 by December" |
| **preference** | Owner expresses how they like things | "Prefers direct feedback, no sugar-coating" |
| **fact** | Owner states something about their life | "Works at a fintech startup in Berlin" |
| **observation** | Agent notices something in the moment | "Owner mentioned feeling tired 3x this week" |
| **pattern** | Agent detects a recurring behavior | "Most productive commits happen 10am–1pm" |
| **insight** | Agent connects dots across observations | "Late-night sessions correlate with lower output the next day" |

The system prompt instructs agents to save only things worth remembering across sessions. Not every message. Not trivial exchanges.

## Storage Format

Plain markdown with YAML frontmatter. No database. No embeddings.

```markdown
---
name: Savings goal
description: Owner wants to save €5,000 by December 2026
type: goal
createdAt: 2026-04-03T10:00:00Z
updatedAt: 2026-04-03T10:00:00Z
---

Owner wants to save €5,000 by December 2026, requiring approximately €560 per month.
Currently ahead of schedule at €2,340 saved.
```

### Why files, not a vector store

1. **Inspectability** -- you can read exactly what your agents know about you in any text editor
2. **Portability** -- export a clawmon and its memories as a directory copy
3. **Debuggability** -- when recall seems wrong, you can see the source data directly
4. **Simplicity** -- no infrastructure, no embeddings model, no retrieval pipeline to tune

The trade-off is that retrieval is naive: all memories for a clawmon are loaded into context on every message. This works for small memory sets (<50 entries). It will not scale to hundreds.

## How Retrieval Works

Currently: **full context injection**. Every memory for the clawmon is loaded and appended to the system prompt on each message. This is the simplest approach and works well within the current scale.

```
system prompt = personality + role + context + ALL memories + recent conversation (last 10 messages)
```

### Planned: Relevance-filtered retrieval

As memory grows, full injection becomes expensive and noisy. The next iteration will:

1. **Score memories by recency** -- recent memories get priority
2. **Score by type relevance** -- goals and preferences are always included; observations are filtered by topic similarity
3. **Cap context budget** -- hard limit on memory tokens injected per message
4. **Summarize on overflow** -- when a clawmon has too many memories, older entries get compressed into summary entries

## What Gets Summarized

Not yet implemented. Design:

- After 20+ observations of the same type, compress the oldest N into a single summary entry
- Summaries preserve key facts but drop conversational context
- Original entries are archived (moved to a `memory/archive/` subdirectory), not deleted
- Summaries include a reference count: "Based on 12 observations over 3 weeks"

## What Gets Forgotten

Nothing is permanently deleted without explicit owner action. The design philosophy is that memory decay should be **deprioritization, not deletion**.

Planned decay model:

- Memories have a `relevance` score that decreases over time if never retrieved
- Low-relevance memories are excluded from context injection but remain on disk
- Owner can run `clawmon notes penny --all` to see everything, including deprioritized entries
- Owner can explicitly delete: `clawmon forget penny "savings goal"`

## How Memory Stays Useful

The failure mode for persistent memory is **context sludge** -- a growing pile of stale observations that wastes tokens and confuses the model. Defenses:

1. **Typed entries** -- the model knows whether something is a goal (long-lived) or an observation (potentially ephemeral)
2. **Agent discretion** -- the system prompt tells the agent to only save things worth remembering, not to be a stenographer
3. **Role constraints** -- a Financial Advisor saves financial facts; it should not save observations about sleep patterns (that is the Sleep Guardian's job)
4. **Human-readable format** -- the owner can audit and prune memories at any time
5. **Planned: TTL by type** -- observations decay faster than goals; preferences decay slowest

## Implementation Status

What the code actually does today vs what this doc describes.

| Feature | Status | Location |
|---------|--------|----------|
| Typed memory entries (6 types) | **Implemented** | `types.ts:114-121`, system prompt in `api.ts` |
| Agent decides when to save | **Implemented** | System prompt instructs save behavior; agentic loop in `api.ts` |
| File-based storage (markdown + YAML) | **Implemented** | `memory/store.ts:124-158` |
| MEMORY.md index | **Implemented** | `memory/store.ts:148-158` |
| Role-scoped save instructions | **Implemented** | System prompt: "do not save anything outside your role's domain" |
| "Useful or invasive?" test | **Implemented** | System prompt guidance |
| Full context injection (all memories) | **Implemented** | `api.ts:330-332` -- all memories loaded every message |
| Relevance-filtered retrieval | **Not implemented** | All memories injected regardless of relevance |
| Memory summarization / compression | **Not implemented** | No summary, no archival |
| Memory decay / deprioritization | **Not implemented** | No TTL, no relevance scoring |
| Deduplication | **Partial** | Filename collision overwrites same-title entries, but no semantic dedup |
| Memory cap / context budget | **Not implemented** | No limit on injected memory tokens |
| `--dry-run` prompt inspection | **Not implemented** | `--debug` shows prompt length but not full content |
| `clawmon forget` command | **Not implemented** | No way to delete individual memories from CLI |
| Cross-agent shared memory | **Not implemented** | Each clawmon has isolated memory |

## Open Questions

- **Deduplication** -- the model sometimes saves the same fact with slightly different wording. Current mitigation: filename collision (same title overwrites). Needs semantic dedup.
- **Cross-agent memory** -- should a Family share a memory pool? Currently each clawmon has its own. Shared memory creates coordination problems but enables richer family behavior.
- **Memory conflicts** -- what happens when a goal changes? The old "save €5,000" goal should be superseded, not coexist with "save €8,000." Needs an update-or-replace mechanism.
- **Privacy** -- all memories are local files. But they are injected into API calls. The owner should know exactly what is sent. A `--dry-run` flag that shows the full prompt without calling the API would help.
