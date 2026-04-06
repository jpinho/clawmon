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
import { saveClawmon, listClawmons, findClawmonByName } from './memory/store.js';
import { renderSprite } from './sprites/render.js';
import { debug } from './debug.js';
import chalk from 'chalk';

// --- Mulberry32 PRNG (deterministic hatching) ---

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
  debug(`hatch: bones=${JSON.stringify(bones)}`);
  debug(`hatch: role=${role.id} (${role.name})`);
  let soul: ClawmonSoul;
  try {
    soul = await generateSoul(bones, role);
  } catch (err: any) {
    debug(`hatch: soul generation error: ${err.message}`);
    debug(`hatch: error stack: ${err.stack}`);
    if (err.status) debug(`hatch: HTTP status: ${err.status}`);
    if (err.error) debug(`hatch: API error body: ${JSON.stringify(err.error)}`);
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

  // Build full clawmon with collision-safe ID
  let id = soul.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const existing = await findClawmonByName(id);
  if (existing) {
    id = `${id}-${Date.now().toString(36).slice(-4)}`;
  }
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

  console.log(chalk.green(`  [${soul.name} has joined your family as: ${role.name}]`));
  console.log(chalk.dim(`  Talk: clawmon talk ${id} "Hello!"`));
  console.log(chalk.dim(`  Show: clawmon show ${id}`));
  console.log();

  return clawmon;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Nickname pools -- warm, personal names. Not role labels.
// Multiple per species so hatching index can pick different ones.
const NICKNAME_POOL: string[] = [
  'Pip', 'Nix', 'Rue', 'Bex', 'Kai', 'Fen', 'Lux', 'Ora', 'Zel', 'Tavi',
  'Juno', 'Milo', 'Sage', 'Wren', 'Cleo', 'Arlo', 'Fern', 'Rune', 'Dusk', 'Vale',
  'Maple', 'Basil', 'Echo', 'Hazel', 'Moss', 'Olive', 'Plum', 'Reed', 'Sol', 'Ash',
  'Birch', 'Cedar', 'Dew', 'Ember', 'Flint', 'Gale', 'Ivy', 'Jade', 'Kit', 'Lark',
  'Mist', 'Nova', 'Oak', 'Pearl', 'Quinn', 'Rowan', 'Skye', 'Thorn', 'Umber', 'Vex',
  'Willow', 'Zephyr', 'Brin', 'Coral', 'Drift', 'Elara', 'Frost', 'Glow', 'Haze', 'Indigo',
];

function fallbackSoul(bones: ClawmonBones, role: Role): ClawmonSoul {
  // Pick a nickname deterministically from the pool based on species + role
  const hash = hashString(bones.species + role.id);
  const name = NICKNAME_POOL[hash % NICKNAME_POOL.length]!;
  const roleName = role.name.replace(/^The /, '');
  return {
    name,
    personality: `A curious ${bones.species} with a knack for ${roleName.toLowerCase()} things. Still finding their voice, but already paying attention.`,
    catchphrase: `Hey! I'm ${name}. I'll be keeping an eye on things for you.`,
    voice: `Speaks warmly and personally, like a friend who happens to be great at ${roleName.toLowerCase()} stuff.`,
  };
}
