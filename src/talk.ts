import chalk from 'chalk';
import type { Clawmon } from './types.js';
import { chat, extractNotes } from './api.js';
import { getRole } from './roles.js';
import {
  loadMemories,
  loadRecentConversation,
  saveConversation,
  saveMemory,
  updateClawmon,
} from './memory/store.js';
import { renderFace } from './sprites/render.js';

export async function talkToClawmon(clawmon: Clawmon, message: string): Promise<void> {
  const face = renderFace(clawmon.bones);
  const role = getRole(clawmon.roleId);

  // Load context
  const memories = await loadMemories(clawmon.id);
  const history = await loadRecentConversation(clawmon.id, 10);

  // Call LLM
  let rawResponse: string;
  try {
    rawResponse = await chat(clawmon, role, memories, history, message);
  } catch (err: any) {
    if (err.message?.includes('authentication') || err.message?.includes('apiKey') || err.message?.includes('API')) {
      console.log();
      console.log(chalk.red('  No API key found. Set ANTHROPIC_API_KEY to talk to your clawmon.'));
      console.log(chalk.dim('  export ANTHROPIC_API_KEY=sk-ant-...'));
      return;
    }
    throw err;
  }

  // Extract notes from response
  const { reply, notes } = extractNotes(rawResponse);

  // Display response
  console.log();
  console.log(chalk.dim(`  ${face} ${chalk.bold(clawmon.soul.name)}`));
  console.log();
  for (const line of reply.split('\n')) {
    console.log(`  ${line}`);
  }
  console.log();

  // Save conversation
  await saveConversation(clawmon.id, [
    { role: 'user', content: message },
    { role: 'assistant', content: reply },
  ]);

  // Save any extracted notes
  for (const note of notes) {
    const now = new Date().toISOString();
    await saveMemory(clawmon.id, {
      name: note.content.slice(0, 60),
      description: note.content,
      type: note.type as any,
      content: note.content,
      createdAt: now,
      updatedAt: now,
    });
    console.log(chalk.dim(`  [Note saved: ${note.content.slice(0, 50)}...]`));
  }

  // Increment interactions
  clawmon.interactions += 1;
  await updateClawmon(clawmon);
}
