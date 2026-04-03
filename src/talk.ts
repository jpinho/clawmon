import chalk from 'chalk';
import type { Clawmon } from './types.js';
import { chat } from './api.js';
import { getRole } from './roles.js';
import { listAvailableSkills } from './skills/registry.js';
import {
  loadMemories,
  loadRecentConversation,
  saveConversation,
  updateClawmon,
} from './memory/store.js';
import { renderFace } from './sprites/render.js';

export async function talkToClawmon(clawmon: Clawmon, message: string): Promise<void> {
  const face = renderFace(clawmon.bones);
  const role = getRole(clawmon.roleId);

  // Load context
  const memories = await loadMemories(clawmon.id);
  const history = await loadRecentConversation(clawmon.id, 10);

  // Call LLM with skills
  let result: { reply: string; skillsUsed: string[] };
  try {
    result = await chat(clawmon, role, memories, history, message);
  } catch (err: any) {
    if (err.message?.includes('authentication') || err.message?.includes('apiKey') || err.message?.includes('API')) {
      console.log();
      console.log(chalk.red('  No API key found. Set ANTHROPIC_API_KEY to talk to your clawmon.'));
      console.log(chalk.dim('  export ANTHROPIC_API_KEY=sk-ant-...'));
      return;
    }
    throw err;
  }

  // Display response
  console.log();
  const roleSuffix = role ? chalk.dim(` (${role.name})`) : '';
  console.log(`  ${face} ${chalk.bold(clawmon.soul.name)}${roleSuffix}`);
  console.log();
  for (const line of result.reply.split('\n')) {
    console.log(`  ${line}`);
  }
  console.log();

  // Show skills used
  if (result.skillsUsed.length > 0) {
    const unique = [...new Set(result.skillsUsed)];
    const skillLabels = unique.map(s =>
      s === 'calculator' ? '🧮 calculator'
      : s === 'web_search' ? '🔍 web search'
      : s === 'date_time' ? '📅 date/time'
      : s === 'save_note' ? '📝 noted'
      : s
    );
    console.log(chalk.dim(`  Skills used: ${skillLabels.join(', ')}`));
    console.log();
  }

  // Save conversation
  await saveConversation(clawmon.id, [
    { role: 'user', content: message },
    { role: 'assistant', content: result.reply },
  ]);

  // Increment interactions
  clawmon.interactions += 1;
  await updateClawmon(clawmon);
}
