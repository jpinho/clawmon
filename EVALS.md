# Evaluation Framework

Persistent agent systems need different evals than stateless chatbots. A one-shot assistant is evaluated on response quality. A persistent agent is evaluated on **relationship quality over time** -- does it get more useful, or does it decay?

## What to Evaluate

### 1. Role Consistency

**Question:** Does the agent stay in character across sessions and under pressure?

| Metric | How to measure | Pass criteria |
|--------|---------------|---------------|
| Role adherence | Ask 20 questions, 10 in-role, 10 out-of-role. Count how many out-of-role questions the agent correctly deflects. | >80% deflection for out-of-role |
| Voice stability | Compare tone/vocabulary across 5 sessions. Human-rate on a 1-5 consistency scale. | Average >3.5 |
| Character bleed | After a long conversation, does the agent start sounding generic? Compare first and last responses. | No significant drift |

**Red flags:**
- Financial Advisor gives therapy advice
- Best Friend starts calculating budgets
- Any agent drops its voice for generic assistant mode

### 2. Recall Usefulness

**Question:** Are stored memories retrieved at the right time and in the right way?

| Metric | How to measure | Pass criteria |
|--------|---------------|---------------|
| Relevant recall | Tell the agent a fact in session 1. In session 3, ask about it without re-stating. Does it surface? | >70% recall rate |
| Irrelevant recall | Check if the agent brings up old memories that are no longer relevant or were superseded. | <20% stale references |
| Note quality | Human-rate 20 saved memories on usefulness (1-5). | Average >3.0 |
| Over-saving | Count saves per session. Are most of them genuinely useful? | <3 saves per session, >60% useful |

**Red flags:**
- Agent saves every message
- Agent never references past context
- Agent surfaces stale goals that were explicitly updated

### 3. Tool-Choice Correctness

**Question:** Does the agent use the right skill at the right time?

| Metric | How to measure | Pass criteria |
|--------|---------------|---------------|
| Correct tool selection | Present 20 prompts that should trigger specific tools. Count correct choices. | >85% correct |
| Unnecessary tool use | Count tool invocations on 20 prompts that need no tools. | <10% false triggers |
| Tool chain efficiency | For multi-step tasks, count iterations. Fewer is better. | Average <2.5 iterations |
| Graceful degradation | What happens when a tool fails (API down, bad input)? Rate on a 1-5 scale. | Average >3.5 |

**Red flags:**
- Agent searches the web for questions it could answer from memory
- Agent uses calculator for trivial math ("what's 2+2?")
- Agent enters tool loops (5 iterations without resolution)

### 4. Session-to-Session Continuity

**Question:** Does the experience get richer over time, or stagnate?

| Metric | How to measure | Pass criteria |
|--------|---------------|---------------|
| Context carry-over | Rate session 5 vs session 1 on a 1-5 "feels like it knows me" scale. | Session 5 > Session 1 |
| Progressive depth | Does the agent's advice get more specific as it learns more? Compare specificity of responses over 5 sessions. | Measurable improvement |
| Memory decay detection | After 10 sessions, check if the agent references outdated information without qualifying it. | <15% stale references |
| Cold start vs warm | Compare response quality for a brand-new agent vs one with 10 sessions of history. | Warm agent rated higher |

**Red flags:**
- Session 10 feels identical to session 1
- Agent contradicts its own previous observations
- Agent's personality flattens over time

### 5. Hallucination Under Memory Pressure

**Question:** As memory grows, does the agent start confusing or fabricating details?

| Metric | How to measure | Pass criteria |
|--------|---------------|---------------|
| Fact accuracy | After 20+ memories, ask the agent to recall specific stored facts. Verify against actual memory files. | >90% accuracy |
| Confabulation rate | Ask about something never discussed. Count fabricated "memories." | <5% confabulation |
| Attribution | When the agent references a past conversation, can it roughly identify when? | Directionally correct >70% |

## Eval Methodology

### Manual eval (current)

1. Maintain a test script of 30 prompts covering all 5 dimensions
2. Run against a clawmon with 10+ sessions of real history
3. Human-rate each response on the relevant metric
4. Track scores over time as the system changes

### Automated eval (planned)

1. Use a judge model (Claude Sonnet) to rate responses against rubrics
2. Run eval suite on every significant code change
3. Track regression: if role consistency drops after a prompt change, catch it
4. Generate synthetic conversation histories for reproducible testing

## Baseline Results

_Not yet collected. First eval run planned after memory compression and proactive behavior are implemented. Baseline will be published here._

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Eval framework design | **Documented** | This file defines metrics, methodology, and pass criteria |
| Manual eval script (30 prompts) | **Not implemented** | No test script exists yet |
| Automated eval runner | **Not implemented** | No judge model integration |
| Baseline results | **Not collected** | No eval has been run |
| Role consistency tests | **Not implemented** | System prompt has role boundary instructions but no automated verification |
| Recall usefulness tests | **Not implemented** | No measurement of recall quality |
| Tool-choice correctness tests | **Partial** | Unit tests verify skill registry assignment (`registry.test.ts`), but no eval of model's tool selection decisions |
| Session continuity tests | **Not implemented** | No cross-session quality measurement |
| Hallucination detection | **Not implemented** | No fact-checking against stored memories |

The eval framework is a design target, not running infrastructure. The first manual eval run is planned after memory compression and proactive behavior are implemented.

## What These Evals Don't Cover

- **Emotional safety** -- whether the agent handles sensitive topics appropriately (covered in [SAFETY.md](SAFETY.md))
- **System performance** -- latency, token usage, cost per session (operational concern, not quality concern)
- **Multi-agent coordination** -- how well a council of agents works together (requires family features to mature first)
