import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Clawmon, ClawmonConfig, ClawmonSoul, MemoryEntry, ClawmonFeelings, ClawmonIntegrity } from '../types.js';

const CLAWMON_DIR = join(homedir(), '.clawmon');
const CONFIG_PATH = join(CLAWMON_DIR, 'config.json');

// Cached memory root -- loaded from config on first use
let _memoryRootCache: string | null = null;

// --- Directory helpers ---

function clawmonDir(id: string): string {
  return join(CLAWMON_DIR, 'clawmons', id);
}

// Cached family name mapping: clawmonId → familyName (for memory path resolution)
const _familyNameCache = new Map<string, string>();

function defaultMemoryDir(id: string): string {
  return join(clawmonDir(id), 'memory');
}

function memoryDir(id: string, familyName?: string): string {
  const family = familyName ?? _familyNameCache.get(id);
  const root = _memoryRootCache ?? join(CLAWMON_DIR, 'clawmons');

  if (family) {
    const familySlug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return _memoryRootCache
      ? join(_memoryRootCache, familySlug, id)
      : join(clawmonDir(id), 'memory'); // no custom root → keep default flat layout
  }

  if (_memoryRootCache) {
    return join(_memoryRootCache, id);
  }
  return defaultMemoryDir(id);
}

function conversationDir(id: string): string {
  return join(clawmonDir(id), 'conversations');
}

/** Load and cache the memory root from config. Call once at startup or before first memory operation. */
export async function initMemoryRoot(): Promise<void> {
  if (_memoryRootCache !== null) return;
  try {
    const config = await loadConfig();
    if (config.memoryRoot) {
      _memoryRootCache = config.memoryRoot;
    }
  } catch {
    // Config not yet created -- use default
  }
}

/** Override memory root (for testing). */
export function setMemoryRoot(root: string | null): void {
  _memoryRootCache = root;
}

// --- Init ---

export async function initClawmonDir(): Promise<void> {
  await mkdir(CLAWMON_DIR, { recursive: true });
  await mkdir(join(CLAWMON_DIR, 'clawmons'), { recursive: true });
  await mkdir(join(CLAWMON_DIR, 'shared'), { recursive: true });
  await mkdir(join(CLAWMON_DIR, 'exports'), { recursive: true });

  if (!existsSync(CONFIG_PATH)) {
    const config: ClawmonConfig = {
      version: '0.1.0',
      userId: generateUserId(),
      clawmons: [],
    };
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
}

function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Config ---

export async function loadConfig(): Promise<ClawmonConfig> {
  const raw = await readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as ClawmonConfig;
}

export async function saveConfig(config: ClawmonConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// --- Clawmon CRUD ---

export async function saveClawmon(clawmon: Clawmon): Promise<void> {
  await initMemoryRoot();

  // Cache family name for memory path resolution
  if (clawmon.familyName) {
    _familyNameCache.set(clawmon.id, clawmon.familyName);
  }

  const dir = clawmonDir(clawmon.id);
  await mkdir(dir, { recursive: true });
  await mkdir(memoryDir(clawmon.id, clawmon.familyName), { recursive: true });
  await mkdir(conversationDir(clawmon.id), { recursive: true });

  // Save clawmon data
  await writeFile(join(dir, 'clawmon.json'), JSON.stringify(clawmon, null, 2));

  // Create empty MEMORY.md index
  const memDir = memoryDir(clawmon.id, clawmon.familyName);
  const memIndexPath = join(memDir, 'MEMORY.md');
  if (!existsSync(memIndexPath)) {
    await writeFile(memIndexPath, `# ${clawmon.soul.name}'s Memory\n`);
  }

  // Update config
  const config = await loadConfig();
  if (!config.clawmons.includes(clawmon.id)) {
    config.clawmons.push(clawmon.id);
    await saveConfig(config);
  }
}

export async function loadClawmon(id: string): Promise<Clawmon | null> {
  const path = join(clawmonDir(id), 'clawmon.json');
  if (!existsSync(path)) return null;
  const raw = await readFile(path, 'utf-8');
  const clawmon = JSON.parse(raw) as Clawmon;
  if (clawmon.familyName) {
    _familyNameCache.set(clawmon.id, clawmon.familyName);
  }
  return clawmon;
}

export async function listClawmons(): Promise<Clawmon[]> {
  const config = await loadConfig();
  const clawmons: Clawmon[] = [];
  for (const id of config.clawmons) {
    const c = await loadClawmon(id);
    if (c) clawmons.push(c);
  }
  return clawmons;
}

export async function updateClawmon(clawmon: Clawmon): Promise<void> {
  const dir = clawmonDir(clawmon.id);
  await writeFile(join(dir, 'clawmon.json'), JSON.stringify(clawmon, null, 2));
}

// --- Rename (for shuffle) ---

export async function renameClawmon(oldId: string, newId: string, newSoul: ClawmonSoul): Promise<Clawmon> {
  await initMemoryRoot();
  const clawmon = await loadClawmon(oldId);
  if (!clawmon) throw new Error(`Clawmon "${oldId}" not found`);

  // Update soul and ID
  const updated: Clawmon = { ...clawmon, id: newId, soul: newSoul };

  // Create new directory and write clawmon data
  const newDir = clawmonDir(newId);
  await mkdir(newDir, { recursive: true });
  await writeFile(join(newDir, 'clawmon.json'), JSON.stringify(updated, null, 2));

  // Copy memory and conversation dirs if they exist
  const oldMemDir = memoryDir(oldId);
  const newMemDir = memoryDir(newId);
  await mkdir(newMemDir, { recursive: true });
  if (existsSync(oldMemDir)) {
    const files = await readdir(oldMemDir);
    for (const file of files) {
      const content = await readFile(join(oldMemDir, file), 'utf-8');
      await writeFile(join(newMemDir, file), content);
    }
  }

  const oldConvDir = conversationDir(oldId);
  const newConvDir = conversationDir(newId);
  await mkdir(newConvDir, { recursive: true });
  if (existsSync(oldConvDir)) {
    const files = await readdir(oldConvDir);
    for (const file of files) {
      const content = await readFile(join(oldConvDir, file), 'utf-8');
      await writeFile(join(newConvDir, file), content);
    }
  }

  // Remove old directory
  const { rm } = await import('node:fs/promises');
  await rm(clawmonDir(oldId), { recursive: true, force: true });

  // Update config: replace old ID with new
  const config = await loadConfig();
  config.clawmons = config.clawmons.map(id => id === oldId ? newId : id);
  await saveConfig(config);

  // Save a memory so the clawmon knows it was renamed
  const now = new Date().toISOString();
  await saveMemory(newId, {
    name: `Renamed from ${clawmon.soul.name}`,
    description: `I used to be called ${clawmon.soul.name} (id: ${oldId}). My owner shuffled my identity.`,
    type: 'fact',
    content: `I was renamed from ${clawmon.soul.name} (id: ${oldId}) to ${newSoul.name} (id: ${newId}) on ${now.split('T')[0]}. My memories, conversations, and role are the same -- only my name and personality changed.`,
    createdAt: now,
    updatedAt: now,
  });

  return updated;
}

// --- Find family members ---

export async function listFamily(familyId: string): Promise<Clawmon[]> {
  const all = await listClawmons();
  return all.filter(c => c.familyId === familyId);
}

// --- Find clawmon by name (case-insensitive) ---

export async function findClawmonByName(name: string): Promise<Clawmon | null> {
  const all = await listClawmons();
  const lower = name.toLowerCase();
  return all.find(c =>
    c.id === lower ||
    c.soul.name.toLowerCase() === lower
  ) ?? null;
}

// --- Unique ID generation ---

/**
 * Generate a collision-safe clawmon ID from a name.
 * Checks against existing clawmons and an optional set of IDs being created in the same batch.
 */
export async function uniqueClawmonId(name: string, batchIds?: Set<string>): Promise<string> {
  let id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-|-$/g, '');
  const baseId = id;
  let suffix = 2;

  const existing = await listClawmons();
  const existingIds = new Set(existing.map(c => c.id));

  while (existingIds.has(id) || batchIds?.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix++;
  }

  batchIds?.add(id);
  return id;
}

// --- Family ID generation ---

/**
 * Generate a unique family ID and human-readable name from a purpose string.
 * ID is derived from first 3 words of purpose + timestamp, hashed to avoid collisions.
 */
export function generateFamilyIdentity(purpose: string): { familyId: string; familyName: string } {
  const words = purpose.split(/\s+/);
  const familyName = words.slice(0, 4).join(' ');
  const hashInput = words.slice(0, 3).join('-') + '-' + Date.now();
  const hash = hashInput.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const familyId = `family-${Math.abs(hash).toString(36).slice(0, 6)}`;
  return { familyId, familyName };
}

// --- Memory ---

export async function saveMemory(clawmonId: string, entry: MemoryEntry): Promise<void> {
  await initMemoryRoot();
  const dir = memoryDir(clawmonId);
  await mkdir(dir, { recursive: true });

  // Create filename from name
  const filename = entry.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) + '.md';

  const content = `---
name: ${entry.name}
description: ${entry.description}
type: ${entry.type}
tags: [clawmon, ${clawmonId}, ${entry.type}]
createdAt: ${entry.createdAt}
updatedAt: ${entry.updatedAt}
---

${entry.content}
`;

  await writeFile(join(dir, filename), content);

  // Update MEMORY.md index
  const indexPath = join(dir, 'MEMORY.md');
  const existing = existsSync(indexPath) ? await readFile(indexPath, 'utf-8') : '';
  const lines = existing.split('\n');

  // Check if entry already exists in index
  const entryLine = `- [${entry.name}](${filename}) -- ${entry.description}`;
  if (!lines.some(l => l.includes(filename))) {
    lines.push(entryLine);
    await writeFile(indexPath, lines.join('\n'));
  }
}

export async function loadMemories(clawmonId: string): Promise<MemoryEntry[]> {
  await initMemoryRoot();
  const dir = memoryDir(clawmonId);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const memories: MemoryEntry[] = [];

  for (const file of files) {
    if (file === 'MEMORY.md' || !file.endsWith('.md')) continue;

    const raw = await readFile(join(dir, file), 'utf-8');
    const parsed = parseFrontmatter(raw);
    if (parsed) {
      memories.push(parsed);
    }
  }

  return memories;
}

function parseFrontmatter(content: string): MemoryEntry | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1]!;
  const body = match[2]!.trim();

  const fields: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      fields[key] = value;
    }
  }

  return {
    name: fields['name'] ?? 'Unnamed',
    description: fields['description'] ?? '',
    type: (fields['type'] as MemoryEntry['type']) ?? 'observation',
    content: body,
    createdAt: fields['createdAt'] ?? new Date().toISOString(),
    updatedAt: fields['updatedAt'] ?? new Date().toISOString(),
  };
}

// --- Feelings ---

const DEFAULT_FEELINGS: ClawmonFeelings = {
  mood: 5,
  confidence: 5,
  recentOutcomes: [],
  trend: 'stable',
  updatedAt: new Date().toISOString(),
};

function feelingsPath(id: string): string {
  return join(memoryDir(id), 'feelings.md');
}

export async function loadFeelings(clawmonId: string): Promise<ClawmonFeelings> {
  const path = feelingsPath(clawmonId);
  if (!existsSync(path)) return { ...DEFAULT_FEELINGS };
  try {
    const raw = await readFile(path, 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { ...DEFAULT_FEELINGS };
    return JSON.parse(match[1]!) as ClawmonFeelings;
  } catch {
    return { ...DEFAULT_FEELINGS };
  }
}

export async function saveFeelings(clawmonId: string, feelings: ClawmonFeelings): Promise<void> {
  await initMemoryRoot();
  const dir = memoryDir(clawmonId);
  await mkdir(dir, { recursive: true });

  feelings.updatedAt = new Date().toISOString();

  // Compute trend from recent outcomes
  const recent = feelings.recentOutcomes.slice(-10);
  if (recent.length >= 3) {
    const successes = recent.filter(o => o.success).length;
    const rate = successes / recent.length;
    feelings.trend = rate > 0.7 ? 'improving' : rate < 0.4 ? 'declining' : 'stable';
  }

  const moodLabel = feelings.mood <= 3 ? 'struggling' : feelings.mood <= 6 ? 'neutral' : 'good';
  const confLabel = feelings.confidence <= 3 ? 'low' : feelings.confidence <= 6 ? 'moderate' : 'high';

  const content = `---
${JSON.stringify(feelings, null, 2)}
---

# How I'm Feeling

**Mood:** ${feelings.mood}/10 (${moodLabel})
**Confidence:** ${feelings.confidence}/10 (${confLabel})
**Trend:** ${feelings.trend}

## Recent Outcomes
${recent.map(o => `- ${o.success ? '✓' : '✗'} ${o.note} (${o.date.split('T')[0]})`).join('\n') || '_No outcomes recorded yet._'}
`;

  await writeFile(feelingsPath(clawmonId), content);
}

export function updateFeelingsAfterInteraction(
  feelings: ClawmonFeelings,
  toolSucceeded: boolean,
  toolsUsed: number,
  note?: string,
): ClawmonFeelings {
  const updated = { ...feelings };
  const now = new Date().toISOString();

  // Record outcome
  if (toolsUsed > 0) {
    updated.recentOutcomes = [
      ...updated.recentOutcomes.slice(-19), // keep last 20
      { date: now, success: toolSucceeded, note: note ?? (toolSucceeded ? 'tools succeeded' : 'tool error') },
    ];
  }

  // Adjust mood and confidence based on outcomes
  const recent = updated.recentOutcomes.slice(-5);
  const recentSuccessRate = recent.length > 0
    ? recent.filter(o => o.success).length / recent.length
    : 0.5;

  // Mood drifts toward recent success rate (scaled 1-10)
  updated.mood = Math.max(1, Math.min(10, Math.round(updated.mood * 0.7 + recentSuccessRate * 10 * 0.3)));
  // Confidence adjusts more slowly
  updated.confidence = Math.max(1, Math.min(10, Math.round(updated.confidence * 0.8 + recentSuccessRate * 10 * 0.2)));

  return updated;
}

// --- Integrity ---

const DEFAULT_INTEGRITY: ClawmonIntegrity = {
  totalInteractions: 0,
  toolSuccesses: 0,
  toolFailures: 0,
  notesAccepted: 0,
  roleAdherence: 7,
  notableEvents: [],
  updatedAt: new Date().toISOString(),
};

function integrityPath(id: string): string {
  return join(memoryDir(id), 'integrity.md');
}

export async function loadIntegrity(clawmonId: string): Promise<ClawmonIntegrity> {
  const path = integrityPath(clawmonId);
  if (!existsSync(path)) return { ...DEFAULT_INTEGRITY };
  try {
    const raw = await readFile(path, 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { ...DEFAULT_INTEGRITY };
    return JSON.parse(match[1]!) as ClawmonIntegrity;
  } catch {
    return { ...DEFAULT_INTEGRITY };
  }
}

export async function saveIntegrity(clawmonId: string, integrity: ClawmonIntegrity): Promise<void> {
  await initMemoryRoot();
  const dir = memoryDir(clawmonId);
  await mkdir(dir, { recursive: true });

  integrity.updatedAt = new Date().toISOString();

  const successRate = integrity.toolSuccesses + integrity.toolFailures > 0
    ? Math.round((integrity.toolSuccesses / (integrity.toolSuccesses + integrity.toolFailures)) * 100)
    : 100;

  const content = `---
${JSON.stringify(integrity, null, 2)}
---

# Integrity Report

**Total Interactions:** ${integrity.totalInteractions}
**Tool Success Rate:** ${successRate}% (${integrity.toolSuccesses} successes, ${integrity.toolFailures} failures)
**Notes Saved:** ${integrity.notesAccepted}
**Role Adherence:** ${integrity.roleAdherence}/10

## Notable Events
${integrity.notableEvents.slice(-10).map(e => `- ${e.positive ? '✓' : '✗'} ${e.event} (${e.date.split('T')[0]})`).join('\n') || '_No notable events yet._'}
`;

  await writeFile(integrityPath(clawmonId), content);
}

export function updateIntegrityAfterInteraction(
  integrity: ClawmonIntegrity,
  toolResults: Array<{ name: string; succeeded: boolean }>,
  notesSaved: number,
): ClawmonIntegrity {
  const updated = { ...integrity };
  const now = new Date().toISOString();

  updated.totalInteractions += 1;
  updated.notesAccepted += notesSaved;

  for (const result of toolResults) {
    if (result.succeeded) {
      updated.toolSuccesses += 1;
    } else {
      updated.toolFailures += 1;
      updated.notableEvents = [
        ...updated.notableEvents.slice(-19),
        { date: now, event: `${result.name} failed`, positive: false },
      ];
    }
  }

  return updated;
}

// --- Conversation History ---

export async function saveConversation(
  clawmonId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<void> {
  const dir = conversationDir(clawmonId);
  await mkdir(dir, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const path = join(dir, `${date}.json`);

  // Append to existing day's conversation or create new
  let existing: Array<{ role: string; content: string; ts: string }> = [];
  if (existsSync(path)) {
    const raw = await readFile(path, 'utf-8');
    existing = JSON.parse(raw);
  }

  const timestamped = messages.map(m => ({
    ...m,
    ts: new Date().toISOString(),
  }));

  existing.push(...timestamped);
  await writeFile(path, JSON.stringify(existing, null, 2));
}

export async function loadRecentConversation(
  clawmonId: string,
  maxMessages: number = 20,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const dir = conversationDir(clawmonId);
  if (!existsSync(dir)) return [];

  const files = (await readdir(dir))
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const file of files) {
    if (messages.length >= maxMessages) break;
    const raw = await readFile(join(dir, file), 'utf-8');
    const entries = JSON.parse(raw) as Array<{ role: 'user' | 'assistant'; content: string }>;
    messages.unshift(...entries.slice(-(maxMessages - messages.length)));
  }

  return messages.slice(-maxMessages);
}

// --- Export / Import ---

export async function exportClawmon(clawmonId: string): Promise<string> {
  const clawmon = await loadClawmon(clawmonId);
  if (!clawmon) throw new Error(`Clawmon "${clawmonId}" not found`);

  const memories = await loadMemories(clawmonId);
  const conversations = await loadRecentConversation(clawmonId, 100);

  const bundle = {
    version: '0.1.0',
    exportedAt: new Date().toISOString(),
    clawmon,
    memories,
    recentConversations: conversations,
  };

  return JSON.stringify(bundle, null, 2);
}

export async function importClawmon(json: string): Promise<Clawmon> {
  const bundle = JSON.parse(json) as {
    clawmon: Clawmon;
    memories: MemoryEntry[];
    recentConversations: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  await saveClawmon(bundle.clawmon);

  for (const memory of bundle.memories) {
    await saveMemory(bundle.clawmon.id, memory);
  }

  if (bundle.recentConversations.length > 0) {
    await saveConversation(bundle.clawmon.id, bundle.recentConversations);
  }

  return bundle.clawmon;
}

// --- Is initialized? ---

export function isInitialized(): boolean {
  return existsSync(CONFIG_PATH);
}
