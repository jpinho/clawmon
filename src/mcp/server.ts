#!/usr/bin/env node

/**
 * Clawmon MCP Server
 *
 * Exposes your clawmon council as tools that Claude Code can call directly.
 * Register in ~/.claude/settings.json:
 *
 * "clawmon": {
 *   "command": "npx",
 *   "args": ["tsx", "/Users/<you>/meta/clawmon/src/mcp/server.ts"]
 * }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  isInitialized,
  listClawmons,
  findClawmonByName,
  loadMemories,
  loadRecentConversation,
  saveConversation,
  updateClawmon,
} from '../memory/store.js';
import { getRole, ROLES } from '../roles.js';
import { chat } from '../api.js';
import { renderSprite, renderFace } from '../sprites/render.js';
import { createSkillRegistry } from '../skills/registry.js';
import type { Clawmon } from '../types.js';
import { RARITY_STARS } from '../types.js';

const server = new McpServer({
  name: 'clawmon',
  version: '0.1.0',
});

// --- Tool: talk_to_clawmon ---

server.tool(
  'talk_to_clawmon',
  'Talk to one of your clawmon companions. They have personality, memory, and skills. Use @name to pick a specific clawmon, or leave name empty to talk to the first one. They remember conversations across sessions.',
  {
    name: z.string().optional().describe('Name of the clawmon to talk to (e.g. "penny", "milo"). Leave empty to talk to the default.'),
    message: z.string().describe('What you want to say to your clawmon'),
  },
  async ({ name, message }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'Clawmon not initialized. Run `clawmon init && clawmon hatch` first.' }] };
    }

    let clawmon: Clawmon | null = null;

    if (name) {
      clawmon = await findClawmonByName(name);
      if (!clawmon) {
        const all = await listClawmons();
        const names = all.map(c => c.soul.name).join(', ');
        return { content: [{ type: 'text', text: `Clawmon "${name}" not found. Available: ${names}` }] };
      }
    } else {
      const all = await listClawmons();
      if (all.length === 0) {
        return { content: [{ type: 'text', text: 'No clawmons hatched yet. Run `clawmon hatch` first.' }] };
      }
      clawmon = all[0]!;
    }

    const role = getRole(clawmon.roleId);
    const memories = await loadMemories(clawmon.id);
    const history = await loadRecentConversation(clawmon.id, 10);

    const result = await chat(clawmon, role, memories, history, message);

    // Save conversation
    await saveConversation(clawmon.id, [
      { role: 'user', content: message },
      { role: 'assistant', content: result.reply },
    ]);

    clawmon.interactions += 1;
    await updateClawmon(clawmon);

    const face = renderFace(clawmon.bones);
    const roleName = role ? ` (${role.name})` : '';
    const skills = result.skillsUsed.length > 0
      ? `\nSkills used: ${[...new Set(result.skillsUsed)].join(', ')}`
      : '';

    return {
      content: [{
        type: 'text',
        text: `${face} **${clawmon.soul.name}**${roleName}\n\n${result.reply}${skills}`,
      }],
    };
  },
);

// --- Tool: show_clawmon ---

server.tool(
  'show_clawmon',
  'Display a clawmon\'s profile card with their ASCII sprite, stats, personality, role, and memory count.',
  {
    name: z.string().describe('Name of the clawmon to show'),
  },
  async ({ name }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'Clawmon not initialized.' }] };
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      return { content: [{ type: 'text', text: `Clawmon "${name}" not found.` }] };
    }

    const role = getRole(clawmon.roleId);
    const memories = await loadMemories(clawmon.id);
    const sprite = renderSprite(clawmon.bones);
    const stats = clawmon.bones.stats;

    const card = [
      `**${clawmon.soul.name}** -- ${clawmon.bones.species} (${clawmon.bones.rarity}) ${RARITY_STARS[clawmon.bones.rarity]}`,
      role ? `Role: ${role.name} -- ${role.description}` : '',
      clawmon.bones.shiny ? '✨ SHINY' : '',
      '',
      '```',
      ...sprite,
      '```',
      '',
      `INSIGHT ${stats.INSIGHT} | CREATIVITY ${stats.CREATIVITY} | FOCUS ${stats.FOCUS} | EMPATHY ${stats.EMPATHY} | WIT ${stats.WIT}`,
      '',
      `*${clawmon.soul.personality}*`,
      '',
      `Notes: ${memories.length} | Interactions: ${clawmon.interactions} | Hatched: ${clawmon.hatchedAt.split('T')[0]}`,
    ].filter(Boolean).join('\n');

    return { content: [{ type: 'text', text: card }] };
  },
);

// --- Tool: council ---

server.tool(
  'council',
  'List all clawmons in your council with their names, species, roles, and stats.',
  {},
  async () => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'Clawmon not initialized.' }] };
    }

    const clawmons = await listClawmons();
    if (clawmons.length === 0) {
      return { content: [{ type: 'text', text: 'Your council is empty. Run `clawmon hatch` to get started.' }] };
    }

    const lines = [`**Your Council (${clawmons.length}/30)**\n`];

    for (const c of clawmons) {
      const role = getRole(c.roleId);
      const face = renderFace(c.bones);
      lines.push(`${face} **${c.soul.name}** -- ${c.bones.species} (${c.bones.rarity})`);
      if (role) lines.push(`  ${role.name}: ${role.description}`);
      lines.push(`  ${c.interactions} interactions | Hatched ${c.hatchedAt.split('T')[0]}`);
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

// --- Tool: clawmon_notes ---

server.tool(
  'clawmon_notes',
  'See what a clawmon has observed and remembered about you.',
  {
    name: z.string().describe('Name of the clawmon'),
  },
  async ({ name }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'Clawmon not initialized.' }] };
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      return { content: [{ type: 'text', text: `Clawmon "${name}" not found.` }] };
    }

    const memories = await loadMemories(clawmon.id);
    if (memories.length === 0) {
      return { content: [{ type: 'text', text: `${clawmon.soul.name} hasn't collected any notes yet. Talk to them first!` }] };
    }

    const lines = [`**${clawmon.soul.name}'s Notes (${memories.length})**\n`];
    for (const m of memories) {
      lines.push(`- [${m.type}] **${m.name}**: ${m.content}`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

// --- Tool: clawmon_skills ---

server.tool(
  'clawmon_skills',
  'See what skills a clawmon has available based on their role.',
  {
    name: z.string().describe('Name of the clawmon'),
  },
  async ({ name }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'Clawmon not initialized.' }] };
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      return { content: [{ type: 'text', text: `Clawmon "${name}" not found.` }] };
    }

    const role = getRole(clawmon.roleId);
    const registry = createSkillRegistry(clawmon.roleId);

    const lines = [`**${clawmon.soul.name}'s Skills**${role ? ` (${role.name})` : ''}\n`];
    for (const skill of registry.skills) {
      lines.push(`- **${skill.name}**: ${skill.description}`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
