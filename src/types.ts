// --- Rarity ---

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  uncommon: 25,
  rare: 15,
  epic: 8,
  legendary: 2,
};

export const RARITY_STARS: Record<Rarity, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
};

// --- Stats ---

export const STAT_NAMES = ['INSIGHT', 'CREATIVITY', 'FOCUS', 'EMPATHY', 'WIT'] as const;
export type StatName = (typeof STAT_NAMES)[number];

// --- Species ---

export const SPECIES = [
  'compilox', 'buggnaw', 'deplorix', 'kubrik', 'hashling', 'querrix',   // Tech
  'fernox', 'glacielle', 'pyroclaw', 'tideling', 'galecrest', 'terravox', // Nature
  'musinox', 'spectrox', 'chronark', 'voidling', 'paradawn', 'infinik',  // Abstract
  'drakemaw', 'ashphoenix', 'umbrawl', 'stellix', 'levianthan', 'mythora', // Mythic
  'termikitty', 'capybrix', 'owlette', 'penguink', 'snailore', 'foxember', // Companion
] as const;
export type Species = (typeof SPECIES)[number];

export const SPECIES_CATEGORIES: Record<string, Species[]> = {
  tech: ['compilox', 'buggnaw', 'deplorix', 'kubrik', 'hashling', 'querrix'],
  nature: ['fernox', 'glacielle', 'pyroclaw', 'tideling', 'galecrest', 'terravox'],
  abstract: ['musinox', 'spectrox', 'chronark', 'voidling', 'paradawn', 'infinik'],
  mythic: ['drakemaw', 'ashphoenix', 'umbrawl', 'stellix', 'levianthan', 'mythora'],
  companion: ['termikitty', 'capybrix', 'owlette', 'penguink', 'snailore', 'foxember'],
};

// --- Eyes & Hats ---

export const EYES = ['·', '✦', '×', '◉', '@', '°'] as const;
export type Eye = (typeof EYES)[number];

export const HATS = ['none', 'crown', 'tophat', 'propeller', 'halo', 'wizard', 'beanie'] as const;
export type Hat = (typeof HATS)[number];

// --- Bones (deterministic from hash) ---

export interface ClawmonBones {
  species: Species;
  rarity: Rarity;
  eye: Eye;
  hat: Hat;
  shiny: boolean;
  stats: Record<StatName, number>;
}

// --- Soul (model-generated on hatch) ---

export interface ClawmonSoul {
  name: string;
  personality: string;
  catchphrase: string;
  voice: string; // description of how they speak
}

// --- Full Clawmon ---

export interface Clawmon {
  id: string;
  bones: ClawmonBones;
  soul: ClawmonSoul;
  roleId: string; // role from ROLES registry, or 'custom'
  customRole?: CustomRole; // for prompt-based clawmons
  customSkills?: string[]; // skill IDs for custom-role clawmons (from LLM suggestion)
  familyId?: string; // groups clawmons spawned together
  familyName?: string; // human-readable family name
  hatchedAt: string; // ISO date
  interactions: number;
}

// --- Custom Roles (evolving, prompt-based) ---

export interface CustomRole {
  purpose: string;           // original user prompt: "support me going through a breakup"
  currentRole: string;       // LLM-generated role name that evolves
  currentDescription: string; // LLM-generated description that evolves
  cadence: string;           // LLM-determined cadence
  evolution: RoleEvolution[];  // history of how the role changed
}

export interface RoleEvolution {
  date: string;
  fromRole: string;
  toRole: string;
  reason: string; // why the role evolved
}

// --- Config ---

export interface ClawmonConfig {
  version: string;
  userId: string;
  clawmons: string[]; // list of clawmon IDs (directory names)
  memoryRoot?: string; // custom memory root (e.g. Obsidian vault path). null = default (~/.clawmon/)
}

// --- Memory ---

export interface MemoryEntry {
  name: string;
  description: string;
  type: 'observation' | 'pattern' | 'preference' | 'fact' | 'goal' | 'insight';
  content: string;
  createdAt: string;
  updatedAt: string;
}

// --- Feelings (emotional state tracking) ---

export interface ClawmonFeelings {
  mood: number;           // 1-10, how the agent "feels" overall
  confidence: number;     // 1-10, how confident in its own outputs
  recentOutcomes: Array<{ date: string; success: boolean; note: string }>;
  trend: 'improving' | 'stable' | 'declining';
  updatedAt: string;
}

// --- Integrity (performance tracking) ---

export interface ClawmonIntegrity {
  totalInteractions: number;
  toolSuccesses: number;
  toolFailures: number;
  notesAccepted: number;    // notes saved that weren't deleted/corrected
  roleAdherence: number;    // 1-10 self-assessed, updated by reflection
  notableEvents: Array<{ date: string; event: string; positive: boolean }>;
  updatedAt: string;
}
