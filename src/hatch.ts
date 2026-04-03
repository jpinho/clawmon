import {
  type ClawmonBones,
  type ClawmonSoul,
  type Clawmon,
  type Rarity,
  type Species,
  type StatName,
  EYES,
  HATS,
  RARITIES,
  RARITY_WEIGHTS,
  SPECIES,
  STAT_NAMES,
} from './types.js';
import { type Role, ROLES, ROLE_CATEGORIES, getRolesByCategory, getRole } from './roles.js';
import { generateSoul } from './api.js';
import { saveClawmon, listClawmons } from './memory/store.js';
import { renderSprite } from './sprites/render.js';
import chalk from 'chalk';

// --- Mulberry32 PRNG (same as Claude Code's buddy system) ---

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function rollRarity(rng: () => number): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll < 0) return rarity;
  }
  return 'common';
}

const RARITY_FLOOR: Record<Rarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
};

function rollStats(rng: () => number, rarity: Rarity): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);

  const stats = {} as Record<StatName, number>;
  for (const name of STAT_NAMES) {
    if (name === peak) {
      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (name === dump) {
      stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[name] = floor + Math.floor(rng() * 40);
    }
  }
  return stats;
}

const SALT = 'clawmon-2026';

export function rollBones(userId: string, index: number = 0): ClawmonBones {
  const rng = mulberry32(hashString(userId + SALT + index));
  const rarity = rollRarity(rng);
  return {
    species: pick(rng, SPECIES),
    rarity,
    eye: pick(rng, EYES),
    hat: rarity === 'common' ? 'none' : pick(rng, HATS),
    shiny: rng() < 0.01,
    stats: rollStats(rng, rarity),
  };
}

// --- Suggest roles based on what's missing ---

export async function suggestRoles(): Promise<Role[]> {
  const existing = await listClawmons();
  const takenRoleIds = new Set(existing.map(c => c.roleId));

  // Priority order: what everyone should have first
  const priority = [
    'best-friend',      // everyone needs a friend
    'organizer',        // everyone has things to track
    'financial-advisor', // everyone has money to manage
    'career-coach',     // everyone has a career
    'sleep-guardian',   // everyone needs rest
    'creative-muse',    // everyone needs inspiration
    'dream-tracker',    // everyone has dreams
  ];

  const suggestions = priority
    .filter(id => !takenRoleIds.has(id))
    .map(id => getRole(id))
    .filter((r): r is Role => r !== undefined)
    .slice(0, 5);

  // If all priority roles taken, suggest from remaining
  if (suggestions.length < 3) {
    const remaining = ROLES
      .filter(r => !takenRoleIds.has(r.id))
      .slice(0, 5 - suggestions.length);
    suggestions.push(...remaining);
  }

  return suggestions;
}

// --- Display role picker ---

export function displayRoleSuggestions(suggestions: Role[]): void {
  console.log(chalk.bold('\n  Who do you need in your life?\n'));

  for (let i = 0; i < suggestions.length; i++) {
    const r = suggestions[i]!;
    const cat = ROLE_CATEGORIES.find(c => c.id === r.category);
    console.log(`  ${chalk.bold.white(`${i + 1})`)} ${chalk.bold(r.name)} ${chalk.dim(`(${cat?.name})`)}`);
    console.log(`     ${r.description}`);
    console.log(`     ${chalk.dim(r.whatItDoes)}`);
    console.log(`     ${chalk.italic.cyan(r.exampleMessage)}`);
    console.log();
  }

  console.log(chalk.dim('  Or pick any role:'));
  for (const cat of ROLE_CATEGORIES) {
    const roles = getRolesByCategory(cat.id);
    const names = roles.map(r => r.id).join(', ');
    console.log(chalk.dim(`    ${cat.name}: ${names}`));
  }
  console.log();
}

// --- Hatch ceremony ---

export async function hatchClawmon(userId: string, roleId: string, index: number = 0): Promise<Clawmon> {
  const role = getRole(roleId);
  if (!role) {
    console.log(chalk.red(`  Unknown role: "${roleId}"`));
    console.log(chalk.dim('  Run: clawmon hatch (without arguments) to see available roles'));
    process.exit(1);
  }

  console.log();
  console.log(chalk.yellow('  ~~ Clawmon Hatching Ceremony ~~'));
  console.log(chalk.dim(`  Role: ${role.name}`));
  console.log();

  // Roll deterministic bones
  const bones = rollBones(userId, index);

  // Show egg cracking animation
  console.log(chalk.dim('  An egg trembles...'));
  await sleep(800);
  console.log(chalk.dim('  *crack*'));
  await sleep(600);
  console.log(chalk.dim('  *CRACK*'));
  await sleep(400);
  console.log();

  // Display sprite
  const sprite = renderSprite(bones);
  for (const line of sprite) {
    console.log('  ' + line);
  }
  console.log();

  // Show bones info
  const rarityColor = bones.rarity === 'legendary' ? chalk.yellow
    : bones.rarity === 'epic' ? chalk.magenta
    : bones.rarity === 'rare' ? chalk.cyan
    : bones.rarity === 'uncommon' ? chalk.green
    : chalk.white;

  console.log(`  Species: ${chalk.bold(bones.species)} ${rarityColor(`(${bones.rarity})`)}`);
  if (bones.shiny) console.log(`  ${chalk.yellow('✨ SHINY! ✨')}`);
  console.log();

  // Generate soul via LLM
  console.log(chalk.dim('  Generating personality...'));
  let soul: ClawmonSoul;
  try {
    soul = await generateSoul(bones, role);
  } catch (err: any) {
    if (err.message?.includes('authentication') || err.message?.includes('apiKey') || err.message?.includes('API')) {
      console.log(chalk.yellow('  No API key found. Using generated fallback personality.'));
      console.log(chalk.dim('  Set ANTHROPIC_API_KEY for LLM-generated personalities.'));
      soul = fallbackSoul(bones, role);
    } else {
      throw err;
    }
  }
  console.log();

  console.log(`  Name: ${chalk.bold.white(soul.name)}`);
  console.log(`  Role: ${chalk.bold(role.name)}`);
  console.log(`  ${chalk.dim(soul.personality)}`);
  console.log();
  console.log(`  ${chalk.italic(`"${soul.catchphrase}"`)}`);
  console.log();

  // What they'll do
  console.log(chalk.dim(`  What ${soul.name} will do for you:`));
  console.log(chalk.dim(`  ${role.whatItDoes}`));
  console.log(chalk.dim(`  Cadence: ${role.cadence}`));
  console.log();

  // Build full clawmon
  const id = soul.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const clawmon: Clawmon = {
    id,
    bones,
    soul,
    roleId: role.id,
    hatchedAt: new Date().toISOString(),
    interactions: 0,
  };

  // Persist
  await saveClawmon(clawmon);

  console.log(chalk.green(`  [${soul.name} has joined your council as: ${role.name}]`));
  console.log(chalk.dim(`  Talk: clawmon talk ${id} "Hello!"`));
  console.log(chalk.dim(`  Show: clawmon show ${id}`));
  console.log();

  return clawmon;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const FALLBACK_NAMES: Partial<Record<Species, string>> = {
  compilox: 'Compi', buggnaw: 'Nibbles', deplorix: 'Rocket', kubrik: 'Kubos',
  hashling: 'Cipher', querrix: 'Query', fernox: 'Fernie', glacielle: 'Frost',
  pyroclaw: 'Ember', tideling: 'Ripple', galecrest: 'Breeze', terravox: 'Rumble',
  musinox: 'Musa', spectrox: 'Shade', chronark: 'Tempo', voidling: 'Void',
  paradawn: 'Paradox', infinik: 'Infi', drakemaw: 'Drake', ashphoenix: 'Ashe',
  umbrawl: 'Umbra', stellix: 'Stella', levianthan: 'Levia', mythora: 'Mytha',
  termikitty: 'Kitti', capybrix: 'Capy', owlette: 'Hoot', penguink: 'Waddle',
  snailore: 'Spiral', foxember: 'Foxie',
};

function fallbackSoul(bones: ClawmonBones, role: Role): ClawmonSoul {
  const name = FALLBACK_NAMES[bones.species] ?? bones.species.charAt(0).toUpperCase() + bones.species.slice(1, 6);
  return {
    name,
    personality: `A ${bones.rarity} ${bones.species} ready to be your ${role.name}. Quiet but observant, eager to help.`,
    catchphrase: `Hello! I'm ${name}, your ${role.name}. Let's get to know each other.`,
    voice: `Speaks in a way that suits ${role.name} -- warm, attentive, ${role.category === 'wild' ? 'unpredictable' : 'reliable'}.`,
  };
}
