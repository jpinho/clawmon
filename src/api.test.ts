import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a mock stream helper
function createMockStream(finalMsg: any) {
  const handlers: Record<string, Function> = {};
  return {
    on(event: string, handler: Function) {
      handlers[event] = handler;
      // Simulate text events for text blocks
      if (event === 'text' && finalMsg.content) {
        for (const block of finalMsg.content) {
          if (block.type === 'text') handler(block.text);
        }
      }
      return this;
    },
    async finalMessage() {
      return finalMsg;
    },
  };
}

const mockCreate = vi.fn();
const mockStream = vi.fn();

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate, stream: mockStream };
    },
  };
});

// Mock store to avoid filesystem writes
vi.mock('./memory/store.js', () => ({
  saveMemory: vi.fn(),
  loadFeelings: vi.fn().mockResolvedValue({ mood: 5, confidence: 5, recentOutcomes: [], trend: 'stable', updatedAt: '' }),
  saveFeelings: vi.fn(),
  updateFeelingsAfterInteraction: vi.fn().mockImplementation((f) => f),
  loadIntegrity: vi.fn().mockResolvedValue({ totalInteractions: 0, toolSuccesses: 0, toolFailures: 0, notesAccepted: 0, roleAdherence: 7, notableEvents: [], updatedAt: '' }),
  saveIntegrity: vi.fn(),
  updateIntegrityAfterInteraction: vi.fn().mockImplementation((i) => i),
}));

// Mock claude-context to avoid filesystem reads
vi.mock('./claude-context.js', () => ({
  loadOwnerProfile: vi.fn().mockResolvedValue({
    globalInstructions: null,
    userMemories: [],
    feedbackMemories: [],
    projectMemories: [],
    memoryIndexes: [],
  }),
  formatOwnerContext: vi.fn().mockReturnValue(''),
}));

import { generateSoul, chat } from './api.js';
import type { ClawmonBones, Clawmon, MemoryEntry } from './types.js';
import type { Role } from './roles.js';

const testBones: ClawmonBones = {
  species: 'pyroclaw',
  rarity: 'epic',
  eye: '@',
  hat: 'crown',
  shiny: false,
  stats: { INSIGHT: 50, CREATIVITY: 60, FOCUS: 40, EMPATHY: 70, WIT: 80 },
};

const testRole: Role = {
  id: 'financial-advisor',
  name: 'The Financial Advisor',
  category: 'growth',
  description: 'Budgeting, spending patterns, saving goals.',
  whatItDoes: 'Tracks spending, maintains budget picture.',
  cadence: 'Daily',
  exampleMessage: '"How much did I spend this week?"',
};

const testClawmon: Clawmon = {
  id: 'penny',
  bones: testBones,
  soul: {
    name: 'Penny',
    personality: 'Witty fire-type advisor.',
    catchphrase: "Let's make every euro count.",
    voice: 'Warm and direct.',
  },
  roleId: 'financial-advisor',
  hatchedAt: '2026-04-03T10:00:00Z',
  interactions: 0,
};

beforeEach(() => {
  mockCreate.mockReset();
  mockStream.mockReset();
});

describe('generateSoul', () => {
  it('returns parsed soul from API response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          name: 'Penny',
          personality: 'A witty fire-type.',
          catchphrase: 'Burn bright, save right!',
          voice: 'Direct but warm.',
        }),
      }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const soul = await generateSoul(testBones, testRole);
    expect(soul.name).toBe('Penny');
    expect(soul.personality).toBe('A witty fire-type.');
  });

  it('returns fallback soul when API returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const soul = await generateSoul(testBones, testRole);
    expect(soul.name).toBeTruthy();
    expect(soul.personality).toBeTruthy();
  });

  it('sends correct model and max_tokens', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({ name: 'T', personality: 'T', catchphrase: 'T', voice: 'T' }),
      }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    await generateSoul(testBones, testRole);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.stringContaining('sonnet'),
        max_tokens: 300,
      }),
    );
  });
});

describe('chat', () => {
  it('returns reply from simple text response', async () => {
    mockStream.mockReturnValue(createMockStream({
      content: [{ type: 'text', text: 'Hello! How can I help?' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 30 },
    }));

    const result = await chat(testClawmon, testRole, [], [], 'Hello!');
    expect(result.reply).toBe('Hello! How can I help?');
    expect(result.skillsUsed).toEqual([]);
  });

  it('processes tool use and returns final reply', async () => {
    // First call: model uses calculator
    mockStream.mockReturnValueOnce(createMockStream({
      content: [
        { type: 'text', text: '' },
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'calculator',
          input: { expression: '500 * 12', label: 'Annual savings' },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 200, output_tokens: 50 },
    }));

    // Second call: final response
    mockStream.mockReturnValueOnce(createMockStream({
      content: [{ type: 'text', text: 'That comes to 6,000 per year!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 300, output_tokens: 30 },
    }));

    const result = await chat(testClawmon, testRole, [], [], 'How much is 500/month?');
    expect(result.reply).toBe('That comes to 6,000 per year!');
    expect(result.skillsUsed).toContain('calculator');
  });

  it('includes memories in system prompt', async () => {
    mockStream.mockReturnValue(createMockStream({
      content: [{ type: 'text', text: 'Response' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 10 },
    }));

    const memories: MemoryEntry[] = [{
      name: 'Savings goal',
      description: 'Save 5000',
      type: 'goal',
      content: 'Owner wants to save €5,000',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }];

    await chat(testClawmon, testRole, memories, [], 'How am I doing?');
    const callArgs = mockStream.mock.calls[0]![0];
    expect(callArgs.system).toContain('Savings goal');
  });

  it('includes conversation history in messages', async () => {
    mockStream.mockReturnValue(createMockStream({
      content: [{ type: 'text', text: 'Response' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 10 },
    }));

    const history = [
      { role: 'user' as const, content: 'Previous message' },
      { role: 'assistant' as const, content: 'Previous response' },
    ];

    await chat(testClawmon, testRole, [], history, 'New message');
    const callArgs = mockStream.mock.calls[0]![0];
    expect(callArgs.messages).toHaveLength(3);
  });

  it('calls onSkillUse callback when skills are used', async () => {
    mockStream.mockReturnValueOnce(createMockStream({
      content: [{
        type: 'tool_use',
        id: 'tool_1',
        name: 'date_time',
        input: { operation: 'now' },
      }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 200, output_tokens: 50 },
    }));
    mockStream.mockReturnValueOnce(createMockStream({
      content: [{ type: 'text', text: 'Done' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 300, output_tokens: 10 },
    }));

    const onSkillUse = vi.fn();
    await chat(testClawmon, testRole, [], [], 'What time is it?', undefined, onSkillUse);
    expect(onSkillUse).toHaveBeenCalledWith('date_time', { operation: 'now' });
  });

  it('handles API errors', async () => {
    mockStream.mockImplementation(() => {
      throw new Error('API rate limit exceeded');
    });
    await expect(
      chat(testClawmon, testRole, [], [], 'Hello'),
    ).rejects.toThrow('API rate limit');
  });

  it('stops after max iterations', async () => {
    mockStream.mockReturnValue(createMockStream({
      content: [{
        type: 'tool_use',
        id: 'tool_x',
        name: 'date_time',
        input: { operation: 'now' },
      }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 200, output_tokens: 50 },
    }));

    const result = await chat(testClawmon, testRole, [], [], 'Loop forever');
    expect(result.reply).toContain('carried away');
    expect(mockStream).toHaveBeenCalledTimes(5);
  });

  it('handles save_note tool by writing to memory', async () => {
    mockStream.mockReturnValueOnce(createMockStream({
      content: [{
        type: 'tool_use',
        id: 'tool_1',
        name: 'save_note',
        input: { title: 'Budget goal', content: 'Save 5k', type: 'goal' },
      }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 200, output_tokens: 50 },
    }));
    mockStream.mockReturnValueOnce(createMockStream({
      content: [{ type: 'text', text: 'Noted!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 300, output_tokens: 10 },
    }));

    const { saveMemory } = await import('./memory/store.js');
    const result = await chat(testClawmon, testRole, [], [], 'Remember my goal');
    expect(result.skillsUsed).toContain('save_note');
    expect(saveMemory).toHaveBeenCalled();
  });
});
