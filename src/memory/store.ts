import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Clawmon, ClawmonConfig, MemoryEntry } from '../types.js';

const CLAWMON_DIR = join(homedir(), '.clawmon');
const CONFIG_PATH = join(CLAWMON_DIR, 'config.json');

// --- Directory helpers ---

function clawmonDir(id: string): string {
  return join(CLAWMON_DIR, 'clawmons', id);
}

function memoryDir(id: string): string {
  return join(clawmonDir(id), 'memory');
}

function conversationDir(id: string): string {
  return join(clawmonDir(id), 'conversations');
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
  const dir = clawmonDir(clawmon.id);
  await mkdir(dir, { recursive: true });
  await mkdir(memoryDir(clawmon.id), { recursive: true });
  await mkdir(conversationDir(clawmon.id), { recursive: true });

  // Save clawmon data
  await writeFile(join(dir, 'clawmon.json'), JSON.stringify(clawmon, null, 2));

  // Create empty MEMORY.md index
  const memIndexPath = join(memoryDir(clawmon.id), 'MEMORY.md');
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
  return JSON.parse(raw) as Clawmon;
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

// --- Find clawmon by name (case-insensitive) ---

export async function findClawmonByName(name: string): Promise<Clawmon | null> {
  const all = await listClawmons();
  const lower = name.toLowerCase();
  return all.find(c =>
    c.id === lower ||
    c.soul.name.toLowerCase() === lower
  ) ?? null;
}

// --- Memory ---

export async function saveMemory(clawmonId: string, entry: MemoryEntry): Promise<void> {
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
