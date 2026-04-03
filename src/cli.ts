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
import { talkToClawmon } from './talk.js';
import { showClawmon } from './show.js';
import { renderSprite } from './sprites/render.js';
import { getRole, ROLES, formatRoleList } from './roles.js';

const program = new Command();

program
  .name('clawmon')
  .description('Hatch AI companions that live in your terminal')
  .version('0.1.0');

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

// --- Default: natural language with @mentions ---
// If the input isn't a known command, treat it as a message.
// @milo how's my budget? → routes to Milo
// Just typing without @mention → routes to last-active or first clawmon

const knownCommands = new Set([
  'init', 'hatch', 'talk', 'roles', 'show', 'notes',
  'council', 'list', 'export', 'import', 'help',
]);

const args = process.argv.slice(2);
const firstArg = args[0]?.replace(/^-.*/, ''); // ignore flags

if (args.length > 0 && firstArg && !knownCommands.has(firstArg) && !firstArg.startsWith('-')) {
  // Not a known command -- treat the whole thing as a message
  (async () => {
    if (!isInitialized()) {
      console.log(chalk.red('  Not initialized. Run: clawmon init'));
      process.exit(1);
    }

    const fullMessage = args.join(' ');

    // Check for @mention
    const mentionMatch = fullMessage.match(/@(\w+)/);
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

    // Strip the @mention from the message
    const cleanMessage = fullMessage.replace(/@\w+\s*/, '').trim() || 'Hey!';
    await talkToClawmon(clawmon, cleanMessage);
  })();
} else {
  program.parse();
}
