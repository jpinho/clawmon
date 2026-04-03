import type { Skill, SkillRegistry } from './types.js';
import { calculatorSkill } from './calculator.js';
import { webSearchSkill } from './web-search.js';
import { dateTimeSkill } from './date-time.js';
import { noteTakerSkill } from './note-taker.js';

// All available skills
const ALL_SKILLS: Skill[] = [
  calculatorSkill,
  webSearchSkill,
  dateTimeSkill,
  noteTakerSkill,
];

// Which skills each role gets access to
// All clawmons get note-taker and date-time. Role determines bonus skills.
const ROLE_SKILLS: Record<string, string[]> = {
  // Everyone gets these
  _default: ['save_note', 'date_time'],

  // Financial roles need math and web
  'financial-advisor': ['calculator', 'web_search'],

  // Career coach needs web for job market info
  'career-coach': ['web_search'],

  // Learning guide needs web for resources
  'learning-guide': ['web_search'],

  // Creative muse needs web for inspiration
  'creative-muse': ['web_search'],

  // Strategist needs math for goal tracking
  'strategist': ['calculator'],

  // Dream tracker needs math for progress
  'dream-tracker': ['calculator'],

  // Sleep guardian needs date/time (already default)
  'sleep-guardian': [],

  // Social connector needs date/time for birthdays
  'social-connector': [],

  // Chaos agent gets everything -- chaos!
  'chaos-agent': ['calculator', 'web_search'],
};

export function createSkillRegistry(roleId: string): SkillRegistry {
  const defaultSkills = ROLE_SKILLS['_default'] ?? [];
  const roleSkills = ROLE_SKILLS[roleId] ?? [];
  const enabledNames = new Set([...defaultSkills, ...roleSkills]);

  const skills = ALL_SKILLS.filter(s => enabledNames.has(s.name));

  return {
    skills,

    getToolDefinitions() {
      return skills.map(s => ({
        name: s.name,
        description: s.description,
        input_schema: s.inputSchema,
      }));
    },

    async execute(name: string, input: Record<string, unknown>): Promise<string> {
      const skill = skills.find(s => s.name === name);
      if (!skill) return `Unknown skill: ${name}`;
      return skill.execute(input);
    },
  };
}

export function listAvailableSkills(roleId: string): string[] {
  const defaultSkills = ROLE_SKILLS['_default'] ?? [];
  const roleSkills = ROLE_SKILLS[roleId] ?? [];
  return [...new Set([...defaultSkills, ...roleSkills])];
}
