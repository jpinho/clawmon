#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, writeFile } from 'node:fs/promises';
import {
  initClawmonDir,
  isInitialized,
  loadConfig,
  findClawmonByName,
  listClawmons,
  loadMemories,
  exportClawmon,
  importClawmon,
} from './memory/store.js';
import { hatchClawmon, suggestRoles, displayRoleSuggestions } from './hatch.js';
import { talkToClawmon, replWithClawmon } from './talk.js';
import { showClawmon } from './show.js';
import { renderSprite } from './sprites/render.js';
import { getRole, ROLES, formatRoleList } from './roles.js';
import { listAvailableSkills, createSkillRegistry } from './skills/registry.js';
import { debug as dbg } from './debug.js';

const program = new Command();

// Global debug flag
export let DEBUG = false;

export function debug(...args: unknown[]): void {
  if (DEBUG) console.log(chalk.gray(`  [debug]`), ...args);
}

program
  .name('clawmon')
  .description('Hatch AI companions that live in your terminal')
  .version('0.1.0')
  .option('--debug', 'Show verbose debug output')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().debug) {
      DEBUG = true;
      debug('Debug mode enabled');
      debug(`API key: ${process.env.ANTHROPIC_API_KEY ? 'set (' + process.env.ANTHROPIC_API_KEY.slice(0, 12) + '...)' : 'NOT SET'}`);
      debug(`Home: ${process.env.HOME}`);
      debug(`Node: ${process.version}`);
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
    console.log(chalk.dim('  Run: clawmon hatch'));
  });

// --- hatch ---

program
  .command('hatch')
  .description('Hatch a new clawmon companion')
  .argument('[role]', 'Role to assign (e.g., best-friend, financial-advisor)')
  .action(async (roleId?: string) => {
    if (!isInitialized()) {
      await initClawmonDir();
    }

    // If no role specified, show suggestions
    if (!roleId) {
      const suggestions = await suggestRoles();
      displayRoleSuggestions(suggestions);
      console.log(chalk.bold('  To hatch, pick a role:'));
      console.log(chalk.white('  clawmon hatch best-friend'));
      console.log(chalk.white('  clawmon hatch financial-advisor'));
      console.log(chalk.white('  clawmon hatch career-coach'));
      console.log();
      console.log(chalk.dim(`  ${ROLES.length} roles available. Run: clawmon roles`));
      console.log();
      return;
    }

    const config = await loadConfig();
    const index = config.clawmons.length;
    await hatchClawmon(config.userId, roleId, index);
  });

// --- roles ---

program
  .command('roles')
  .description('List all available roles')
  .action(async () => {
    const existing = await listClawmons().catch(() => []);
    const takenRoleIds = new Set(existing.map(c => c.roleId));

    console.log(chalk.bold('\n  Available Roles\n'));

    for (const role of ROLES) {
      const taken = takenRoleIds.has(role.id);
      const prefix = taken ? chalk.dim('  ✓') : chalk.white('  ○');
      const name = taken ? chalk.dim(role.name) : chalk.bold(role.name);
      const id = taken ? chalk.dim(`(${role.id})`) : chalk.cyan(`(${role.id})`);
      const desc = taken
        ? chalk.dim(role.description)
        : role.description;

      console.log(`${prefix} ${name} ${id}`);
      console.log(`    ${desc}`);
      if (!taken) {
        console.log(chalk.dim(`    ${role.whatItDoes}`));
      }
      console.log();
    }

    if (takenRoleIds.size > 0) {
      console.log(chalk.dim(`  ✓ = already in your council (${takenRoleIds.size}/${ROLES.length})`));
      console.log();
    }
  });

// --- talk (explicit) ---

program
  .command('talk <name> <message...>')
  .description('Talk to a specific clawmon')
  .action(async (name: string, messageParts: string[]) => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmon = await findClawmonByName(name);
    if (!clawmon) {
      console.log(chalk.red(`  Clawmon "${name}" not found.`));
      const all = await listClawmons();
      if (all.length > 0) {
        console.log(chalk.dim(`  Available: ${all.map(c => c.soul.name).join(', ')}`));
      }
      return;
    }

    const message = messageParts.join(' ');
    await talkToClawmon(clawmon, message);
  });

// --- chat (REPL) ---

program
  .command('chat [name]')
  .description('Open a conversation with a clawmon (interactive REPL)')
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
        if (all.length > 0) {
          console.log(chalk.dim(`  Available: ${all.map(c => c.soul.name).join(', ')}`));
        }
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

// --- show ---

program
  .command('show <name>')
  .description('Display a clawmon\'s sprite, stats, and info')
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
  .description('Show a clawmon\'s collected observations')
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
      console.log(chalk.dim(`  Talk to them: clawmon talk ${clawmon.id} "Hello!"`));
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

// --- council (list with roles) ---

program
  .command('council')
  .alias('list')
  .description('See your council of clawmons')
  .action(async () => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      return;
    }

    const clawmons = await listClawmons();
    if (clawmons.length === 0) {
      console.log();
      console.log(chalk.dim('  Your council is empty.'));
      console.log(chalk.dim('  Run: clawmon hatch'));
      console.log();
      return;
    }

    console.log();
    console.log(chalk.bold(`  Your Council (${clawmons.length}/30)`));
    console.log();

    for (const c of clawmons) {
      const role = getRole(c.roleId);
      const rarityColor = c.bones.rarity === 'legendary' ? chalk.yellow
        : c.bones.rarity === 'epic' ? chalk.magenta
        : c.bones.rarity === 'rare' ? chalk.cyan
        : c.bones.rarity === 'uncommon' ? chalk.green
        : chalk.white;

      console.log(`  ${chalk.bold(c.soul.name)} ${chalk.dim(`(${c.bones.species})`)} ${rarityColor(c.bones.rarity)}`);
      if (role) {
        console.log(`  ${chalk.cyan(role.name)} -- ${chalk.dim(role.description)}`);
      }
      console.log(`  ${chalk.dim(`${c.interactions} interactions | Hatched ${c.hatchedAt.split('T')[0]}`)}`);
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
    const registry = createSkillRegistry(clawmon.roleId);

    console.log();
    console.log(chalk.bold(`  ${clawmon.soul.name}'s Skills`));
    if (role) console.log(chalk.dim(`  Role: ${role.name}`));
    console.log();

    for (const skill of registry.skills) {
      console.log(`  ${chalk.cyan(skill.name)}`);
      console.log(`  ${chalk.dim(skill.description)}`);
      console.log();
    }

    if (registry.skills.length === 0) {
      console.log(chalk.dim('  No skills yet.'));
    }
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
    const outPath = opts.out ?? `${clawmon.id}.json`;
    await writeFile(outPath, json);
    console.log(chalk.green(`  Exported ${clawmon.soul.name} to ${outPath}`));
  });

// --- import ---

program
  .command('import <file>')
  .description('Import a clawmon from JSON')
  .action(async (file: string) => {
    if (!isInitialized()) {
      await initClawmonDir();
    }

    const json = await readFile(file, 'utf-8');
    const clawmon = await importClawmon(json);
    console.log(chalk.green(`  Imported ${clawmon.soul.name}!`));
  });

// --- Routing: known command vs natural language ---

const knownCommands = new Set([
  'init', 'hatch', 'talk', 'chat', 'roles', 'show', 'notes',
  'council', 'list', 'export', 'import', 'help', 'skills',
  '-V', '--version', '-h', '--help',
]);

const rawArgs = process.argv.slice(2);
const nonFlagArgs = rawArgs.filter(a => !a.startsWith('-'));
const firstNonFlag = nonFlagArgs[0];
const isNaturalLanguage = nonFlagArgs.length > 0 && firstNonFlag && !knownCommands.has(firstNonFlag);

if (rawArgs.includes('--debug')) DEBUG = true;

if (isNaturalLanguage) {
  // Natural language -- treat the whole thing as a message to a clawmon
  (async () => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      process.exit(1);
    }

    const fullMessage = rawArgs.filter(a => a !== '--debug').join(' ');
    dbg(`Natural language input: "${fullMessage}"`);

    // Check for @mention
    const mentionMatch = fullMessage.match(/@(\w+)/);
    dbg(`Mention match: ${mentionMatch ? mentionMatch[1] : 'none'}`);
    let clawmon;

    if (mentionMatch) {
      const mentionName = mentionMatch[1]!;
      clawmon = await findClawmonByName(mentionName);
      if (!clawmon) {
        console.log(chalk.red(`  Clawmon "${mentionName}" not found.`));
        const all = await listClawmons();
        if (all.length > 0) {
          console.log(chalk.dim(`  Available: ${all.map(c => '@' + c.soul.name.toLowerCase()).join(', ')}`));
        }
        process.exit(1);
      }
    } else {
      // No @mention -- route to first clawmon
      const all = await listClawmons();
      if (all.length === 0) {
        console.log(chalk.dim('  No clawmons yet. Run: clawmon hatch'));
        process.exit(1);
      }
      clawmon = all[0]!;
      console.log(chalk.dim(`  (routing to ${clawmon.soul.name})`));
    }

    // Strip the @mention and clean up the message
    const cleanMessage = fullMessage.replace(/@\w+\s*/, '').trim() || 'Hey!';
    await talkToClawmon(clawmon, cleanMessage);
  })();
} else {
  program.parse();
}
