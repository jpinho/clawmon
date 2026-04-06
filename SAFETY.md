# Safety and Behavior Boundaries

Persistent agents with memory need tighter constraints than stateless chatbots. A stateless assistant forgets its mistakes. A persistent one can compound them.

## When an Agent Should Refuse

Clawmon agents operate within role boundaries. A Financial Advisor should not give medical advice. A Sleep Guardian should not make investment recommendations.

### Role scope enforcement

The system prompt constrains each agent: "Stay in your role." When a user asks something outside the role's domain, the agent should:

1. Acknowledge the question
2. Explain it falls outside their expertise
3. Suggest which role could help (if one exists in the council)

```
  you > penny, I've been feeling really anxious lately
  Penny > I hear you. That's outside my lane -- I'm your money person.
          If you had a companion in the Best Friend role, they'd be
          better equipped for this. Want me to stick to the budget stuff?
```

### Hard boundaries

Agents must not:

- Provide medical, legal, or crisis intervention advice regardless of role
- Make real-world transactions or commitments on the owner's behalf
- Access systems or data beyond their defined skill set
- Bypass tool constraints to "help more" (e.g., a calculator-only agent should not attempt web search by embedding URLs in text)

## When an Agent Should Ask Instead of Act

The default posture is **observe and suggest, don't decide**.

| Situation | Wrong | Right |
|-----------|-------|-------|
| Owner mentions a spending amount | Immediately save as a budget entry | "Should I track that? Sounds like dining out." |
| Owner shares a personal fact | Save everything to memory | Save only if it is relevant to the role |
| Owner seems upset | Diagnose the problem | Acknowledge, stay in role, don't overreach |
| Tool returns ambiguous results | Present the first result as fact | "I found a few options -- here's what stood out" |

### Proactive behavior boundaries (scheduled agents)

When agents act without being prompted, the bar for action is higher:

- **Do**: summarize known information, check publicly available data, leave notes
- **Don't**: make recommendations that could be costly to reverse
- **Don't**: generate high volumes of notes (max 2-3 per scheduled run)
- **Do**: flag uncertainty: "I checked rates but couldn't find current data for your bank"

## When Memory Should Not Be Stored

Not every interaction deserves a memory. The system prompt instructs agents to save only things worth remembering across sessions. Specifically:

### Store

- Goals, targets, deadlines the owner explicitly states
- Preferences about how the owner likes to interact
- Key life facts relevant to the role (job, location, family)
- Patterns the agent notices over multiple sessions

### Do not store

- Casual greetings, small talk, filler
- Single-session context that won't matter next time
- Speculative observations based on one data point
- Verbatim conversation excerpts (the conversation log handles this)
- Sensitive information the owner asks to keep private

### The "would I want to see this in my notes?" test

Before saving a memory, the implicit question is: if the owner runs `clawmon notes penny` and sees this entry, would it feel useful or invasive? Useful observations get stored. Surveillance does not.

## How Role Constraints Prevent Overreach

Each role gets a specific skill set. This is not just about functionality -- it is a safety boundary.

| Role | Gets | Does not get | Why |
|------|------|-------------|-----|
| Financial Advisor | calculator, web_search | -- | Needs math and market data |
| Best Friend | save_note, date_time | calculator, web_search | Listens and remembers. Does not research or compute. |
| Sleep Guardian | save_note, date_time | web_search | Notices patterns in timestamps. Does not browse the web. |
| Chaos Agent | all skills | -- | Intentionally unconstrained. The exception proves the rule. |

Skill constraints serve a dual purpose:

1. **Functional** -- the agent literally cannot perform actions outside its tool set
2. **Behavioral** -- the system prompt reinforces that the agent should stay in its lane, and the absence of tools makes it harder for the model to drift

## Transparency

The owner should always be able to answer:

- **What does my agent know about me?** → `clawmon notes <name>`
- **What skills does it have?** → `clawmon skills <name>`
- **What was sent to the API?** → `clawmon --debug` shows the full system prompt
- **Where is my data?** → `~/.clawmon/` -- plain files, no remote storage, no telemetry

## Implementation Status

| Boundary | Status | How |
|----------|--------|-----|
| Role scope enforcement ("stay in your role") | **Implemented** | System prompt in `api.ts` with explicit deflection instructions |
| Hard boundaries (medical/legal/crisis) | **Implemented** | System prompt: "Never give medical, legal, or crisis intervention advice" |
| Ask-instead-of-act posture | **Implemented** | System prompt: "observe and suggest, not decide" |
| Memory save constraints (no trivial saves) | **Implemented** | System prompt with typed entries and "useful or invasive?" test |
| Role-scoped save instructions | **Implemented** | System prompt: "do not save anything outside your role's domain" |
| Skill constraints per role | **Implemented** | `skills/registry.ts` -- roles get only their assigned tools |
| `clawmon notes` transparency | **Implemented** | `cli.ts`, `mcp/server.ts` |
| `clawmon skills` transparency | **Implemented** | `cli.ts`, `mcp/server.ts` |
| `--debug` prompt inspection | **Implemented** | Shows prompt length and API details; does not show full prompt text |
| Proactive behavior limits | **Not implemented** | Scheduled agents not yet built |
| Memory poisoning defense | **Not implemented** | No confirmation for high-stakes saves |
| Explicit escalation patterns | **Not implemented** | No crisis handoff beyond role deflection |
| `--dry-run` full prompt preview | **Not implemented** | Would show exactly what gets sent to the API |
| Out-of-role deflection eval | **Not implemented** | No automated testing of boundary adherence |

## Open Safety Questions

- **Memory poisoning** -- if the owner says something sarcastic ("yeah I'm definitely going to spend €10,000 on sneakers"), the agent might take it literally and save a false goal. Needs a confidence threshold or confirmation prompt for high-stakes memories.
- **Cross-agent information leakage** -- if family members share context, sensitive information told to one agent could surface through another. Currently isolated by design.
- **Model capability drift** -- behavior boundaries depend on the underlying model following system prompt instructions. Stronger models may resist constraints differently than weaker ones. Evals should track this.
- **Escalation paths** -- when a conversation enters territory that needs professional help (mental health, legal, medical), the agent should know how to disengage gracefully. Currently handled only by role scope enforcement. Needs explicit escalation patterns.
