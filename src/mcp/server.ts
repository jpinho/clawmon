#!/usr/bin/env node

// Clawmon MCP Server -- exposes clawmon tools via Model Context Protocol.
// The primary interface when running inside an MCP-compatible host.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  initClawmonDir,
  isInitialized,
  loadConfig,
  listClawmons,
  findClawmonByName,
  loadMemories,
  loadRecentConversation,
  saveConversation,
  updateClawmon,
  exportClawmon,
  importClawmon,
  listFamily,
} from '../memory/store.js';
import { getRole, ROLES, ROLE_CATEGORIES, getRolesByCategory } from '../roles.js';
import { chat, generateCustomRole, generateFamily } from '../api.js';
import { hatchClawmon, suggestRoles, rollBones } from '../hatch.js';
import { renderSprite, renderFace } from '../sprites/render.js';
import { createSkillRegistry } from '../skills/registry.js';
import type { Clawmon, CustomRole } from '../types.js';
import { RARITY_STARS } from '../types.js';
import { saveClawmon as persistClawmon } from '../memory/store.js';

const server = new McpServer({
  name: 'clawmon',
  version: '0.1.0',
});

// --- Tool: hatch_clawmon ---

server.tool(
  'hatch_clawmon',
  'Hatch a new clawmon companion with a specific role. If no role provided, returns available roles to choose from. Each clawmon has a unique personality, species, stats, and skills based on their role.',
  {
    role: z.string().optional().describe('Role ID to assign (e.g. "financial-advisor", "best-friend", "career-coach"). Omit to see available roles.'),
  },
  async ({ role: roleId }) => {
    if (!isInitialized()) {
      await initClawmonDir();
    }

    // No role -- show suggestions
    if (!roleId) {
      const suggestions = await suggestRoles();
      const lines = ['**Who do you need in your life?**\n'];

      for (const r of suggestions) {
        const cat = ROLE_CATEGORIES.find(c => c.id === r.category);
        lines.push(`**${r.name}** (\`${r.id}\`) -- ${cat?.name}`);
        lines.push(`${r.description}`);
        lines.push(`*${r.exampleMessage}*\n`);
      }

      lines.push('---');
      lines.push('All roles:');
      for (const cat of ROLE_CATEGORIES) {
        const roles = getRolesByCategory(cat.id);
        lines.push(`**${cat.name}**: ${roles.map(r => `\`${r.id}\``).join(', ')}`);
      }
      lines.push('\nCall `hatch_clawmon` again with a role to hatch.');

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    const role = getRole(roleId);
    if (!role) {
      const allIds = ROLES.map(r => `\`${r.id}\``).join(', ');
      return { content: [{ type: 'text', text: `Unknown role: "${roleId}". Available: ${allIds}` }] };
    }

    // Hatch (suppresses console output since we're in MCP)
    const config = await loadConfig();
    const index = config.clawmons.length;

    // Redirect console temporarily for silent hatching
    const origLog = console.log;
    const logs: string[] = [];
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));

    try {
      const clawmon = await hatchClawmon(config.userId, roleId, index);
      console.log = origLog;

      const sprite = renderSprite(clawmon.bones);
      const face = renderFace(clawmon.bones);
      const rarityStars = RARITY_STARS[clawmon.bones.rarity];
      const stats = clawmon.bones.stats;

      const card = [
        '**~~ Clawmon Hatching Ceremony ~~**\n',
        '```',
        ...sprite,
        '```\n',
        `${rarityStars} **${clawmon.bones.rarity.toUpperCase()}** -- ${clawmon.bones.species}`,
        clawmon.bones.shiny ? '✨ **SHINY!**' : '',
        '',
        `# ${clawmon.soul.name}`,
        `**${role.name}**\n`,
        `*"${clawmon.soul.catchphrase}"*\n`,
        `${clawmon.soul.personality}\n`,
        `**What ${clawmon.soul.name} will do for you:**`,
        `${role.whatItDoes}\n`,
        `INSIGHT ${stats.INSIGHT} | CREATIVITY ${stats.CREATIVITY} | FOCUS ${stats.FOCUS} | EMPATHY ${stats.EMPATHY} | WIT ${stats.WIT}`,
        '',
        `Talk to ${clawmon.soul.name}: "Hey @${clawmon.soul.name.toLowerCase()}, ..."`,
      ].filter(Boolean).join('\n');

      return { content: [{ type: 'text', text: card }] };
    } catch (err) {
      console.log = origLog;
      throw err;
    }
  },
);

// --- Tool: spawn_clawmon (custom purpose) ---

server.tool(
  'spawn_clawmon',
  'Spawn a clawmon from a natural language description of what you need. Instead of picking a predefined role, describe your situation and a companion will be born for that exact purpose. Its role will evolve over time as your needs change. Example: "I need help going through a career change" or "support me with my fitness journey".',
  {
    purpose: z.string().describe('Describe what you need this companion for. Be specific about your situation.'),
  },
  async ({ purpose }) => {
    if (!isInitialized()) {
      await initClawmonDir();
    }

    const config = await loadConfig();
    const index = config.clawmons.length;
    const bones = rollBones(config.userId, index);

    const { soul, customRole, skills } = await generateCustomRole(purpose);

    const id = soul.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const clawmon: Clawmon = {
      id,
      bones,
      soul,
      roleId: 'custom',
      customRole,
      hatchedAt: new Date().toISOString(),
      interactions: 0,
    };

    await persistClawmon(clawmon);

    const sprite = renderSprite(clawmon.bones);
    const stats = clawmon.bones.stats;

    const card = [
      '**~~ Clawmon Spawned ~~**\n',
      '```',
      ...sprite,
      '```\n',
      `${RARITY_STARS[bones.rarity]} **${bones.rarity.toUpperCase()}** -- ${bones.species}`,
      '',
      `# ${soul.name}`,
      `**${customRole.currentRole}**\n`,
      `*"${soul.catchphrase}"*\n`,
      `${soul.personality}\n`,
      `**Purpose:** ${purpose}\n`,
      `**What ${soul.name} will do:** ${customRole.currentDescription}`,
      `**Cadence:** ${customRole.cadence}`,
      `**Skills:** ${skills.join(', ')}\n`,
      `INSIGHT ${stats.INSIGHT} | CREATIVITY ${stats.CREATIVITY} | FOCUS ${stats.FOCUS} | EMPATHY ${stats.EMPATHY} | WIT ${stats.WIT}\n`,
      `*${soul.name}'s role will evolve as your situation changes.*`,
      `Talk to ${soul.name}: "Hey @${soul.name.toLowerCase()}, ..."`,
    ].filter(Boolean).join('\n');

    return { content: [{ type: 'text', text: card }] };
  },
);

// --- Tool: spawn_family ---

server.tool(
  'spawn_family',
  'Spawn a family of clawmons that work together to support a broad goal. Describe what you need and how many companions (up to 15), and a team will be generated where each member covers a different angle. Example: "I\'m starting a business" with count 5 would create a financial planner, a motivation coach, a strategy advisor, a networking buddy, and a work-life balance guardian.',
  {
    purpose: z.string().describe('The overall goal or life situation this family of clawmons should support'),
    count: z.number().min(2).max(15).default(5).describe('How many clawmons to spawn (2-15, default 5)'),
  },
  async ({ purpose, count }) => {
    if (!isInitialized()) {
      await initClawmonDir();
    }

    const config = await loadConfig();
    const family = await generateFamily(purpose, count);

    if (family.length === 0) {
      return { content: [{ type: 'text', text: 'Failed to generate family. Try a more specific description.' }] };
    }

    const familyId = `family-${Date.now().toString(36)}`;
    const results: string[] = [`**~~ Family Spawned: ${family.length} Clawmons ~~**\n`];
    results.push(`Family: \`${familyId}\``);
    results.push(`Purpose: *${purpose}*\n`);

    for (let i = 0; i < family.length; i++) {
      const { soul, customRole, skills } = family[i]!;
      const index = config.clawmons.length + i;
      const bones = rollBones(config.userId, index);

      const id = soul.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const clawmon: Clawmon = {
        id,
        bones,
        soul,
        roleId: 'custom',
        customRole,
        familyId,
        hatchedAt: new Date().toISOString(),
        interactions: 0,
      };

      await persistClawmon(clawmon);

      const face = renderFace(bones);
      results.push(`${face} **${soul.name}** -- ${customRole.currentRole} (${bones.species}, ${bones.rarity})`);
      results.push(`  ${customRole.currentDescription}`);
      results.push(`  Cadence: ${customRole.cadence} | Skills: ${skills.join(', ')}`);
      results.push('');
    }

    results.push(`*Each clawmon's role will evolve as your situation changes.*`);
    results.push(`Talk to any of them: "Hey @name, ..."`);

    return { content: [{ type: 'text', text: results.join('\n') }] };
  },
);

// --- Tool: talk_to_clawmon ---

server.tool(
  'talk_to_clawmon',
  'Talk to one of your clawmon companions. They have personality, memory, and skills. They remember conversations across sessions. Use this whenever the user wants to talk to a clawmon or @mentions one by name.',
  {
    name: z.string().optional().describe('Name of the clawmon (e.g. "penny", "milo"). Leave empty for default.'),
    message: z.string().describe('What to say to the clawmon'),
  },
  async ({ name, message }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'No clawmons yet. Use `hatch_clawmon` to create your first companion.' }] };
    }

    let clawmon: Clawmon | null = null;

    if (name) {
      clawmon = await findClawmonByName(name);
      if (!clawmon) {
        const all = await listClawmons();
        const names = all.map(c => `@${c.soul.name.toLowerCase()}`).join(', ');
        return { content: [{ type: 'text', text: `Clawmon "${name}" not found. Available: ${names}` }] };
      }
    } else {
      const all = await listClawmons();
      if (all.length === 0) {
        return { content: [{ type: 'text', text: 'No clawmons yet. Use `hatch_clawmon` to create your first companion.' }] };
      }
      clawmon = all[0]!;
    }

    const role = getRole(clawmon.roleId);
    const memories = await loadMemories(clawmon.id);
    const history = await loadRecentConversation(clawmon.id, 10);

    const result = await chat(clawmon, role, memories, history, message);

    await saveConversation(clawmon.id, [
      { role: 'user', content: message },
      { role: 'assistant', content: result.reply },
    ]);

    clawmon.interactions += 1;
    await updateClawmon(clawmon);

    const face = renderFace(clawmon.bones);
    const roleName = role ? ` (${role.name})` : '';
    const skills = result.skillsUsed.length > 0
      ? `\n\n*Skills used: ${[...new Set(result.skillsUsed)].join(', ')}*`
      : '';

    return {
      content: [{
        type: 'text',
        text: `${face} **${clawmon.soul.name}**${roleName}\n\n${result.reply}${skills}`,
      }],
    };
  },
);

// --- Tool: talk_to_family ---

server.tool(
  'talk_to_family',
  'Talk to all clawmons in a family at once. Each responds from their own perspective. Use when the user wants collective input from their family of companions -- like a roundtable discussion. You can address a specific family by ID, or if the user only has one family, it will be used automatically.',
  {
    message: z.string().describe('What to say to the family'),
    family_id: z.string().optional().describe('Family ID (e.g. "family-m5k2j"). Omit to address all clawmons.'),
  },
  async ({ message, family_id }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'No clawmons yet.' }] };
    }

    let members: Clawmon[];

    if (family_id) {
      members = await listFamily(family_id);
      if (members.length === 0) {
        return { content: [{ type: 'text', text: `No clawmons found in family "${family_id}".` }] };
      }
    } else {
      // All clawmons
      members = await listClawmons();
      if (members.length === 0) {
        return { content: [{ type: 'text', text: 'No clawmons yet.' }] };
      }
    }

    const responses: string[] = [`**Family Discussion** (${members.length} members)\n`];
    responses.push(`> "${message}"\n`);

    // Query each clawmon in parallel
    const promises = members.map(async (clawmon) => {
      const role = getRole(clawmon.roleId);
      const memories = await loadMemories(clawmon.id);
      const history = await loadRecentConversation(clawmon.id, 5);

      // Add family context so each clawmon knows others are responding too
      const familyContext = `You are in a group discussion with ${members.length - 1} other companions. Keep your response brief (1-3 sentences) -- others are also responding. Focus on YOUR unique perspective based on your role.`;
      const fullMessage = `${familyContext}\n\nThe owner says: "${message}"`;

      const result = await chat(clawmon, role, memories, history, fullMessage);

      await saveConversation(clawmon.id, [
        { role: 'user', content: message },
        { role: 'assistant', content: result.reply },
      ]);

      clawmon.interactions += 1;
      await updateClawmon(clawmon);

      const face = renderFace(clawmon.bones);
      const roleName = clawmon.customRole?.currentRole ?? role?.name ?? '';

      return { name: clawmon.soul.name, face, roleName, reply: result.reply };
    });

    const results = await Promise.all(promises);

    for (const r of results) {
      responses.push(`${r.face} **${r.name}** (${r.roleName})`);
      responses.push(`${r.reply}\n`);
    }

    return { content: [{ type: 'text', text: responses.join('\n') }] };
  },
);

// --- Tool: show_clawmon ---

server.tool(
  'show_clawmon',
  "Display a clawmon's full profile card with ASCII sprite, stats, personality, role, and memory count. Use when the user wants to see a clawmon's details.",
  {
    name: z.string().describe('Name of the clawmon'),
  },
  async ({ name }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'No clawmons yet.' }] };
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      return { content: [{ type: 'text', text: `Clawmon "${name}" not found.` }] };
    }

    const role = getRole(clawmon.roleId);
    const memories = await loadMemories(clawmon.id);
    const sprite = renderSprite(clawmon.bones);
    const stats = clawmon.bones.stats;

    const statBar = (val: number) => {
      const filled = Math.round((val / 100) * 15);
      return '█'.repeat(filled) + '░'.repeat(15 - filled);
    };

    const card = [
      `${RARITY_STARS[clawmon.bones.rarity]}  **${clawmon.bones.rarity.toUpperCase()}**${' '.repeat(Math.max(0, 24 - clawmon.bones.rarity.length))}${clawmon.bones.species.toUpperCase()}`,
      clawmon.bones.shiny ? '✨ SHINY' : '',
      '',
      '```',
      ...sprite,
      '```',
      '',
      `**${clawmon.soul.name}**`,
      role ? role.name : '',
      '',
      `*"${clawmon.soul.personality}"*`,
      '',
      `\`INSIGHT     ${statBar(stats.INSIGHT)}  ${String(stats.INSIGHT).padStart(3)}\``,
      `\`CREATIVITY  ${statBar(stats.CREATIVITY)}  ${String(stats.CREATIVITY).padStart(3)}\``,
      `\`FOCUS       ${statBar(stats.FOCUS)}  ${String(stats.FOCUS).padStart(3)}\``,
      `\`EMPATHY     ${statBar(stats.EMPATHY)}  ${String(stats.EMPATHY).padStart(3)}\``,
      `\`WIT         ${statBar(stats.WIT)}  ${String(stats.WIT).padStart(3)}\``,
      '',
      `Notes: ${memories.length} | Interactions: ${clawmon.interactions} | Hatched: ${clawmon.hatchedAt.split('T')[0]}`,
    ].filter(Boolean).join('\n');

    return { content: [{ type: 'text', text: card }] };
  },
);

// --- Tool: family ---

server.tool(
  'family',
  "List all clawmons in your family with their names, species, roles, stats, and interaction counts. Use when the user asks to see their clawmons, their family, or who they've hatched.",
  {},
  async () => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'No clawmons yet. Use `hatch_clawmon` or `spawn_clawmon` to get started.' }] };
    }

    const clawmons = await listClawmons();
    if (clawmons.length === 0) {
      return { content: [{ type: 'text', text: 'Your family is empty. Use `hatch_clawmon` or `spawn_family` to get started.' }] };
    }

    const lines = [`**Your Family (${clawmons.length}/30)**\n`];

    for (const c of clawmons) {
      const role = getRole(c.roleId);
      const face = renderFace(c.bones);
      const stars = RARITY_STARS[c.bones.rarity];
      const roleName = c.customRole ? c.customRole.currentRole : role?.name ?? '';
      const roleDesc = c.customRole ? c.customRole.currentDescription : role?.description ?? '';

      lines.push(`${face} **${c.soul.name}** -- ${c.bones.species} (${c.bones.rarity}) ${stars}`);
      if (roleName) lines.push(`  ${roleName}: ${roleDesc}`);
      if (c.customRole?.evolution.length) {
        lines.push(`  *Evolved ${c.customRole.evolution.length}x*`);
      }
      lines.push(`  ${c.interactions} interactions | Hatched ${c.hatchedAt.split('T')[0]}`);
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

// --- Tool: clawmon_notes ---

server.tool(
  'clawmon_notes',
  "See what a clawmon has observed and remembered about you. Use when the user asks what a clawmon knows, what it has noted, or what it remembers.",
  {
    name: z.string().describe('Name of the clawmon'),
  },
  async ({ name }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'No clawmons yet.' }] };
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
  "See what skills a clawmon has. Skills include calculator, web search, date/time, and note-taking. Different roles get different skills.",
  {
    name: z.string().describe('Name of the clawmon'),
  },
  async ({ name }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'No clawmons yet.' }] };
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

// --- Tool: clawmon_roles ---

server.tool(
  'clawmon_roles',
  'List all available roles that can be assigned when hatching a new clawmon. Shows which roles are already taken in your family.',
  {},
  async () => {
    const existing = await listClawmons().catch(() => []);
    const takenRoleIds = new Set(existing.map(c => c.roleId));

    const lines = ['**Available Roles**\n'];

    for (const cat of ROLE_CATEGORIES) {
      lines.push(`**${cat.name}** -- ${cat.description}`);
      const roles = getRolesByCategory(cat.id);
      for (const r of roles) {
        const taken = takenRoleIds.has(r.id);
        const prefix = taken ? '✓' : '○';
        lines.push(`  ${prefix} **${r.name}** (\`${r.id}\`): ${r.description}`);
      }
      lines.push('');
    }

    if (takenRoleIds.size > 0) {
      lines.push(`*✓ = already in your family (${takenRoleIds.size}/${ROLES.length})*`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
);

// --- Tool: clawmon_export ---

server.tool(
  'clawmon_export',
  'Export a clawmon to a portable JSON file. Use for backup or transferring to another machine.',
  {
    name: z.string().describe('Name of the clawmon to export'),
  },
  async ({ name }) => {
    if (!isInitialized()) {
      return { content: [{ type: 'text', text: 'No clawmons yet.' }] };
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      return { content: [{ type: 'text', text: `Clawmon "${name}" not found.` }] };
    }

    const json = await exportClawmon(clawmon.id);
    const outPath = `${clawmon.id}.clawmon.json`;
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outPath, json);

    return { content: [{ type: 'text', text: `Exported **${clawmon.soul.name}** to \`${outPath}\`` }] };
  },
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
