import { describe, it, expect } from 'vitest';
import { noteTakerSkill } from './note-taker.js';

describe('note-taker skill', () => {
  it('returns formatted note acknowledgement', async () => {
    const result = await noteTakerSkill.execute({
      title: 'Savings goal',
      content: 'Save €5,000 by December',
      type: 'goal',
    });
    expect(result).toBe('Noted: [goal] Savings goal');
  });

  it('defaults to observation type when missing', async () => {
    const result = await noteTakerSkill.execute({
      title: 'Something noticed',
      content: 'Owner seems tired.',
    });
    expect(result).toBe('Noted: [observation] Something noticed');
  });

  it('handles missing title gracefully', async () => {
    const result = await noteTakerSkill.execute({
      content: 'Some content',
      type: 'fact',
    });
    expect(result).toBe('Noted: [fact] ');
  });
});
