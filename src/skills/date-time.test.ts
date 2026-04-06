import { describe, it, expect } from 'vitest';
import { dateTimeSkill } from './date-time.js';

describe('date-time skill', () => {
  it('returns current date/time for "now" operation', async () => {
    const result = await dateTimeSkill.execute({ operation: 'now' });
    // Should contain a date in YYYY-MM-DD format and a day name
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(result).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
  });

  it('calculates days between two dates', async () => {
    const result = await dateTimeSkill.execute({
      operation: 'days_between',
      date1: '2026-01-01',
      date2: '2026-01-31',
    });
    expect(result).toBe('30 days');
  });

  it('calculates days until a future date', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const dateStr = future.toISOString().split('T')[0];
    const result = await dateTimeSkill.execute({
      operation: 'days_until',
      date1: dateStr,
    });
    // Rounding may produce 9 or 10 depending on time of day
    expect(result).toMatch(/\d+ days from now/);
  });

  it('shows days ago for past dates', async () => {
    const result = await dateTimeSkill.execute({
      operation: 'days_until',
      date1: '2020-01-01',
    });
    expect(result).toMatch(/days ago/);
  });

  it('returns day of week for a known date', async () => {
    // 2026-01-01 is a Thursday
    const result = await dateTimeSkill.execute({
      operation: 'day_of_week',
      date1: '2026-01-01',
    });
    expect(result).toBe('Thursday');
  });

  it('returns error for invalid date input', async () => {
    const result = await dateTimeSkill.execute({
      operation: 'days_between',
      date1: 'not-a-date',
      date2: '2026-01-01',
    });
    expect(result).toContain('Error');
  });

  it('returns error for unknown operation', async () => {
    const result = await dateTimeSkill.execute({ operation: 'bogus' });
    expect(result).toContain('Unknown operation');
  });
});
