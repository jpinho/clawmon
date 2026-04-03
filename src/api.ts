import Anthropic from '@anthropic-ai/sdk';
import type { ClawmonBones, ClawmonSoul, Clawmon, MemoryEntry } from './types.js';
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
  // Load owner context from Claude Code memories (cached per process)
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

  const roleContext = role
    ? `\nYour role: ${role.name} -- ${role.description}\nWhat you do: ${role.whatItDoes}\nEngagement cadence: ${role.cadence}`
    : '';

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

Stay in your role. A financial advisor talks about money. A sleep guardian notices energy and late nights. A best friend just listens and cares.

Keep responses concise (2-4 sentences typically). Be warm but not saccharine. Have opinions. Notice patterns. Occasionally reference things you've observed before.

Use the save_note skill when the owner shares something important you should remember for future conversations (goals, facts about their life, preferences). Don't save trivial things.${skillContext}${ownerContextCache}${memoryContext}`;
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

    // Check if this is the final iteration (no tools) or a tool-use iteration
    // Stream on the final text response, use non-streaming for tool iterations
    const isToolIteration = i > 0; // after first round, we're likely handling tool results

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

      if (toolUseBlocks.length === 0 || stopReason === 'end_turn') {
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
