import { describe, it, expect } from 'vitest';
import { calculatorSkill } from './calculator.js';

describe('calculator skill', () => {
  it('evaluates basic arithmetic', async () => {
    expect(await calculatorSkill.execute({ expression: '2 + 3' })).toBe('5');
    expect(await calculatorSkill.execute({ expression: '1200 * 12' })).toBe('14400');
  });

  it('evaluates compound interest expressions', async () => {
    const result = await calculatorSkill.execute({ expression: '5000 * (1.07 ** 10)' });
    expect(result).toMatch(/9835\.7/); // ~9835.76
  });

  it('includes label when provided', async () => {
    const result = await calculatorSkill.execute({
      expression: '500 * 12',
      label: 'Annual savings',
    });
    expect(result).toBe('Annual savings: 6000');
  });

  it('rejects expressions with forbidden characters', async () => {
    const result = await calculatorSkill.execute({ expression: 'process.exit(1)' });
    expect(result).toContain('Error');
  });

  it('handles Math.* functions', async () => {
    const result = await calculatorSkill.execute({ expression: 'Math.round(3.7)' });
    expect(result).toBe('4');
  });

  it('returns error for non-numeric results', async () => {
    const result = await calculatorSkill.execute({ expression: '0 / 0' });
    expect(result).toContain('Error');
  });

  it('rejects semicolons and assignment', async () => {
    const result = await calculatorSkill.execute({ expression: 'x=1; x' });
    expect(result).toContain('Error');
  });

  it('rejects backticks and template literals', async () => {
    const result = await calculatorSkill.execute({ expression: '`hello`' });
    expect(result).toContain('Error');
  });

  it('handles percentage calculations', async () => {
    const result = await calculatorSkill.execute({ expression: '1000 * 0.15' });
    expect(result).toBe('150');
  });

  it('handles negative numbers', async () => {
    const result = await calculatorSkill.execute({ expression: '-5 + 3' });
    expect(result).toBe('-2');
  });

  it('handles Math.floor', async () => {
    const result = await calculatorSkill.execute({ expression: 'Math.floor(3.9)' });
    expect(result).toBe('3');
  });

  it('handles Math.sqrt', async () => {
    const result = await calculatorSkill.execute({ expression: 'Math.sqrt(144)' });
    expect(result).toBe('12');
  });

  it('returns error for Infinity result', async () => {
    const result = await calculatorSkill.execute({ expression: '1 / 0' });
    expect(result).toContain('Error');
  });

  it('handles empty expression', async () => {
    const result = await calculatorSkill.execute({});
    expect(result).toContain('Error');
  });

  it('formats decimal results to 2 places', async () => {
    const result = await calculatorSkill.execute({ expression: '10 / 3' });
    expect(result).toBe('3.33');
  });
});
