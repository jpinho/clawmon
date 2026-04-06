import { describe, it, expect } from 'vitest';
import { getOwnerContext, formatContextForPrompt } from './context.js';

describe('getOwnerContext', () => {
  it('returns all required fields', () => {
    const ctx = getOwnerContext();
    expect(ctx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ctx.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(ctx.dayOfWeek).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    expect(ctx.timezone).toBeTruthy();
    expect(ctx.location).toBeTruthy();
    expect(ctx.locale).toBeTruthy();
    expect(typeof ctx.isLateNight).toBe('boolean');
    expect(typeof ctx.isWeekend).toBe('boolean');
  });
});

describe('formatContextForPrompt', () => {
  it('includes date, timezone, and location', () => {
    const prompt = formatContextForPrompt({
      date: '2026-04-06',
      time: '14:30:00',
      dayOfWeek: 'Sunday',
      timezone: 'Europe/Berlin',
      location: 'Germany',
      locale: 'en-DE',
      isLateNight: false,
      isWeekend: true,
    });
    expect(prompt).toContain('Sunday');
    expect(prompt).toContain('2026-04-06');
    expect(prompt).toContain('Germany');
    expect(prompt).toContain('weekend');
  });

  it('includes late night warning when applicable', () => {
    const prompt = formatContextForPrompt({
      date: '2026-04-06',
      time: '02:00:00',
      dayOfWeek: 'Sunday',
      timezone: 'Europe/Berlin',
      location: 'Germany',
      locale: 'en-DE',
      isLateNight: true,
      isWeekend: true,
    });
    expect(prompt).toContain('late at night');
  });
});
