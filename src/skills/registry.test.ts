import { describe, it, expect } from 'vitest';
import { createSkillRegistry, listAvailableSkills } from './registry.js';

describe('skill registry', () => {
  it('all roles get save_note and date_time by default', () => {
    const skills = listAvailableSkills('best-friend');
    expect(skills).toContain('save_note');
    expect(skills).toContain('date_time');
  });

  it('financial-advisor gets calculator and web_search', () => {
    const skills = listAvailableSkills('financial-advisor');
    expect(skills).toContain('calculator');
    expect(skills).toContain('web_search');
    expect(skills).toContain('save_note');
    expect(skills).toContain('date_time');
  });

  it('career-coach gets web_search but not calculator', () => {
    const skills = listAvailableSkills('career-coach');
    expect(skills).toContain('web_search');
    expect(skills).not.toContain('calculator');
  });

  it('unknown role still gets default skills', () => {
    const skills = listAvailableSkills('nonexistent-role');
    expect(skills).toContain('save_note');
    expect(skills).toContain('date_time');
    expect(skills).toHaveLength(2);
  });

  it('registry.execute returns error for unknown skill', async () => {
    const registry = createSkillRegistry('best-friend');
    const result = await registry.execute('nonexistent', {});
    expect(result).toContain('Unknown skill');
  });

  it('registry.getToolDefinitions returns correct structure', () => {
    const registry = createSkillRegistry('financial-advisor');
    const tools = registry.getToolDefinitions();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');
    }
  });
});
