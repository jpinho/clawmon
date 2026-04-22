import chalk from 'chalk';
import type { Clawmon } from './types.js';
import { RARITY_STARS } from './types.js';
import { getRole } from './roles.js';
import { renderSprite } from './sprites/render.js';
import { loadMemories, hasPortrait, portraitPath } from './memory/store.js';

const RARITY_COLOR: Record<string, (s: string) => string> = {
  common: chalk.white,
  uncommon: chalk.green,
  rare: chalk.cyan,
  epic: chalk.magenta,
  legendary: chalk.yellow,
};

function statBar(value: number, width: number = 20): string {
  const filled = Math.round((value / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return bar;
}

export async function showClawmon(clawmon: Clawmon): Promise<void> {
  const sprite = renderSprite(clawmon.bones);
  const memories = await loadMemories(clawmon.id);
  const rarity = clawmon.bones.rarity;
  const role = getRole(clawmon.roleId);
  const colorFn = RARITY_COLOR[rarity] ?? chalk.white;

  console.log();

  // Top line: rarity stars + species (right-aligned)
  const stars = RARITY_STARS[rarity];
  const rarityLabel = `${stars}  ${rarity.toUpperCase()}`;
  const speciesLabel = clawmon.bones.species.toUpperCase();
  const topPad = Math.max(0, 36 - rarityLabel.length - speciesLabel.length);
  console.log(`  ${colorFn(rarityLabel)}${' '.repeat(topPad)}${chalk.dim(speciesLabel)}`);

  if (clawmon.bones.shiny) {
    console.log(chalk.yellow(`  ✨ SHINY`));
  }

  console.log();

  // Sprite centered
  for (const line of sprite) {
    console.log(`  ${chalk.green(line)}`);
  }

  console.log();

  // Name bold
  console.log(`  ${chalk.bold.white(clawmon.soul.name)}`);

  // Role
  if (clawmon.customRole) {
    console.log(`  ${chalk.cyan(clawmon.customRole.currentRole)}`);
    console.log(chalk.dim(`  ${clawmon.customRole.currentDescription}`));
  } else if (role) {
    console.log(`  ${chalk.cyan(role.name)}`);
    console.log(chalk.dim(`  ${role.whatItDoes}`));
  }

  console.log();

  // Personality in quotes
  const wrapped = wrapText(clawmon.soul.personality, 34);
  console.log(chalk.dim(`  "${wrapped[0]}`));
  for (let i = 1; i < wrapped.length; i++) {
    const suffix = i === wrapped.length - 1 ? '"' : '';
    console.log(chalk.dim(`   ${wrapped[i]}${suffix}`));
  }
  if (wrapped.length === 1) {
    // Close quote was on first line -- rewrite
    process.stdout.write('\x1b[1A'); // move up
    console.log(chalk.dim(`  "${wrapped[0]}"`));
  }

  console.log();

  // Stats with bars
  const stats = clawmon.bones.stats;
  const statEntries: [string, number][] = [
    ['INSIGHT', stats.INSIGHT],
    ['CREATIVITY', stats.CREATIVITY],
    ['FOCUS', stats.FOCUS],
    ['EMPATHY', stats.EMPATHY],
    ['WIT', stats.WIT],
  ];

  for (const [name, value] of statEntries) {
    const label = name.padEnd(12);
    const bar = statBar(value);
    const num = String(value).padStart(4);
    console.log(`  ${chalk.dim(label)}${chalk.green(bar)}${chalk.white(num)}`);
  }

  console.log();

  // Footer: notes + interactions
  console.log(chalk.dim(`  Notes: ${memories.length}  |  Interactions: ${clawmon.interactions}  |  Hatched: ${clawmon.hatchedAt.split('T')[0]}`));

  // Portrait path if one exists
  if (hasPortrait(clawmon.id)) {
    console.log(chalk.dim(`  Portrait: ${portraitPath(clawmon.id)}`));
  }
  console.log();
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
