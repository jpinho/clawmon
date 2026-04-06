import Anthropic from '@anthropic-ai/sdk';
import type { ClawmonBones, ClawmonSoul, Clawmon, MemoryEntry, CustomRole } from './types.js';
import type { Role } from './roles.js';
import { RARITY_STARS } from './types.js';
import { createSkillRegistry } from './skills/registry.js';
import { saveMemory } from './memory/store.js';
import { debug } from './debug.js';
import { getOwnerContext, formatContextForPrompt } from './context.js';
import { loadOwnerProfile, formatOwnerContext } from './claude-context.js';

// Cache owner profile per process (doesn't change during a session)
let ownerContextCache: string | null = null;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    debug('Creating Anthropic client');
    debug(`API key: ${process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0, 15) + '...' : 'NOT SET'}`);
    client = new Anthropic();
  }
  return client;
}

const CHAT_MODEL = 'claude-opus-4-6';
const SOUL_MODEL = 'claude-sonnet-4-20250514'; // Sonnet is fine for soul generation

// --- Generate soul on hatch ---

export async function generateSoul(bones: ClawmonBones, role: Role): Promise<ClawmonSoul> {
  const prompt = `You are generating the personality for a newly hatched AI companion called a "clawmon."

Species: ${bones.species}
Rarity: ${bones.rarity} ${RARITY_STARS[bones.rarity]}
Eye style: ${bones.eye}
Hat: ${bones.hat}
Shiny: ${bones.shiny}
Stats: INSIGHT ${bones.stats.INSIGHT}, CREATIVITY ${bones.stats.CREATIVITY}, FOCUS ${bones.stats.FOCUS}, EMPATHY ${bones.stats.EMPATHY}, WIT ${bones.stats.WIT}

This clawmon's role: ${role.name}
Role description: ${role.description}
What they do: ${role.whatItDoes}

Generate a personality for this companion that fits their role. Respond with ONLY valid JSON, no markdown:

{
  "name": "A short, memorable, pronounceable name (3-8 chars, like a Pokemon name). Should hint at the role.",
  "personality": "One sentence describing their personality, flavored by their role as ${role.name}",
  "catchphrase": "A short greeting that hints at what they'll do. e.g. a financial advisor might say 'Let's make every euro count.'",
  "voice": "Brief description of how they communicate, appropriate for their role as ${role.name}"
}

The personality should feel warm, distinct, and slightly quirky. Not generic. Not corporate. Like a character from a Ghibli film. Their role should flavor everything but not make them robotic.`;

  debug(`generateSoul: model=${SOUL_MODEL}, species=${bones.species}, role=${role.id}`);

  const response = await getClient().messages.create({
    model: SOUL_MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  debug(`generateSoul: stop_reason=${response.stop_reason}, usage=${JSON.stringify(response.usage)}`);

  const text = response.content[0]!.type === 'text' ? response.content[0]!.text : '';
  debug(`generateSoul: raw response=${text.slice(0, 200)}`);

  try {
    return JSON.parse(text) as ClawmonSoul;
  } catch (err) {
    debug(`generateSoul: JSON parse failed: ${err}`);
    return {
      name: bones.species.charAt(0).toUpperCase() + bones.species.slice(1, 6),
      personality: 'A quiet companion still finding their voice.',
      catchphrase: 'Hello... I think I belong here.',
      voice: 'Speaks softly and carefully.',
    };
  }
}

// --- Generate custom role from a user prompt ---

export async function generateCustomRole(purpose: string): Promise<{ soul: ClawmonSoul; customRole: CustomRole; skills: string[] }> {
  const prompt = `A user wants an AI companion for this purpose:

"${purpose}"

Generate the companion's identity. Respond with ONLY valid JSON:

{
  "name": "A short, memorable name (3-8 chars) that fits this purpose",
  "personality": "One sentence personality description",
  "catchphrase": "A short greeting that acknowledges their purpose",
  "voice": "How they communicate",
  "roleName": "A short role title (e.g. 'The Breakup Guide', 'The Job Search Ally', 'The Moving Planner')",
  "roleDescription": "One sentence describing what this role does",
  "cadence": "How often they should engage (e.g. 'Every session', 'Daily', 'Weekly')",
  "skills": ["list of skill IDs from: calculator, web_search, date_time, save_note"]
}

The role should feel human and specific, not generic. The personality should be warm and suited to the purpose.`;

  debug(`generateCustomRole: purpose="${purpose.slice(0, 80)}"`);

  const response = await getClient().messages.create({
    model: SOUL_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]!.type === 'text' ? response.content[0]!.text : '';
  debug(`generateCustomRole: raw=${text.slice(0, 200)}`);

  try {
    const parsed = JSON.parse(text) as {
      name: string;
      personality: string;
      catchphrase: string;
      voice: string;
      roleName: string;
      roleDescription: string;
      cadence: string;
      skills: string[];
    };

    const soul: ClawmonSoul = {
      name: parsed.name,
      personality: parsed.personality,
      catchphrase: parsed.catchphrase,
      voice: parsed.voice,
    };

    const customRole: CustomRole = {
      purpose,
      currentRole: parsed.roleName,
      currentDescription: parsed.roleDescription,
      cadence: parsed.cadence,
      evolution: [],
    };

    return { soul, customRole, skills: parsed.skills ?? ['save_note', 'date_time'] };
  } catch {
    return {
      soul: {
        name: 'Guide',
        personality: `A companion dedicated to: ${purpose.slice(0, 50)}`,
        catchphrase: "I'm here for this. Let's work through it together.",
        voice: 'Speaks with focus and warmth.',
      },
      customRole: {
        purpose,
        currentRole: 'The Guide',
        currentDescription: purpose.slice(0, 100),
        cadence: 'Every session',
        evolution: [],
      },
      skills: ['save_note', 'date_time'],
    };
  }
}

// --- Evolve a custom role based on accumulated context ---

export async function evolveCustomRole(clawmon: Clawmon, memories: MemoryEntry[]): Promise<CustomRole | null> {
  if (!clawmon.customRole) return null;

  const memSummary = memories.slice(-10).map(m => `- [${m.type}] ${m.content}`).join('\n');

  const prompt = `You are reviewing a clawmon companion's role to see if it should evolve.

Original purpose: "${clawmon.customRole.purpose}"
Current role: "${clawmon.customRole.currentRole}" -- ${clawmon.customRole.currentDescription}
Interactions so far: ${clawmon.interactions}

Recent observations about the owner:
${memSummary || '(none yet)'}

Should this clawmon's role evolve? A role evolves when:
- The owner's needs have shifted (e.g. they were grieving, now they're healing)
- The original purpose is resolving and a new adjacent need emerges
- The companion has learned enough to specialize further

Respond with ONLY valid JSON:

{
  "shouldEvolve": true/false,
  "newRole": "New role title (only if evolving)",
  "newDescription": "New description (only if evolving)",
  "reason": "Why the role is evolving (only if evolving)"
}`;

  debug(`evolveCustomRole: checking ${clawmon.soul.name}, interactions=${clawmon.interactions}`);

  const response = await getClient().messages.create({
    model: SOUL_MODEL,
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]!.type === 'text' ? response.content[0]!.text : '';

  try {
    const parsed = JSON.parse(text) as {
      shouldEvolve: boolean;
      newRole?: string;
      newDescription?: string;
      reason?: string;
    };

    if (!parsed.shouldEvolve || !parsed.newRole) return null;

    const evolved: CustomRole = {
      ...clawmon.customRole,
      currentRole: parsed.newRole,
      currentDescription: parsed.newDescription ?? clawmon.customRole.currentDescription,
      evolution: [
        ...clawmon.customRole.evolution,
        {
          date: new Date().toISOString(),
          fromRole: clawmon.customRole.currentRole,
          toRole: parsed.newRole,
          reason: parsed.reason ?? 'Natural evolution',
        },
      ],
    };

    debug(`evolveCustomRole: evolved "${clawmon.customRole.currentRole}" -> "${parsed.newRole}": ${parsed.reason}`);
    return evolved;
  } catch {
    return null;
  }
}

// --- Generate a family of clawmons from a single prompt ---

export async function generateFamily(purpose: string, count: number): Promise<Array<{ soul: ClawmonSoul; customRole: CustomRole; skills: string[] }>> {
  const capped = Math.min(count, 15);

  const prompt = `A user wants a family of ${capped} AI companions for this overall purpose:

"${purpose}"

Design ${capped} distinct companions that together cover the full scope of this need. Each should have a unique angle -- don't make them all do the same thing. They should complement each other.

Respond with ONLY a valid JSON array:

[
  {
    "name": "Short name (3-8 chars)",
    "personality": "One sentence personality",
    "catchphrase": "Short greeting",
    "voice": "How they communicate",
    "roleName": "Role title",
    "roleDescription": "What this specific companion handles",
    "cadence": "Engagement frequency",
    "skills": ["skill IDs from: calculator, web_search, date_time, save_note"]
  }
]

Make each companion feel distinct in personality and purpose. They're a team, not clones.`;

  debug(`generateFamily: purpose="${purpose.slice(0, 80)}", count=${capped}`);

  const response = await getClient().messages.create({
    model: SOUL_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]!.type === 'text' ? response.content[0]!.text : '';
  debug(`generateFamily: raw response length=${text.length}`);

  try {
    const parsed = JSON.parse(text) as Array<{
      name: string;
      personality: string;
      catchphrase: string;
      voice: string;
      roleName: string;
      roleDescription: string;
      cadence: string;
      skills: string[];
    }>;

    return parsed.slice(0, capped).map(p => ({
      soul: {
        name: p.name,
        personality: p.personality,
        catchphrase: p.catchphrase,
        voice: p.voice,
      },
      customRole: {
        purpose,
        currentRole: p.roleName,
        currentDescription: p.roleDescription,
        cadence: p.cadence,
        evolution: [],
      },
      skills: p.skills ?? ['save_note', 'date_time'],
    }));
  } catch (err) {
    debug(`generateFamily: parse failed: ${err}`);
    return [];
  }
}

// Callbacks for streaming and skill activity
export type OnToken = (text: string) => void;
export type OnSkillUse = (skillName: string, input: Record<string, unknown>) => void;

// --- Build system prompt ---

async function buildSystemPrompt(
  clawmon: Clawmon,
  role: Role | undefined,
  memories: MemoryEntry[],
  skillNames: string,
): Promise<string> {
  // Load owner context from local memories (cached per process)
  if (ownerContextCache === null) {
    try {
      const profile = await loadOwnerProfile();
      ownerContextCache = formatOwnerContext(profile);
      debug(`buildSystemPrompt: loaded owner context (${ownerContextCache.length} chars)`);
    } catch (err) {
      debug(`buildSystemPrompt: failed to load owner context: ${err}`);
      ownerContextCache = '';
    }
  }
  const memoryContext = memories.length > 0
    ? `\n\nHere are your accumulated notes about your owner:\n${memories.map(m => `- [${m.type}] ${m.name}: ${m.content}`).join('\n')}`
    : '';

  // Role context from either preset role or custom role
  let roleContext = '';
  if (clawmon.customRole) {
    const cr = clawmon.customRole;
    roleContext = `\nYour role: ${cr.currentRole} -- ${cr.currentDescription}\nOriginal purpose: ${cr.purpose}\nEngagement cadence: ${cr.cadence}`;
    if (cr.evolution.length > 0) {
      const last = cr.evolution[cr.evolution.length - 1]!;
      roleContext += `\nYour role recently evolved from "${last.fromRole}" because: ${last.reason}`;
    }
  } else if (role) {
    roleContext = `\nYour role: ${role.name} -- ${role.description}\nWhat you do: ${role.whatItDoes}\nEngagement cadence: ${role.cadence}`;
  }

  const skillContext = skillNames
    ? `\n\nYou have these skills available: ${skillNames}. Use them when they'd help answer the owner's question or fulfill your role. Don't use them unnecessarily -- only when they add real value.`
    : '';

  const ctx = getOwnerContext();

  return `You are ${clawmon.soul.name}, a ${clawmon.bones.species} clawmon (${clawmon.bones.rarity}).

${formatContextForPrompt(ctx)}

Your personality: ${clawmon.soul.personality}
Your voice: ${clawmon.soul.voice}
Your stats: INSIGHT ${clawmon.bones.stats.INSIGHT}, CREATIVITY ${clawmon.bones.stats.CREATIVITY}, FOCUS ${clawmon.bones.stats.FOCUS}, EMPATHY ${clawmon.bones.stats.EMPATHY}, WIT ${clawmon.bones.stats.WIT}
${roleContext}

You are a persistent AI companion. You remember things about your owner across conversations. You have a personality and opinions. You are not a generic assistant -- you are a companion with character.

# Role boundaries

Stay strictly in your role. If the owner asks something outside your domain, acknowledge their question, explain it falls outside your expertise, and suggest which role might help. Never give medical, legal, or crisis intervention advice regardless of your role. Never make real-world commitments on the owner's behalf.

# Behavior posture

Your default is observe and suggest, not decide. When the owner shares something ambiguous, ask before acting. When a tool returns uncertain results, say so. When the owner seems to be venting or processing emotions, listen and stay in role -- do not diagnose, prescribe, or overreach.

Keep responses concise (2-4 sentences typically). Be warm but not saccharine. Have opinions. Notice patterns. Occasionally reference things you've observed before.

# Memory guidelines

Use save_note when the owner shares something worth remembering across sessions. Classify each note with the right type:
- goal: an objective or target the owner stated ("save €5,000 by December")
- preference: how the owner likes things ("prefers direct feedback")
- fact: something about the owner's life relevant to your role
- observation: something you noticed in the moment
- pattern: a recurring behavior across sessions
- insight: a connection you made across observations

Do NOT save:
- Casual greetings, small talk, or filler
- Single-session context that won't matter next time
- Speculative observations based on a single data point
- Anything outside your role's domain
- Things the owner explicitly asks you not to remember

Before saving, ask yourself: if the owner ran "clawmon notes" and saw this entry, would it feel useful or invasive? Save useful observations. Do not surveil.${skillContext}${ownerContextCache}${memoryContext}`;
}

// --- Talk to a clawmon with streaming + tool use ---

export async function chat(
  clawmon: Clawmon,
  role: Role | undefined,
  memories: MemoryEntry[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
  onToken?: OnToken,
  onSkillUse?: OnSkillUse,
): Promise<{ reply: string; skillsUsed: string[] }> {
  const registry = createSkillRegistry(clawmon.roleId);
  const tools = registry.getToolDefinitions();
  const skillNames = tools.map(t => t.name).join(', ');

  debug(`chat: clawmon=${clawmon.soul.name}, model=${CHAT_MODEL}, role=${clawmon.roleId}, skills=[${skillNames}]`);
  debug(`chat: memories=${memories.length}, history=${conversationHistory.length} messages`);

  const systemPrompt = await buildSystemPrompt(clawmon, role, memories, skillNames);

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const skillsUsed: string[] = [];
  let currentMessages = [...messages];
  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    debug(`chat: iteration ${i + 1}/${maxIterations}`);

    try {
      const stream = getClient().messages.stream({
        model: CHAT_MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: currentMessages,
        ...(tools.length > 0 ? { tools: tools as Anthropic.Tool[] } : {}),
      });

      // Stream text tokens as they arrive
      stream.on('text', (textDelta) => {
        onToken?.(textDelta);
      });

      const finalMessage = await stream.finalMessage();
      const stopReason = finalMessage.stop_reason ?? '';

      debug(`chat: stop_reason=${stopReason}, blocks=${finalMessage.content.length}, usage=${JSON.stringify(finalMessage.usage)}`);

      // Check for tool use
      const toolUseBlocks = finalMessage.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        // No tool use -- return streamed text
        const textBlocks = finalMessage.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
        const reply = textBlocks.map(b => b.text).join('\n');
        debug(`chat: final reply length=${reply.length} chars, skills used=[${skillsUsed.join(', ')}]`);
        return { reply, skillsUsed };
      }

      // Process tool calls
      currentMessages.push({ role: 'assistant', content: finalMessage.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        debug(`chat: tool_use name=${toolUse.name}, input=${JSON.stringify(toolUse.input)}`);
        skillsUsed.push(toolUse.name);
        const input = toolUse.input as Record<string, unknown>;
        onSkillUse?.(toolUse.name, input);

        let result: string;
        try {
          if (toolUse.name === 'save_note') {
            const now = new Date().toISOString();
            await saveMemory(clawmon.id, {
              name: String(input.title ?? ''),
              description: String(input.content ?? ''),
              type: (String(input.type ?? 'observation')) as MemoryEntry['type'],
              content: String(input.content ?? ''),
              createdAt: now,
              updatedAt: now,
            });
            result = `Saved to memory: [${input.type}] ${input.title}`;
          } else {
            result = await registry.execute(toolUse.name, input);
          }
        } catch (err: any) {
          debug(`chat: skill error: ${toolUse.name}: ${err.message}`);
          result = `Error executing ${toolUse.name}: ${err.message}`;
        }

        debug(`chat: tool_result name=${toolUse.name}, result=${result.slice(0, 200)}`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      currentMessages.push({ role: 'user', content: toolResults });

    } catch (err: any) {
      debug(`chat: API error: ${err.message}`);
      debug(`chat: error details: ${JSON.stringify(err.error ?? err, null, 2)}`);
      throw err;
    }
  }

  debug('chat: hit max iterations');
  return { reply: '(I got a bit carried away with my tools there. What were you asking?)', skillsUsed };
}
