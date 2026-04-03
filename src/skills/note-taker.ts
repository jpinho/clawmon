import type { Skill } from './types.js';

export const noteTakerSkill: Skill = {
  name: 'save_note',
  description: 'Explicitly save a note to your own memory. Use when the owner tells you something important you should remember, like a fact about their life, a goal, a preference, or a decision. Do NOT use this for every message -- only for things worth remembering across sessions.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short title for the note (e.g. "Savings goal", "Prefers direct feedback")',
      },
      content: {
        type: 'string',
        description: 'The observation or fact to remember',
      },
      type: {
        type: 'string',
        enum: ['observation', 'pattern', 'preference', 'fact', 'goal', 'insight'],
        description: 'Type of note: observation (something noticed), pattern (recurring behavior), preference (how they like things), fact (stated fact), goal (something they want), insight (a connection you made)',
      },
    },
    required: ['title', 'content', 'type'],
  },

  // Execute is handled specially in api.ts -- it saves to the clawmon's memory
  // This is a placeholder; the actual save happens in the tool use handler
  async execute(input: Record<string, unknown>): Promise<string> {
    const title = String(input.title ?? '');
    const type = String(input.type ?? 'observation');
    return `Noted: [${type}] ${title}`;
  },
};
