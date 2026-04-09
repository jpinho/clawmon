#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, writeFile } from 'node:fs/promises';
import {
  initClawmonDir,
  isInitialized,
  loadConfig,
  saveConfig,
  findClawmonByName,
  uniqueClawmonId,
  renameClawmon,
  generateFamilyIdentity,
  listClawmons,
  listFamily,
  loadMemories,
  loadRecentConversation,
  saveConversation,
  updateClawmon,
  exportClawmon,
  importClawmon,
  saveClawmon,
} from './memory/store.js';
import { hatchClawmon, suggestRoles, displayRoleSuggestions, rollBones } from './hatch.js';
import { talkToClawmon, replWithClawmon } from './talk.js';
import { showClawmon } from './show.js';
import { renderSprite, renderFace } from './sprites/render.js';
import { getRole, ROLES, ROLE_CATEGORIES, getRolesByCategory } from './roles.js';
import { listAvailableSkills, createSkillRegistry } from './skills/registry.js';
import { chat, generateSoul, generateCustomRole, generateFamily } from './api.js';
import { debug as dbg } from './debug.js';
import { RARITY_STARS } from './types.js';
import type { Clawmon } from './types.js';

const program = new Command();

export let DEBUG = false;

export function debug(...args: unknown[]): void {
  if (DEBUG) console.log(chalk.gray(`  [debug]`), ...args);
}

program
  .name('clawmon')
  .description('Terminal-native persistent agent UX -- identity, memory, role specialization')
  .version('0.1.0')
  .option('--debug', 'Show verbose debug output')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().debug) {
      DEBUG = true;
      debug('Debug mode enabled');
      debug(`API key: ${process.env.ANTHROPIC_API_KEY ? 'set (' + process.env.ANTHROPIC_API_KEY.slice(0, 12) + '...)' : 'NOT SET'}`);
    }
  });

// --- init ---

program
  .command('init')
  .description('Set up ~/.clawmon/ directory')
  .action(async () => {
    if (isInitialized()) {
      console.log(chalk.dim('  ~/.clawmon/ already exists. You\'re good.'));
      return;
    }
    await initClawmonDir();
    console.log(chalk.green('  ~/.clawmon/ created. Ready to hatch!'));
  });

// --- config ---

program
  .command('config')
  .description('View or set configuration options')
  .argument('[key]', 'Config key to set (e.g. memoryRoot)')
  .argument('[value]', 'Value to set (use "reset" to clear)')
  .action(async (key?: string, value?: string) => {
    if (!isInitialized()) await initClawmonDir();
    const config = await loadConfig();

    if (!key) {
      console.log();
      console.log(chalk.bold('  Clawmon Config'));
      console.log();
      console.log(`  userId:     ${chalk.dim(config.userId)}`);
      console.log(`  memoryRoot: ${config.memoryRoot ? chalk.cyan(config.memoryRoot) : chalk.dim('~/.clawmon/ (default)')}`);
      console.log(`  clawmons:   ${chalk.dim(`${config.clawmons.length} hatched`)}`);
      console.log();
      console.log(chalk.dim('  Set Obsidian vault: clawmon config memoryRoot /path/to/vault/clawmon'));
      console.log(chalk.dim('  Reset to default:   clawmon config memoryRoot reset'));
      console.log();
      return;
    }

    if (key === 'memoryRoot') {
      if (!value) {
        console.log(config.memoryRoot ? `  memoryRoot: ${config.memoryRoot}` : chalk.dim('  memoryRoot: ~/.clawmon/ (default)'));
        return;
      }
      if (value === 'reset') {
        delete config.memoryRoot;
        await saveConfig(config);
        console.log(chalk.green('  Memory root reset to default (~/.clawmon/)'));
        return;
      }
      config.memoryRoot = value;
      await saveConfig(config);
      console.log(chalk.green(`  Memory root set to: ${value}`));
      console.log(chalk.dim('  New memories will be written there. Existing memories stay in ~/.clawmon/.'));
      return;
    }

    console.log(chalk.red(`  Unknown config key: "${key}"`));
    console.log(chalk.dim('  Available: memoryRoot'));
  });

// --- hatch (predefined role) ---

program
  .command('hatch')
  .description('Hatch a clawmon with a predefined role')
  .argument('[role]', 'Role ID (e.g. best-friend, financial-advisor)')
  .action(async (roleId?: string) => {
    if (!isInitialized()) await initClawmonDir();

    if (!roleId) {
      const suggestions = await suggestRoles();
      displayRoleSuggestions(suggestions);
      console.log(chalk.bold('  To hatch, pick a role:'));
      console.log(chalk.white('  clawmon hatch best-friend'));
      console.log(chalk.white('  clawmon hatch financial-advisor'));
      console.log();
      console.log(chalk.dim(`  ${ROLES.length} roles available. Run: clawmon roles`));
      console.log(chalk.dim('  Or use: clawmon spawn "describe what you need"'));
      console.log();
      return;
    }

    const config = await loadConfig();
    await hatchClawmon(config.userId, roleId, config.clawmons.length);
  });

// --- spawn (custom purpose) ---

program
  .command('spawn <purpose...>')
  .description('Spawn a clawmon from a natural language description (role evolves over time)')
  .action(async (purposeParts: string[]) => {
    if (!isInitialized()) await initClawmonDir();

    const purpose = purposeParts.join(' ');
    console.log();
    console.log(chalk.yellow('  ~~ Spawning Clawmon ~~'));
    console.log(chalk.dim(`  Purpose: ${purpose}`));
    console.log();

    const config = await loadConfig();
    const bones = rollBones(config.userId, config.clawmons.length);

    console.log(chalk.dim('  Generating companion...'));
    const { soul, customRole, skills } = await generateCustomRole(purpose);

    const sprite = renderSprite(bones);
    console.log();
    for (const line of sprite) console.log('  ' + line);
    console.log();

    const rarityColor = bones.rarity === 'legendary' ? chalk.yellow
      : bones.rarity === 'epic' ? chalk.magenta
      : bones.rarity === 'rare' ? chalk.cyan
      : bones.rarity === 'uncommon' ? chalk.green
      : chalk.white;

    console.log(`  Species: ${chalk.bold(bones.species)} ${rarityColor(`(${bones.rarity})`)}`);
    console.log(`  Name: ${chalk.bold.white(soul.name)}`);
    console.log(`  Role: ${chalk.cyan(customRole.currentRole)}`);
    console.log(`  ${chalk.dim(soul.personality)}`);
    console.log();
    console.log(`  ${chalk.italic(`"${soul.catchphrase}"`)}`);
    console.log();
    console.log(chalk.dim(`  ${customRole.currentDescription}`));
    console.log(chalk.dim(`  Cadence: ${customRole.cadence} | Skills: ${skills.join(', ')}`));
    console.log(chalk.dim('  Role will evolve as your situation changes.'));
    console.log();

    const id = await uniqueClawmonId(soul.name);
    const clawmon: Clawmon = {
      id, bones, soul,
      roleId: 'custom',
      customRole,
      customSkills: skills,
      hatchedAt: new Date().toISOString(),
      interactions: 0,
    };

    await saveClawmon(clawmon);
    console.log(chalk.green(`  [${soul.name} has been spawned!]`));
    console.log(chalk.dim(`  Talk: clawmon chat ${id}`));
    console.log();
  });

// --- spawn-family ---

program
  .command('spawn-family <purpose...>')
  .description('Spawn a family of clawmons that work together on a broad goal')
  .option('-n, --count <number>', 'Number of clawmons (2-15)', '5')
  .action(async (purposeParts: string[], opts: { count: string }) => {
    if (!isInitialized()) await initClawmonDir();

    const purpose = purposeParts.join(' ');
    const count = Math.min(15, Math.max(2, parseInt(opts.count) || 5));

    console.log();
    console.log(chalk.yellow(`  ~~ Spawning Family of ${count} ~~`));
    console.log(chalk.dim(`  Purpose: ${purpose}`));
    console.log();
    console.log(chalk.dim('  Generating family...'));

    const config = await loadConfig();
    const family = await generateFamily(purpose, count);

    if (family.length === 0) {
      console.log(chalk.red('  Failed to generate family. Try a more specific description.'));
      return;
    }

    const { familyId, familyName } = generateFamilyIdentity(purpose);
    const batchIds = new Set<string>();
    console.log();
    console.log(chalk.bold(`  Family: ${familyName}`));
    console.log(chalk.dim(`  ID: ${familyId}`));
    console.log();

    for (let i = 0; i < family.length; i++) {
      const { soul, customRole, skills } = family[i]!;
      const bones = rollBones(config.userId, config.clawmons.length + i);
      const id = await uniqueClawmonId(soul.name, batchIds);

      const clawmon: Clawmon = {
        id, bones, soul,
        roleId: 'custom',
        customRole,
        customSkills: skills,
        familyId,
        familyName,
        hatchedAt: new Date().toISOString(),
        interactions: 0,
      };

      await saveClawmon(clawmon);

      const face = renderFace(bones);
      const rarityColor = bones.rarity === 'legendary' ? chalk.yellow
        : bones.rarity === 'epic' ? chalk.magenta
        : bones.rarity === 'rare' ? chalk.cyan
        : bones.rarity === 'uncommon' ? chalk.green
        : chalk.white;

      console.log(`  ${face} ${chalk.bold(soul.name)} ${rarityColor(`(${bones.rarity})`)} -- ${chalk.cyan(customRole.currentRole)}`);
      console.log(chalk.dim(`     ${customRole.currentDescription}`));
      console.log();
    }

    console.log(chalk.green(`  [Family of ${family.length} spawned!]`));
    console.log(chalk.dim(`  Talk to all: clawmon talk-family ${familyId} "message"`));
    console.log(chalk.dim(`  Chat with one: clawmon chat <name>`));
    console.log();
  });

// --- talk-family ---

program
  .command('talk-family <family-id> <message...>')
  .description('Talk to all clawmons in a family at once -- roundtable discussion')
  .action(async (familyId: string, messageParts: string[]) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const message = messageParts.join(' ');
    let members: Clawmon[];

    if (familyId === 'all') {
      members = await listClawmons();
    } else {
      members = await listFamily(familyId);
    }

    if (members.length === 0) {
      console.log(chalk.red(`  No clawmons found in "${familyId}".`));
      return;
    }

    console.log();
    console.log(chalk.bold(`  Family Discussion (${members.length} members)`));
    console.log(chalk.dim(`  > "${message}"`));
    console.log();

    // Query each in parallel
    const promises = members.map(async (clawmon) => {
      const role = getRole(clawmon.roleId);
      const memories = await loadMemories(clawmon.id);
      const history = await loadRecentConversation(clawmon.id, 5);

      const familyContext = `You are in a group discussion with ${members.length - 1} other companions. Keep your response brief (1-3 sentences). Focus on YOUR unique perspective.`;
      const fullMessage = `${familyContext}\n\nThe owner says: "${message}"`;

      const result = await chat(clawmon, role, memories, history, fullMessage);

      await saveConversation(clawmon.id, [
        { role: 'user', content: message },
        { role: 'assistant', content: result.reply },
      ]);

      clawmon.interactions += 1;
      await updateClawmon(clawmon);

      return { clawmon, reply: result.reply };
    });

    const results = await Promise.all(promises);

    for (const r of results) {
      const face = renderFace(r.clawmon.bones);
      const roleName = r.clawmon.customRole?.currentRole ?? getRole(r.clawmon.roleId)?.name ?? '';
      console.log(`  ${face} ${chalk.bold(r.clawmon.soul.name)} ${chalk.dim(`(${roleName})`)}`);
      console.log(`  ${r.reply}`);
      console.log();
    }
  });

// --- chat (REPL) ---

program
  .command('chat [name]')
  .description('Open an interactive conversation with a clawmon')
  .action(async (name?: string) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    let clawmon;
    if (name) {
      clawmon = await findClawmonByName(name);
      if (!clawmon) {
        console.log(chalk.red(`  Clawmon "${name}" not found.`));
        const all = await listClawmons();
        if (all.length > 0) console.log(chalk.dim(`  Available: ${all.map(c => c.soul.name).join(', ')}`));
        return;
      }
    } else {
      const all = await listClawmons();
      if (all.length === 0) {
        console.log(chalk.dim('  No clawmons yet. Run: clawmon hatch'));
        return;
      }
      clawmon = all[0]!;
    }

    await replWithClawmon(clawmon);
  });

// --- talk (one-shot) ---

program
  .command('talk <name> <message...>')
  .description('Send a single message to a clawmon')
  .action(async (name: string, messageParts: string[]) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      console.log(chalk.red(`  Clawmon "${name}" not found.`));
      const all = await listClawmons();
      if (all.length > 0) console.log(chalk.dim(`  Available: ${all.map(c => c.soul.name).join(', ')}`));
      return;
    }

    await talkToClawmon(clawmon, messageParts.join(' '));
  });

// --- show ---

program
  .command('show <name>')
  .description('Display a clawmon\'s card (sprite, stats, role, personality)')
  .action(async (name: string) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      console.log(chalk.red(`  Clawmon "${name}" not found.`));
      return;
    }

    await showClawmon(clawmon);
  });

// --- notes ---

program
  .command('notes <name>')
  .description('Show what a clawmon has observed and remembered')
  .action(async (name: string) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      console.log(chalk.red(`  Clawmon "${name}" not found.`));
      return;
    }

    const memories = await loadMemories(clawmon.id);
    if (memories.length === 0) {
      console.log(chalk.dim(`  ${clawmon.soul.name} hasn't collected any notes yet.`));
      return;
    }

    console.log();
    console.log(chalk.bold(`  ${clawmon.soul.name}'s Notes (${memories.length})`));
    console.log();

    for (const m of memories) {
      const typeColor = m.type === 'goal' ? chalk.green
        : m.type === 'pattern' ? chalk.yellow
        : m.type === 'preference' ? chalk.cyan
        : m.type === 'insight' ? chalk.magenta
        : chalk.dim;
      console.log(`  ${typeColor(`[${m.type}]`)} ${m.name}`);
      console.log(`  ${chalk.dim(m.content)}`);
      console.log();
    }
  });

// --- family (was council) ---

program
  .command('family')
  .alias('list')
  .description('See all your clawmons')
  .action(async () => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmons = await listClawmons();
    if (clawmons.length === 0) {
      console.log();
      console.log(chalk.dim('  No clawmons yet.'));
      console.log(chalk.dim('  clawmon hatch best-friend'));
      console.log(chalk.dim('  clawmon spawn "help me with my career"'));
      console.log(chalk.dim('  clawmon spawn-family "starting a business" -n 5'));
      console.log();
      return;
    }

    // Group by family
    const families = new Map<string, Clawmon[]>();
    const solo: Clawmon[] = [];

    for (const c of clawmons) {
      if (c.familyId) {
        const group = families.get(c.familyId) ?? [];
        group.push(c);
        families.set(c.familyId, group);
      } else {
        solo.push(c);
      }
    }

    console.log();
    console.log(chalk.bold(`  Your Family (${clawmons.length}/30)`));
    console.log();

    // Solo clawmons
    for (const c of solo) {
      printClawmonLine(c);
    }

    // Grouped families
    for (const [fid, members] of families) {
      const purpose = members[0]?.customRole?.purpose ?? '';
      console.log(chalk.bold(`  --- ${fid} ---`));
      if (purpose) console.log(chalk.dim(`  Purpose: ${purpose}`));
      console.log();
      for (const c of members) {
        printClawmonLine(c);
      }
    }
  });

function printClawmonLine(c: Clawmon) {
  const role = getRole(c.roleId);
  const rarityColor = c.bones.rarity === 'legendary' ? chalk.yellow
    : c.bones.rarity === 'epic' ? chalk.magenta
    : c.bones.rarity === 'rare' ? chalk.cyan
    : c.bones.rarity === 'uncommon' ? chalk.green
    : chalk.white;

  const roleName = c.customRole?.currentRole ?? role?.name ?? '';
  const roleDesc = c.customRole?.currentDescription ?? role?.description ?? '';
  const evolved = c.customRole?.evolution.length ? chalk.yellow(` (evolved ${c.customRole.evolution.length}x)`) : '';

  console.log(`  ${chalk.bold(c.soul.name)} ${chalk.dim(`(${c.bones.species})`)} ${rarityColor(c.bones.rarity)}${evolved}`);
  if (roleName) console.log(`  ${chalk.cyan(roleName)} -- ${chalk.dim(roleDesc)}`);
  console.log(`  ${chalk.dim(`${c.interactions} interactions | Hatched ${c.hatchedAt.split('T')[0]}`)}`);
  console.log();
}

// --- roles ---

program
  .command('roles')
  .description('List available predefined roles')
  .action(async () => {
    const existing = await listClawmons().catch(() => []);
    const takenRoleIds = new Set(existing.map(c => c.roleId));

    console.log(chalk.bold('\n  Available Roles\n'));

    for (const role of ROLES) {
      const taken = takenRoleIds.has(role.id);
      const prefix = taken ? chalk.dim('  ✓') : chalk.white('  ○');
      const name = taken ? chalk.dim(role.name) : chalk.bold(role.name);
      const id = taken ? chalk.dim(`(${role.id})`) : chalk.cyan(`(${role.id})`);

      console.log(`${prefix} ${name} ${id}`);
      console.log(`    ${role.description}`);
      if (!taken) console.log(chalk.dim(`    ${role.whatItDoes}`));
      console.log();
    }

    if (takenRoleIds.size > 0) {
      console.log(chalk.dim(`  ✓ = already in your family (${takenRoleIds.size}/${ROLES.length})`));
      console.log();
    }
  });

// --- skills ---

program
  .command('skills <name>')
  .description('Show what skills a clawmon has')
  .action(async (name: string) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      console.log(chalk.red(`  Clawmon "${name}" not found.`));
      return;
    }

    const role = getRole(clawmon.roleId);
    const registry = createSkillRegistry(clawmon.roleId, clawmon.customSkills);

    console.log();
    console.log(chalk.bold(`  ${clawmon.soul.name}'s Skills`));
    if (role) console.log(chalk.dim(`  Role: ${role.name}`));
    if (clawmon.customRole) console.log(chalk.dim(`  Role: ${clawmon.customRole.currentRole}`));
    console.log();

    for (const skill of registry.skills) {
      console.log(`  ${chalk.cyan(skill.name)}`);
      console.log(`  ${chalk.dim(skill.description)}`);
      console.log();
    }
  });

// --- shuffle ---

program
  .command('shuffle <name>')
  .description('Regenerate a clawmon\'s name and personality while keeping role, memories, and conversations')
  .action(async (name: string) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      console.log(chalk.red(`  Clawmon "${name}" not found.`));
      return;
    }

    const role = getRole(clawmon.roleId);
    console.log();
    console.log(chalk.yellow(`  Shuffling ${clawmon.soul.name}...`));

    let newSoul;
    if (role) {
      newSoul = await generateSoul(clawmon.bones, role);
    } else {
      const purpose = clawmon.customRole?.purpose ?? 'general companion';
      const result = await generateCustomRole(purpose);
      newSoul = result.soul;
    }

    const newId = await uniqueClawmonId(newSoul.name);
    const updated = await renameClawmon(clawmon.id, newId, newSoul);

    console.log(chalk.green(`  ${clawmon.soul.name} → ${updated.soul.name}`));
    console.log(chalk.dim(`  "${updated.soul.catchphrase}"`));
    console.log(chalk.dim(`  Memories and conversations preserved.`));
    console.log();
  });

// --- export ---

program
  .command('export <name>')
  .description('Export a clawmon to portable JSON')
  .option('-o, --out <file>', 'Output file path')
  .action(async (name: string, opts: { out?: string }) => {
    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      console.log(chalk.red(`  Clawmon "${name}" not found.`));
      return;
    }

    const json = await exportClawmon(clawmon.id);
    const outPath = opts.out ?? `${clawmon.id}.clawmon.json`;
    await writeFile(outPath, json);
    console.log(chalk.green(`  Exported ${clawmon.soul.name} to ${outPath}`));
  });

// --- import ---

program
  .command('import <file>')
  .description('Import a clawmon from JSON')
  .action(async (file: string) => {
    if (!isInitialized()) await initClawmonDir();
    const json = await readFile(file, 'utf-8');
    const clawmon = await importClawmon(json);
    console.log(chalk.green(`  Imported ${clawmon.soul.name}!`));
  });

// --- Routing: known command vs natural language ---

const knownCommands = new Set([
  'init', 'config', 'hatch', 'spawn', 'spawn-family', 'talk-family',
  'talk', 'chat', 'roles', 'show', 'notes', 'shuffle',
  'family', 'list', 'export', 'import', 'help', 'skills',
  '-V', '--version', '-h', '--help',
]);

const rawArgs = process.argv.slice(2);
const nonFlagArgs = rawArgs.filter(a => !a.startsWith('-'));
const firstNonFlag = nonFlagArgs[0];
const isNaturalLanguage = nonFlagArgs.length > 0 && firstNonFlag && !knownCommands.has(firstNonFlag);

if (rawArgs.includes('--debug')) DEBUG = true;

if (isNaturalLanguage) {
  (async () => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      process.exit(1);
    }

    const fullMessage = rawArgs.filter(a => a !== '--debug').join(' ');
    dbg(`Natural language input: "${fullMessage}"`);

    const mentionMatch = fullMessage.match(/@(\w+)/);
    dbg(`Mention match: ${mentionMatch ? mentionMatch[1] : 'none'}`);
    let clawmon;

    if (mentionMatch) {
      const mentionName = mentionMatch[1]!;
      clawmon = await findClawmonByName(mentionName);
      if (!clawmon) {
        console.log(chalk.red(`  Clawmon "${mentionName}" not found.`));
        const all = await listClawmons();
        if (all.length > 0) console.log(chalk.dim(`  Available: ${all.map(c => '@' + c.soul.name.toLowerCase()).join(', ')}`));
        process.exit(1);
      }
    } else {
      const all = await listClawmons();
      if (all.length === 0) {
        console.log(chalk.dim('  No clawmons yet. Run: clawmon hatch'));
        process.exit(1);
      }
      clawmon = all[0]!;
      console.log(chalk.dim(`  (routing to ${clawmon.soul.name})`));
    }

    const cleanMessage = fullMessage.replace(/@\w+\s*/, '').trim() || 'Hey!';
    await talkToClawmon(clawmon, cleanMessage);
  })();
} else {
  program.parse();
}
