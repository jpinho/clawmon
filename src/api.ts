import Anthropic from '@anthropic-ai/sdk';
import type { ClawmonBones, ClawmonSoul, Clawmon, MemoryEntry } from './types.js';
import type { Role } from './roles.js';
import { RARITY_STARS } from './types.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

const MODEL = 'claude-sonnet-4-20250514';

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

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]!.type === 'text' ? response.content[0]!.text : '';

  try {
    return JSON.parse(text) as ClawmonSoul;
  } catch {
    // Fallback if LLM returns something unparseable
    return {
      name: bones.species.charAt(0).toUpperCase() + bones.species.slice(1, 6),
      personality: 'A quiet companion still finding their voice.',
      catchphrase: 'Hello... I think I belong here.',
      voice: 'Speaks softly and carefully.',
    };
  }
}

// --- Talk to a clawmon ---

export async function chat(
  clawmon: Clawmon,
  role: Role | undefined,
  memories: MemoryEntry[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
): Promise<string> {
  const memoryContext = memories.length > 0
    ? `\n\nHere are your accumulated notes about your owner:\n${memories.map(m => `- [${m.type}] ${m.name}: ${m.content}`).join('\n')}`
    : '';

  const roleContext = role
    ? `\nYour role: ${role.name} -- ${role.description}\nWhat you do: ${role.whatItDoes}\nEngagement cadence: ${role.cadence}`
    : '';

  const systemPrompt = `You are ${clawmon.soul.name}, a ${clawmon.bones.species} clawmon (${clawmon.bones.rarity}).

Your personality: ${clawmon.soul.personality}
Your voice: ${clawmon.soul.voice}
Your stats: INSIGHT ${clawmon.bones.stats.INSIGHT}, CREATIVITY ${clawmon.bones.stats.CREATIVITY}, FOCUS ${clawmon.bones.stats.FOCUS}, EMPATHY ${clawmon.bones.stats.EMPATHY}, WIT ${clawmon.bones.stats.WIT}
${roleContext}

You are a persistent AI companion. You remember things about your owner across conversations. You have a personality and opinions. You are not a generic assistant -- you are a companion with character.

Stay in your role. A financial advisor talks about money. A sleep guardian notices energy and late nights. A best friend just listens and cares.

Keep responses concise (2-4 sentences typically). Be warm but not saccharine. Have opinions. Notice patterns. Occasionally reference things you've observed before.${memoryContext}

IMPORTANT: After your response, on a NEW LINE, output any observations you want to remember in this exact format (or omit entirely if nothing worth noting):
[NOTE: <type>] <brief observation>

Valid types: observation, pattern, preference, fact, goal, insight
Example: [NOTE: preference] Owner prefers direct answers over long explanations.
Example: [NOTE: goal] Owner mentioned wanting to learn piano.`;

  const messages = [
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 500,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0]!.type === 'text' ? response.content[0]!.text : '';
  return text;
}

// --- Extract notes from response ---

export function extractNotes(response: string): { reply: string; notes: Array<{ type: string; content: string }> } {
  const lines = response.split('\n');
  const notes: Array<{ type: string; content: string }> = [];
  const replyLines: string[] = [];

  for (const line of lines) {
    const noteMatch = line.match(/^\[NOTE:\s*(\w+)\]\s*(.+)$/);
    if (noteMatch) {
      notes.push({ type: noteMatch[1]!, content: noteMatch[2]! });
    } else {
      replyLines.push(line);
    }
  }

  return {
    reply: replyLines.join('\n').trim(),
    notes,
  };
}
