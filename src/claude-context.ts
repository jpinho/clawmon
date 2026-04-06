// Reads local memory files to build owner context for clawmons.
// Sources: ~/.claude/CLAUDE.md, ~/.claude/projects/<project>/memory/ files

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { debug } from './debug.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

// Max tokens of context we inject (rough char estimate -- ~4 chars per token)
const MAX_CONTEXT_CHARS = 8000;

export interface OwnerProfile {
  globalInstructions: string | null;    // from CLAUDE.md
  userMemories: string[];               // from user_*.md files
  feedbackMemories: string[];           // from feedback_*.md files
  projectMemories: string[];            // from project_*.md files
  memoryIndexes: string[];              // from MEMORY.md files
}

export async function loadOwnerProfile(): Promise<OwnerProfile> {
  const profile: OwnerProfile = {
    globalInstructions: null,
    userMemories: [],
    feedbackMemories: [],
    projectMemories: [],
    memoryIndexes: [],
  };

  // 1. Global CLAUDE.md
  const claudeMdPath = join(CLAUDE_DIR, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    try {
      profile.globalInstructions = await readFile(claudeMdPath, 'utf-8');
      debug(`claude-context: loaded CLAUDE.md (${profile.globalInstructions.length} chars)`);
    } catch { /* ignore */ }
  }

  // 2. Scan all project memory dirs
  if (!existsSync(PROJECTS_DIR)) return profile;

  let projectDirs: string[];
  try {
    projectDirs = await readdir(PROJECTS_DIR);
  } catch {
    return profile;
  }

  for (const projectDir of projectDirs) {
    const memDir = join(PROJECTS_DIR, projectDir, 'memory');
    if (!existsSync(memDir)) continue;

    let files: string[];
    try {
      files = await readdir(memDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filePath = join(memDir, file);

      try {
        const content = await readFile(filePath, 'utf-8');

        if (file === 'MEMORY.md') {
          profile.memoryIndexes.push(content);
        } else if (file.startsWith('user_')) {
          profile.userMemories.push(content);
        } else if (file.startsWith('feedback_')) {
          profile.feedbackMemories.push(content);
        } else if (file.startsWith('project_')) {
          profile.projectMemories.push(content);
        }
      } catch { /* ignore unreadable files */ }
    }
  }

  debug(`claude-context: user=${profile.userMemories.length}, feedback=${profile.feedbackMemories.length}, project=${profile.projectMemories.length}, indexes=${profile.memoryIndexes.length}`);

  return profile;
}

/**
 * Format owner profile into a concise context string for clawmon prompts.
 * Prioritizes: user memories > feedback > CLAUDE.md > project memories
 */
export function formatOwnerContext(profile: OwnerProfile): string {
  const sections: string[] = [];
  let totalChars = 0;

  const addSection = (title: string, content: string): boolean => {
    if (totalChars + content.length > MAX_CONTEXT_CHARS) return false;
    sections.push(`## ${title}\n${content}`);
    totalChars += content.length;
    return true;
  };

  // User memories first -- who is the owner?
  for (const mem of profile.userMemories) {
    const body = extractBody(mem);
    if (body) {
      if (!addSection('About the Owner', body)) break;
    }
  }

  // Feedback -- how does the owner like to be communicated with?
  for (const mem of profile.feedbackMemories) {
    const body = extractBody(mem);
    if (body) {
      if (!addSection('Owner Preference', body)) break;
    }
  }

  // Global CLAUDE.md (trimmed -- just the preferences section)
  if (profile.globalInstructions) {
    const trimmed = profile.globalInstructions.slice(0, 2000);
    addSection('Owner Global Preferences', trimmed);
  }

  // Project memories (lower priority)
  for (const mem of profile.projectMemories) {
    const body = extractBody(mem);
    if (body) {
      if (!addSection('Project Context', body)) break;
    }
  }

  if (sections.length === 0) return '';

  return `\n\nHere is context about your owner gathered from their previous sessions:\n\n${sections.join('\n\n')}`;
}

/**
 * Extract body content from a markdown file with frontmatter
 */
function extractBody(content: string): string | null {
  const match = content.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)$/);
  if (match && match[1]?.trim()) return match[1].trim();
  // No frontmatter -- return as-is if short enough
  if (content.length < 2000) return content.trim();
  return null;
}
