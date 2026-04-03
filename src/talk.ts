import chalk from 'chalk';
import * as readline from 'node:readline';
import type { Clawmon } from './types.js';
import { chat, evolveCustomRole } from './api.js';
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

// --- Single message ---

export async function talkToClawmon(clawmon: Clawmon, message: string): Promise<void> {
  const face = renderFace(clawmon.bones);
  const role = getRole(clawmon.roleId);
  const name = clawmon.soul.name;

  const memories = await loadMemories(clawmon.id);
  const history = await loadRecentConversation(clawmon.id, 10);

  console.log();
  const roleSuffix = role ? chalk.dim(` (${role.name})`) : '';

  const onSkillUse = (skillName: string, input: Record<string, unknown>) => {
    const describer = SKILL_LABELS[skillName];
    const desc = describer ? describer(input) : `using ${skillName}`;
    console.log(chalk.yellow(`  ${name} (busy): ${desc}...`));
  };

  // Stream header
  process.stdout.write(`  ${face} ${chalk.bold(name)}${roleSuffix}\n\n  `);

  let isFirstToken = true;
  const onToken = (text: string) => {
    // Handle newlines with indentation
    const formatted = text.replace(/\n/g, '\n  ');
    process.stdout.write(formatted);
    isFirstToken = false;
  };

  let result: { reply: string; skillsUsed: string[] };
  try {
    result = await chat(clawmon, role, memories, history, message, onToken, onSkillUse);
  } catch (err: any) {
    if (err.message?.includes('authentication') || err.message?.includes('apiKey') || err.message?.includes('API')) {
      console.log();
      console.log(chalk.red('  No API key found. Set ANTHROPIC_API_KEY to talk to your clawmon.'));
      return;
    }
    throw err;
  }

  // End the streamed line
  console.log('\n');

  // Save conversation
  await saveConversation(clawmon.id, [
    { role: 'user', content: message },
    { role: 'assistant', content: result.reply },
  ]);

  clawmon.interactions += 1;

  // Check for role evolution every 10 interactions (custom roles only)
  if (clawmon.customRole && clawmon.interactions % 10 === 0) {
    const freshMemories = await loadMemories(clawmon.id);
    const evolved = await evolveCustomRole(clawmon, freshMemories);
    if (evolved) {
      clawmon.customRole = evolved;
      const last = evolved.evolution[evolved.evolution.length - 1]!;
      console.log(chalk.yellow(`  ${name} evolved: "${last.fromRole}" -> "${last.toRole}"`));
      console.log(chalk.dim(`  Reason: ${last.reason}`));
      console.log();
    }
  }

  await updateClawmon(clawmon);
}

// --- REPL loop ---

export async function replWithClawmon(clawmon: Clawmon): Promise<void> {
  const face = renderFace(clawmon.bones);
  const role = getRole(clawmon.roleId);
  const name = clawmon.soul.name;
  const roleSuffix = role ? chalk.dim(` (${role.name})`) : '';

  // Session conversation history (in-memory for this REPL session)
  const sessionHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Load prior history for context
  const priorHistory = await loadRecentConversation(clawmon.id, 10);
  sessionHistory.push(...priorHistory);

  console.log();
  console.log(`  ${face} ${chalk.bold(name)}${roleSuffix}`);
  console.log(chalk.dim(`  "${clawmon.soul.catchphrase}"`));
  console.log(chalk.dim(`  Type your message. Ctrl+C to exit.\n`));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan(`  you > `),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const message = line.trim();
    if (!message) {
      rl.prompt();
      return;
    }

    // Special REPL commands
    if (message === '/exit' || message === '/quit') {
      console.log(chalk.dim(`\n  ${name}: See you next time!\n`));
      rl.close();
      return;
    }
    if (message === '/notes') {
      const memories = await loadMemories(clawmon.id);
      if (memories.length === 0) {
        console.log(chalk.dim(`\n  ${name} hasn't collected any notes yet.\n`));
      } else {
        console.log(chalk.bold(`\n  ${name}'s Notes (${memories.length})\n`));
        for (const m of memories) {
          console.log(`  [${m.type}] ${m.name}: ${chalk.dim(m.content)}`);
        }
        console.log();
      }
      rl.prompt();
      return;
    }

    // Load fresh memories each turn
    const memories = await loadMemories(clawmon.id);

    const onSkillUse = (skillName: string, input: Record<string, unknown>) => {
      const describer = SKILL_LABELS[skillName];
      const desc = describer ? describer(input) : `using ${skillName}`;
      console.log(chalk.yellow(`  ${name} (busy): ${desc}...`));
    };

    // Stream header
    process.stdout.write(`\n  ${face} ${chalk.bold(name)}\n  `);

    const onToken = (text: string) => {
      process.stdout.write(text.replace(/\n/g, '\n  '));
    };

    try {
      const result = await chat(clawmon, role, memories, sessionHistory, message, onToken, onSkillUse);

      console.log('\n');

      // Add to session history
      sessionHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result.reply },
      );

      // Persist
      await saveConversation(clawmon.id, [
        { role: 'user', content: message },
        { role: 'assistant', content: result.reply },
      ]);

      clawmon.interactions += 1;
      await updateClawmon(clawmon);

    } catch (err: any) {
      console.log();
      if (err.message?.includes('authentication') || err.message?.includes('apiKey')) {
        console.log(chalk.red('  No API key found. Set ANTHROPIC_API_KEY.'));
      } else {
        console.log(chalk.red(`  Error: ${err.message}`));
      }
      console.log();
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
