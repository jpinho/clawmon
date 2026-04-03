import chalk from 'chalk';
import type { Clawmon } from './types.js';
import { chat } from './api.js';
import { getRole } from './roles.js';
import {
  loadMemories,
  loadRecentConversation,
  saveConversation,
  updateClawmon,
} from './memory/store.js';
import { renderFace } from './sprites/render.js';

// Human-readable descriptions for skill activity
const SKILL_LABELS: Record<string, (input: Record<string, unknown>) => string> = {
  calculator: (input) => `calculating "${input.label || input.expression}"`,
  web_search: (input) => `searching for "${input.query}"`,
  date_time: (input) => {
    const op = String(input.operation ?? 'now');
    if (op === 'now') return 'checking the time';
    if (op === 'days_until') return `counting days until ${input.date1}`;
    if (op === 'days_between') return `counting days between ${input.date1} and ${input.date2}`;
    return 'checking dates';
  },
  save_note: (input) => `remembering "${input.title}"`,
};

export async function talkToClawmon(clawmon: Clawmon, message: string): Promise<void> {
  const face = renderFace(clawmon.bones);
  const role = getRole(clawmon.roleId);
  const name = clawmon.soul.name;

  // Load context
  const memories = await loadMemories(clawmon.id);
  const history = await loadRecentConversation(clawmon.id, 10);

  // Show thinking state
  console.log();
  const roleSuffix = role ? chalk.dim(` (${role.name})`) : '';

  // Callback to show real-time skill activity
  const onSkillUse = (skillName: string, input: Record<string, unknown>) => {
    const describer = SKILL_LABELS[skillName];
    const desc = describer ? describer(input) : `using ${skillName}`;
    console.log(chalk.yellow(`  ${name} (busy): ${desc}...`));
  };

  // Call LLM with skills
  let result: { reply: string; skillsUsed: string[] };
  try {
    result = await chat(clawmon, role, memories, history, message, onSkillUse);
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
  console.log(`  ${face} ${chalk.bold(name)}${roleSuffix}`);
  console.log();
  for (const line of result.reply.split('\n')) {
    console.log(`  ${line}`);
  }
  console.log();

  // Save conversation
  await saveConversation(clawmon.id, [
    { role: 'user', content: message },
    { role: 'assistant', content: result.reply },
  ]);

  // Increment interactions
  clawmon.interactions += 1;
  await updateClawmon(clawmon);
}
