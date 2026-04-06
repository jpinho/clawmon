import { describe, it, expect } from 'vitest';
import { renderSprite, renderFace } from './render.js';
import type { ClawmonBones } from '../types.js';

function makeBones(overrides: Partial<ClawmonBones> = {}): ClawmonBones {
  return {
    species: 'pyroclaw',
    rarity: 'common',
    eye: '◉',
    hat: 'none',
    shiny: false,
    stats: { INSIGHT: 50, CREATIVITY: 50, FOCUS: 50, EMPATHY: 50, WIT: 50 },
    ...overrides,
  };
}

describe('renderSprite', () => {
  it('returns exactly 5 lines', () => {
    const sprite = renderSprite(makeBones());
    expect(sprite).toHaveLength(5);
  });

  it('replaces {E} with the eye character', () => {
    const sprite = renderSprite(makeBones({ eye: '✦' }));
    const joined = sprite.join('');
    expect(joined).toContain('✦');
    expect(joined).not.toContain('{E}');
  });

  it('applies hat when rarity is not common', () => {
    const sprite = renderSprite(makeBones({ hat: 'crown', rarity: 'epic' }));
    // Crown hat line is '   \^^^/    '
    expect(sprite[0]).toContain('^^^');
  });

  it('does not apply hat for species with non-blank first line', () => {
    // ashphoenix has a non-blank first line
    const sprite = renderSprite(makeBones({ species: 'ashphoenix', hat: 'crown' }));
    expect(sprite[0]).not.toContain('^^^');
  });

  it('uses fallback sprite for unknown species', () => {
    const sprite = renderSprite(makeBones({ species: 'nonexistent' as any }));
    expect(sprite).toHaveLength(5);
    expect(sprite.join('')).toContain('◉');
  });
});

describe('renderFace', () => {
  it('returns species-specific faces', () => {
    expect(renderFace(makeBones({ species: 'termikitty', eye: '◉' }))).toBe('=◉w◉=');
    expect(renderFace(makeBones({ species: 'drakemaw', eye: '@' }))).toBe('<@~@>');
    expect(renderFace(makeBones({ species: 'owlette', eye: '·' }))).toBe('(·)(·)');
  });

  it('returns default face for species without special face', () => {
    expect(renderFace(makeBones({ species: 'compilox', eye: '×' }))).toBe('(××)');
  });

  it('returns capybrix face', () => {
    expect(renderFace(makeBones({ species: 'capybrix', eye: '◉' }))).toBe('(◉oo◉)');
  });

  it('returns spectrox face', () => {
    expect(renderFace(makeBones({ species: 'spectrox', eye: '✦' }))).toBe('/✦✦\\');
  });

  it('returns penguink face', () => {
    expect(renderFace(makeBones({ species: 'penguink', eye: '°' }))).toBe('(°>)');
  });
});
