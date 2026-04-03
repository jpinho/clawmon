import chalk from 'chalk';
import type { Clawmon } from './types.js';
import { RARITY_STARS } from './types.js';
import { getRole } from './roles.js';
import { renderSprite } from './sprites/render.js';
import { loadMemories } from './memory/store.js';

export async function showClawmon(clawmon: Clawmon): Promise<void> {
  const sprite = renderSprite(clawmon.bones);
  const memories = await loadMemories(clawmon.id);
  const rarity = clawmon.bones.rarity;
  const role = getRole(clawmon.roleId);

  const rarityColor = rarity === 'legendary' ? chalk.yellow
    : rarity === 'epic' ? chalk.magenta
    : rarity === 'rare' ? chalk.cyan
    : rarity === 'uncommon' ? chalk.green
    : chalk.white;

  const boxWidth = 42;
  const hr = '─'.repeat(boxWidth);

  console.log();
  console.log(`  ┌${hr}┐`);
  console.log(`  │ ${chalk.bold.white(clawmon.soul.name)}${' '.repeat(boxWidth - clawmon.soul.name.length - 1)}│`);
  console.log(`  │ Species: ${clawmon.bones.species} ${rarityColor(`(${rarity})`)}${' '.repeat(Math.max(0, boxWidth - 12 - clawmon.bones.species.length - rarity.length - 3))}│`);
  if (clawmon.bones.shiny) {
    console.log(`  │ ${chalk.yellow('✨ SHINY')}${' '.repeat(boxWidth - 9)}│`);
  }
  console.log(`  │ ${RARITY_STARS[rarity]}${' '.repeat(boxWidth - RARITY_STARS[rarity].length - 1)}│`);
  if (role) {
    const roleLine = `Role: ${role.name}`;
    console.log(`  │ ${chalk.cyan(roleLine)}${' '.repeat(Math.max(0, boxWidth - roleLine.length - 1))}│`);
  }
  console.log(`  │${' '.repeat(boxWidth)}│`);

  // Sprite
  for (const line of sprite) {
    const padding = Math.max(0, boxWidth - line.length);
    console.log(`  │ ${line}${' '.repeat(padding - 1)}│`);
  }

  console.log(`  │${' '.repeat(boxWidth)}│`);

  // Stats
  const stats = clawmon.bones.stats;
  const statLine1 = `INSIGHT ${stats.INSIGHT} | CREATIVITY ${stats.CREATIVITY}`;
  const statLine2 = `FOCUS ${stats.FOCUS} | EMPATHY ${stats.EMPATHY} | WIT ${stats.WIT}`;
  console.log(`  │ ${chalk.dim(statLine1)}${' '.repeat(Math.max(0, boxWidth - statLine1.length - 1))}│`);
  console.log(`  │ ${chalk.dim(statLine2)}${' '.repeat(Math.max(0, boxWidth - statLine2.length - 1))}│`);

  console.log(`  │${' '.repeat(boxWidth)}│`);

  // Personality
  const personality = clawmon.soul.personality;
  const wrapped = wrapText(personality, boxWidth - 2);
  for (const line of wrapped) {
    console.log(`  │ ${chalk.italic(line)}${' '.repeat(Math.max(0, boxWidth - line.length - 1))}│`);
  }

  console.log(`  │${' '.repeat(boxWidth)}│`);

  // Memory count & interactions
  console.log(`  │ Notes: ${memories.length} collected${' '.repeat(Math.max(0, boxWidth - 10 - String(memories.length).length - 10))}│`);
  console.log(`  │ Interactions: ${clawmon.interactions}${' '.repeat(Math.max(0, boxWidth - 16 - String(clawmon.interactions).length))}│`);
  console.log(`  │ Hatched: ${clawmon.hatchedAt.split('T')[0]}${' '.repeat(Math.max(0, boxWidth - 11 - 10))}│`);

  console.log(`  └${hr}┘`);
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
