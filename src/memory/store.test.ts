import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock homedir to use a temp directory
const TEST_HOME = join(tmpdir(), `clawmon-test-${Date.now()}`);
vi.mock('node:os', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:os')>();
  return { ...original, homedir: () => TEST_HOME };
});

const {
  initClawmonDir,
  isInitialized,
  loadConfig,
  saveConfig,
  saveClawmon,
  loadClawmon,
  listClawmons,
  updateClawmon,
  findClawmonByName,
  saveMemory,
  loadMemories,
  saveConversation,
  loadRecentConversation,
  exportClawmon,
  importClawmon,
  listFamily,
  setMemoryRoot,
} = await import('./store.js');

import type { Clawmon, MemoryEntry } from '../types.js';

function makeClawmon(overrides: Partial<Clawmon> = {}): Clawmon {
  return {
    id: 'test-penny',
    bones: {
      species: 'pyroclaw',
      rarity: 'epic',
      eye: '@',
      hat: 'crown',
      shiny: false,
      stats: { INSIGHT: 50, CREATIVITY: 60, FOCUS: 40, EMPATHY: 70, WIT: 80 },
    },
    soul: {
      name: 'Penny',
      personality: 'Witty fire-type financial advisor.',
      catchphrase: "Let's make every euro count.",
      voice: 'Warm and direct.',
    },
    roleId: 'financial-advisor',
    hatchedAt: '2026-04-03T10:00:00Z',
    interactions: 0,
    ...overrides,
  };
}

function makeMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    name: 'Savings goal',
    description: 'Owner wants to save €5,000',
    type: 'goal',
    content: 'Owner wants to save €5,000 by December 2026.',
    createdAt: '2026-04-03T10:00:00Z',
    updatedAt: '2026-04-03T10:00:00Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await mkdir(TEST_HOME, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_HOME, { recursive: true, force: true });
});

describe('initClawmonDir', () => {
  it('creates the directory structure and config', async () => {
    expect(isInitialized()).toBe(false);
    await initClawmonDir();
    expect(isInitialized()).toBe(true);

    const config = await loadConfig();
    expect(config.version).toBe('0.1.0');
    expect(config.userId).toMatch(/^user-/);
    expect(config.clawmons).toEqual([]);
  });

  it('does not overwrite existing config on re-init', async () => {
    await initClawmonDir();
    const config1 = await loadConfig();

    await initClawmonDir();
    const config2 = await loadConfig();

    expect(config1.userId).toBe(config2.userId);
  });
});

describe('clawmon CRUD', () => {
  beforeEach(async () => {
    await initClawmonDir();
  });

  it('saves and loads a clawmon', async () => {
    const clawmon = makeClawmon();
    await saveClawmon(clawmon);

    const loaded = await loadClawmon('test-penny');
    expect(loaded).not.toBeNull();
    expect(loaded!.soul.name).toBe('Penny');
    expect(loaded!.bones.species).toBe('pyroclaw');
  });

  it('returns null for nonexistent clawmon', async () => {
    const loaded = await loadClawmon('nonexistent');
    expect(loaded).toBeNull();
  });

  it('adds clawmon ID to config', async () => {
    await saveClawmon(makeClawmon());
    const config = await loadConfig();
    expect(config.clawmons).toContain('test-penny');
  });

  it('does not duplicate ID in config on re-save', async () => {
    const clawmon = makeClawmon();
    await saveClawmon(clawmon);
    await saveClawmon(clawmon);
    const config = await loadConfig();
    expect(config.clawmons.filter(id => id === 'test-penny')).toHaveLength(1);
  });

  it('lists all saved clawmons', async () => {
    await saveClawmon(makeClawmon({ id: 'penny' }));
    await saveClawmon(makeClawmon({ id: 'ember', soul: { ...makeClawmon().soul, name: 'Ember' } }));

    const all = await listClawmons();
    expect(all).toHaveLength(2);
  });

  it('updates a clawmon in place', async () => {
    const clawmon = makeClawmon();
    await saveClawmon(clawmon);

    clawmon.interactions = 5;
    await updateClawmon(clawmon);

    const loaded = await loadClawmon('test-penny');
    expect(loaded!.interactions).toBe(5);
  });
});

describe('findClawmonByName', () => {
  beforeEach(async () => {
    await initClawmonDir();
    await saveClawmon(makeClawmon());
  });

  it('finds by ID', async () => {
    const found = await findClawmonByName('test-penny');
    expect(found).not.toBeNull();
    expect(found!.soul.name).toBe('Penny');
  });

  it('finds by soul name (case-insensitive)', async () => {
    const found = await findClawmonByName('PENNY');
    expect(found).not.toBeNull();
  });

  it('returns null for unknown name', async () => {
    const found = await findClawmonByName('nobody');
    expect(found).toBeNull();
  });
});

describe('listFamily', () => {
  beforeEach(async () => {
    await initClawmonDir();
  });

  it('returns only clawmons with matching familyId', async () => {
    await saveClawmon(makeClawmon({ id: 'a', familyId: 'fam-1' }));
    await saveClawmon(makeClawmon({ id: 'b', familyId: 'fam-1' }));
    await saveClawmon(makeClawmon({ id: 'c', familyId: 'fam-2' }));

    const family = await listFamily('fam-1');
    expect(family).toHaveLength(2);
  });
});

describe('memory', () => {
  beforeEach(async () => {
    await initClawmonDir();
    await saveClawmon(makeClawmon());
  });

  it('saves and loads a memory entry', async () => {
    await saveMemory('test-penny', makeMemory());
    const memories = await loadMemories('test-penny');
    expect(memories).toHaveLength(1);
    expect(memories[0]!.name).toBe('Savings goal');
    expect(memories[0]!.type).toBe('goal');
    expect(memories[0]!.content).toContain('€5,000');
  });

  it('saves multiple memories', async () => {
    await saveMemory('test-penny', makeMemory({ name: 'Goal 1' }));
    await saveMemory('test-penny', makeMemory({ name: 'Goal 2' }));
    const memories = await loadMemories('test-penny');
    expect(memories).toHaveLength(2);
  });

  it('returns empty array for clawmon with no memories', async () => {
    const memories = await loadMemories('test-penny');
    expect(memories).toEqual([]);
  });

  it('returns empty array for nonexistent clawmon', async () => {
    const memories = await loadMemories('nonexistent');
    expect(memories).toEqual([]);
  });

  it('sanitizes filename from memory name', async () => {
    await saveMemory('test-penny', makeMemory({ name: 'My Special Goal!!!' }));
    const dir = join(TEST_HOME, '.clawmon', 'clawmons', 'test-penny', 'memory');
    expect(existsSync(join(dir, 'my-special-goal.md'))).toBe(true);
  });
});

describe('conversations', () => {
  beforeEach(async () => {
    await initClawmonDir();
    await saveClawmon(makeClawmon());
  });

  it('saves and loads conversation messages', async () => {
    await saveConversation('test-penny', [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hey there!' },
    ]);

    const history = await loadRecentConversation('test-penny', 10);
    expect(history).toHaveLength(2);
    expect(history[0]!.content).toBe('Hello!');
  });

  it('appends to same day conversation', async () => {
    await saveConversation('test-penny', [{ role: 'user', content: 'First' }]);
    await saveConversation('test-penny', [{ role: 'user', content: 'Second' }]);

    const history = await loadRecentConversation('test-penny', 10);
    expect(history).toHaveLength(2);
  });

  it('respects maxMessages limit', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }));
    await saveConversation('test-penny', messages);

    const history = await loadRecentConversation('test-penny', 5);
    expect(history).toHaveLength(5);
  });

  it('returns empty for clawmon with no conversations', async () => {
    const history = await loadRecentConversation('test-penny');
    expect(history).toEqual([]);
  });

  it('returns empty for nonexistent clawmon', async () => {
    const history = await loadRecentConversation('nonexistent');
    expect(history).toEqual([]);
  });
});

describe('export / import', () => {
  beforeEach(async () => {
    await initClawmonDir();
  });

  it('exports a clawmon with memories and conversations', async () => {
    await saveClawmon(makeClawmon());
    await saveMemory('test-penny', makeMemory());
    await saveConversation('test-penny', [{ role: 'user', content: 'Hey' }]);

    const json = await exportClawmon('test-penny');
    const bundle = JSON.parse(json);
    expect(bundle.clawmon.soul.name).toBe('Penny');
    expect(bundle.memories).toHaveLength(1);
    expect(bundle.recentConversations.length).toBeGreaterThan(0);
  });

  it('throws on export of nonexistent clawmon', async () => {
    await expect(exportClawmon('nonexistent')).rejects.toThrow('not found');
  });

  it('imports a clawmon from exported JSON', async () => {
    await saveClawmon(makeClawmon({ id: 'original' }));
    await saveMemory('original', makeMemory());
    const json = await exportClawmon('original');

    // Modify the ID to simulate importing a different clawmon
    const bundle = JSON.parse(json);
    bundle.clawmon.id = 'imported';
    const imported = await importClawmon(JSON.stringify(bundle));

    expect(imported.id).toBe('imported');
    const loaded = await loadClawmon('imported');
    expect(loaded).not.toBeNull();
  });
});

describe('custom memory root (Obsidian integration)', () => {
  const VAULT_DIR = join(TEST_HOME, 'obsidian-vault', 'clawmon');

  beforeEach(async () => {
    await initClawmonDir();
    await saveClawmon(makeClawmon());
    await mkdir(VAULT_DIR, { recursive: true });
  });

  afterEach(() => {
    setMemoryRoot(null);
  });

  it('writes memories to custom root when set', async () => {
    setMemoryRoot(VAULT_DIR);
    await saveMemory('test-penny', makeMemory());

    // Memory should be in vault, not in default location
    const vaultFile = join(VAULT_DIR, 'test-penny', 'savings-goal.md');
    expect(existsSync(vaultFile)).toBe(true);
  });

  it('loads memories from custom root', async () => {
    setMemoryRoot(VAULT_DIR);
    await saveMemory('test-penny', makeMemory());

    const memories = await loadMemories('test-penny');
    expect(memories).toHaveLength(1);
    expect(memories[0]!.name).toBe('Savings goal');
  });

  it('includes tags in frontmatter for Obsidian', async () => {
    setMemoryRoot(VAULT_DIR);
    await saveMemory('test-penny', makeMemory());

    const vaultFile = join(VAULT_DIR, 'test-penny', 'savings-goal.md');
    const content = await readFile(vaultFile, 'utf-8');
    expect(content).toContain('tags: [clawmon, test-penny, goal]');
  });

  it('falls back to default when no custom root is set', async () => {
    setMemoryRoot(null);
    await saveMemory('test-penny', makeMemory());

    const defaultFile = join(TEST_HOME, '.clawmon', 'clawmons', 'test-penny', 'memory', 'savings-goal.md');
    expect(existsSync(defaultFile)).toBe(true);
  });

  it('stores config memoryRoot via saveConfig', async () => {
    const config = await loadConfig();
    config.memoryRoot = VAULT_DIR;
    await saveConfig(config);

    const reloaded = await loadConfig();
    expect(reloaded.memoryRoot).toBe(VAULT_DIR);
  });
});
