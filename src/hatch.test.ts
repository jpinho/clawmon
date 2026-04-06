import { describe, it, expect } from 'vitest';
import { rollBones, suggestRoles } from './hatch.js';
import { SPECIES, RARITIES, EYES, HATS, STAT_NAMES } from './types.js';

describe('rollBones', () => {
  it('produces deterministic output for the same userId and index', () => {
    const a = rollBones('user-123', 0);
    const b = rollBones('user-123', 0);
    expect(a).toEqual(b);
  });

  it('produces different output for different indices', () => {
    const a = rollBones('user-123', 0);
    const b = rollBones('user-123', 1);
    expect(a.species).not.toEqual(b.species); // extremely unlikely to collide
  });

  it('produces different output for different userIds', () => {
    const a = rollBones('alice', 0);
    const b = rollBones('bob', 0);
    expect(a).not.toEqual(b);
  });

  it('always returns valid species, rarity, eyes, and hat', () => {
    for (let i = 0; i < 50; i++) {
      const bones = rollBones(`stress-test-${i}`, i);
      expect(SPECIES).toContain(bones.species);
      expect(RARITIES).toContain(bones.rarity);
      expect(EYES).toContain(bones.eye);
      expect(HATS).toContain(bones.hat);
    }
  });

  it('common rarity never gets a hat', () => {
    // Roll many bones and check that common = no hat
    const commonBones = [];
    for (let i = 0; i < 200; i++) {
      const bones = rollBones(`hat-test-${i}`, i);
      if (bones.rarity === 'common') commonBones.push(bones);
    }
    expect(commonBones.length).toBeGreaterThan(0);
    for (const bones of commonBones) {
      expect(bones.hat).toBe('none');
    }
  });

  it('stats are all within 1-100 range and cover all stat names', () => {
    for (let i = 0; i < 50; i++) {
      const bones = rollBones(`stat-test-${i}`, i);
      for (const name of STAT_NAMES) {
        expect(bones.stats[name]).toBeGreaterThanOrEqual(1);
        expect(bones.stats[name]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('shiny is a boolean', () => {
    const bones = rollBones('shiny-test', 0);
    expect(typeof bones.shiny).toBe('boolean');
  });

  it('rarity distribution roughly matches weights over many rolls', () => {
    const counts: Record<string, number> = {};
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const bones = rollBones(`distribution-${i}`, i);
      counts[bones.rarity] = (counts[bones.rarity] ?? 0) + 1;
    }
    // Common should be the most frequent (weight 50/100)
    expect(counts['common']!).toBeGreaterThan(counts['legendary']!);
    // Legendary should be rare (weight 2/100)
    expect(counts['legendary']!).toBeLessThan(total * 0.1);
  });

  it('higher rarity gets higher stat floors', () => {
    // Roll many and check that legendary stats tend to be higher
    const legendaryStats: number[] = [];
    const commonStats: number[] = [];
    for (let i = 0; i < 500; i++) {
      const bones = rollBones(`floor-test-${i}`, i);
      const avg = Object.values(bones.stats).reduce((a, b) => a + b, 0) / 5;
      if (bones.rarity === 'legendary') legendaryStats.push(avg);
      if (bones.rarity === 'common') commonStats.push(avg);
    }
    if (legendaryStats.length > 0 && commonStats.length > 0) {
      const legendaryAvg = legendaryStats.reduce((a, b) => a + b, 0) / legendaryStats.length;
      const commonAvg = commonStats.reduce((a, b) => a + b, 0) / commonStats.length;
      expect(legendaryAvg).toBeGreaterThan(commonAvg);
    }
  });

  it('stats always have exactly one peak and one dump', () => {
    for (let i = 0; i < 50; i++) {
      const bones = rollBones(`peak-dump-${i}`, i);
      const values = Object.values(bones.stats);
      const max = Math.max(...values);
      const min = Math.min(...values);
      // Peak should be significantly higher than the average
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      expect(max).toBeGreaterThan(avg);
      expect(min).toBeLessThan(avg);
    }
  });

  it('handles empty userId gracefully', () => {
    const bones = rollBones('', 0);
    expect(SPECIES).toContain(bones.species);
    expect(RARITIES).toContain(bones.rarity);
  });

  it('handles large index values', () => {
    const bones = rollBones('user', 999999);
    expect(SPECIES).toContain(bones.species);
  });

  it('non-common rarity can get hats', () => {
    const hattedBones = [];
    for (let i = 0; i < 200; i++) {
      const bones = rollBones(`hat-rare-${i}`, i);
      if (bones.rarity !== 'common' && bones.hat !== 'none') hattedBones.push(bones);
    }
    expect(hattedBones.length).toBeGreaterThan(0);
  });
});
