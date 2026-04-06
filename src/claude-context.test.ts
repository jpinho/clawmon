import { describe, it, expect } from 'vitest';
import { formatOwnerContext, type OwnerProfile } from './claude-context.js';

function emptyProfile(): OwnerProfile {
  return {
    globalInstructions: null,
    userMemories: [],
    feedbackMemories: [],
    projectMemories: [],
    memoryIndexes: [],
  };
}

describe('formatOwnerContext', () => {
  it('returns empty string when profile has no data', () => {
    expect(formatOwnerContext(emptyProfile())).toBe('');
  });

  it('includes user memories with section header', () => {
    const profile = emptyProfile();
    profile.userMemories = [
      '---\nname: role\ntype: user\n---\n\nSenior software engineer working on fintech.',
    ];
    const result = formatOwnerContext(profile);
    expect(result).toContain('About the Owner');
    expect(result).toContain('Senior software engineer');
  });

  it('includes feedback memories', () => {
    const profile = emptyProfile();
    profile.feedbackMemories = [
      '---\nname: style\ntype: feedback\n---\n\nPrefers concise responses.',
    ];
    const result = formatOwnerContext(profile);
    expect(result).toContain('Owner Preference');
    expect(result).toContain('concise responses');
  });

  it('includes global instructions from CLAUDE.md', () => {
    const profile = emptyProfile();
    profile.globalInstructions = '# My Preferences\n\nUse en-dash not em-dash.';
    const result = formatOwnerContext(profile);
    expect(result).toContain('Owner Global Preferences');
    expect(result).toContain('en-dash');
  });

  it('includes project memories as lower priority', () => {
    const profile = emptyProfile();
    profile.projectMemories = [
      '---\nname: freeze\ntype: project\n---\n\nMerge freeze until March 5.',
    ];
    const result = formatOwnerContext(profile);
    expect(result).toContain('Project Context');
    expect(result).toContain('Merge freeze');
  });

  it('respects max character limit by truncating lower-priority sections', () => {
    const profile = emptyProfile();
    // Fill with large user memories to exhaust the budget
    profile.userMemories = Array.from({ length: 20 }, (_, i) =>
      `---\nname: mem${i}\ntype: user\n---\n\n${'A'.repeat(500)}`,
    );
    profile.projectMemories = [
      '---\nname: test\ntype: project\n---\n\nThis should be dropped.',
    ];
    const result = formatOwnerContext(profile);
    // Project context should not appear if user memories filled the budget
    expect(result).not.toContain('This should be dropped');
  });

  it('handles memories without frontmatter', () => {
    const profile = emptyProfile();
    profile.userMemories = ['Just a plain text memory.'];
    const result = formatOwnerContext(profile);
    expect(result).toContain('Just a plain text memory');
  });

  it('prioritizes user > feedback > global > project', () => {
    const profile: OwnerProfile = {
      globalInstructions: 'Global prefs here.',
      userMemories: ['---\nname: u\ntype: user\n---\n\nUser info.'],
      feedbackMemories: ['---\nname: f\ntype: feedback\n---\n\nFeedback info.'],
      projectMemories: ['---\nname: p\ntype: project\n---\n\nProject info.'],
      memoryIndexes: [],
    };
    const result = formatOwnerContext(profile);
    const userIdx = result.indexOf('About the Owner');
    const feedbackIdx = result.indexOf('Owner Preference');
    const globalIdx = result.indexOf('Owner Global Preferences');
    const projectIdx = result.indexOf('Project Context');
    expect(userIdx).toBeLessThan(feedbackIdx);
    expect(feedbackIdx).toBeLessThan(globalIdx);
    expect(globalIdx).toBeLessThan(projectIdx);
  });
});
