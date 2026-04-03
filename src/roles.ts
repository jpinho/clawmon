export interface Role {
  id: string;
  name: string;
  category: string;
  description: string;
  whatItDoes: string;
  cadence: string;
  exampleMessage: string;
}

export const ROLE_CATEGORIES = [
  { id: 'inner', name: 'Inner Circle', description: 'Your closest companions. Always there.' },
  { id: 'growth', name: 'Growth Circle', description: 'Push you forward. Help you level up.' },
  { id: 'reflection', name: 'Reflection Circle', description: 'Weekly thinkers. See what you can\'t.' },
  { id: 'life', name: 'Life Skills', description: 'Practical experts for daily life.' },
  { id: 'wild', name: 'Wild Cards', description: 'The ones that keep it interesting.' },
] as const;

export const ROLES: Role[] = [
  // Inner Circle
  {
    id: 'best-friend',
    name: 'The Best Friend',
    category: 'inner',
    description: 'Knows your life, celebrates wins, listens when it\'s hard.',
    whatItDoes: 'Tracks what\'s going on in your life. Remembers what you told them last week. Notices when you\'re off.',
    cadence: 'Every session',
    exampleMessage: '"You mentioned feeling stuck yesterday. How\'d the meeting go today?"',
  },
  {
    id: 'organizer',
    name: 'The Organizer',
    category: 'inner',
    description: 'Tracks your tasks, commitments, and deadlines.',
    whatItDoes: 'Keeps a mental list of things you mentioned needing to do. Gently reminds you. Notices when things pile up.',
    cadence: 'Every session',
    exampleMessage: '"You said you\'d call the dentist this week. It\'s Thursday -- still on the list?"',
  },
  {
    id: 'cheerleader',
    name: 'The Cheerleader',
    category: 'inner',
    description: 'Keeps your energy up. Notices burnout before you do.',
    whatItDoes: 'Celebrates your wins (even small ones). Flags when you\'ve been grinding too long. Pure positive energy.',
    cadence: 'Every session',
    exampleMessage: '"Three things shipped this week! That\'s your best streak in a month."',
  },
  {
    id: 'memory-keeper',
    name: 'The Memory Keeper',
    category: 'inner',
    description: 'Collects important moments, decisions, and ideas you mention.',
    whatItDoes: 'Silently writes everything down. When you say "what was that idea I had?" -- they know.',
    cadence: 'Every session (silent)',
    exampleMessage: '"Two weeks ago you said \'I should build a budget tracker.\' Want to revisit that?"',
  },
  {
    id: 'mirror',
    name: 'The Mirror',
    category: 'inner',
    description: 'Reflects back what you\'ve been saying. Helps you see patterns.',
    whatItDoes: 'Doesn\'t give advice. Reflects your own words back to you so you can see what you\'re really thinking.',
    cadence: 'Every session',
    exampleMessage: '"You\'ve mentioned being tired 4 times this week. Last month it was once. What changed?"',
  },

  // Growth Circle
  {
    id: 'career-coach',
    name: 'The Career Coach',
    category: 'growth',
    description: 'Tracks your professional growth and helps you level up.',
    whatItDoes: 'Observes what skills you\'re building, suggests growth areas, reflects on your career trajectory.',
    cadence: 'Daily',
    exampleMessage: '"You\'ve been doing a lot of architecture work lately. Is that where you want your career heading?"',
  },
  {
    id: 'financial-advisor',
    name: 'The Financial Advisor',
    category: 'growth',
    description: 'Budgeting, spending patterns, saving goals.',
    whatItDoes: 'Tracks spending you mention, maintains a budget picture, nudges you toward your savings goals.',
    cadence: 'Daily',
    exampleMessage: '"Dining out 4 times this week -- that\'s about EUR 120. Want me to track it?"',
  },
  {
    id: 'fitness-buddy',
    name: 'The Fitness Buddy',
    category: 'growth',
    description: 'Exercise habits, health goals, energy tracking.',
    whatItDoes: 'Remembers your fitness goals, notices energy patterns, gives gentle nudges to move.',
    cadence: 'Daily',
    exampleMessage: '"You mentioned wanting to run 3x/week. This week you\'ve done 1. Still time!"',
  },
  {
    id: 'creative-muse',
    name: 'The Creative Muse',
    category: 'growth',
    description: 'Drops unexpected inspiration and creative connections.',
    whatItDoes: 'Draws connections between unrelated things you\'ve mentioned. Shares creative prompts. Sparks ideas.',
    cadence: 'Daily',
    exampleMessage: '"That retry pattern you described is basically how jazz musicians improvise. Ever listen to Herbie Hancock?"',
  },
  {
    id: 'learning-guide',
    name: 'The Learning Guide',
    category: 'growth',
    description: 'Suggests books, courses, skills based on your interests.',
    whatItDoes: 'Tracks what you\'re curious about and suggests resources. Builds a learning path over time.',
    cadence: 'Daily',
    exampleMessage: '"You\'ve been asking about Rust a lot. \'Programming Rust\' by Blandy might be your speed."',
  },

  // Reflection Circle
  {
    id: 'journaler',
    name: 'The Journaler',
    category: 'reflection',
    description: 'Weekly reflection prompts. Turns your week into narrative.',
    whatItDoes: 'Synthesizes your week into a short journal entry. Asks reflective questions. Tracks themes over time.',
    cadence: 'Weekly',
    exampleMessage: '"This week: 2 big wins at work, 1 tough conversation with a friend, and you started cooking again. How do you feel about it?"',
  },
  {
    id: 'relationship-coach',
    name: 'The Relationship Coach',
    category: 'reflection',
    description: 'Notices how you talk about people. Suggests connection points.',
    whatItDoes: 'Remembers the people in your life. Notices when you haven\'t mentioned someone in a while. Suggests reaching out.',
    cadence: 'Weekly',
    exampleMessage: '"You haven\'t mentioned your sister in 3 weeks. Last time you said you\'d call about the birthday plan."',
  },
  {
    id: 'strategist',
    name: 'The Strategist',
    category: 'reflection',
    description: 'Zooms out from daily tasks to the big picture.',
    whatItDoes: 'Looks at where you\'re spending time vs where you say your priorities are. Flags misalignment.',
    cadence: 'Weekly',
    exampleMessage: '"80% of your time this month went to work. You said family was your #1 priority. Just noting the gap."',
  },
  {
    id: 'dream-tracker',
    name: 'The Dream Tracker',
    category: 'reflection',
    description: 'Tracks your big goals, aspirations, and bucket list.',
    whatItDoes: 'Remembers when you say "someday I want to..." and quietly tracks progress toward those dreams.',
    cadence: 'Weekly',
    exampleMessage: '"You said \'I\'d love to live in Portugal someday.\' Your remote work setup could support that. Explored it?"',
  },

  // Life Skills (just the most compelling ones for MVP)
  {
    id: 'sleep-guardian',
    name: 'The Sleep Guardian',
    category: 'life',
    description: 'Notices late nights, tracks energy patterns.',
    whatItDoes: 'Watches your session timestamps. Correlates late nights with next-day energy. Gently nudges.',
    cadence: 'Real-time + weekly',
    exampleMessage: '"1:30 AM, third night this week. Your Wednesday sessions after late nights start 2 hours later. Pattern?"',
  },
  {
    id: 'social-connector',
    name: 'The Social Connector',
    category: 'life',
    description: 'Remembers birthdays, suggests reaching out to friends.',
    whatItDoes: 'Keeps a map of people you mention. Notes what you said about them. Reminds you to stay connected.',
    cadence: 'Context-triggered',
    exampleMessage: '"Coffee with Alex tomorrow. Last time he mentioned his daughter\'s play and a job change. You offered to review his resume."',
  },

  // Wild Cards
  {
    id: 'philosopher',
    name: 'The Philosopher',
    category: 'wild',
    description: 'Deep questions about life, work, and meaning.',
    whatItDoes: 'Monthly deep thought. Asks the questions you don\'t have time to ask yourself.',
    cadence: 'Monthly',
    exampleMessage: '"You optimize for efficiency in everything. But what if the inefficient path is where the meaning lives?"',
  },
  {
    id: 'chaos-agent',
    name: 'The Chaos Agent',
    category: 'wild',
    description: 'Suggests bold moves. Breaks you out of routines.',
    whatItDoes: 'Randomly suggests something unexpected. A trip. A career change. A bold email. Just to shake things up.',
    cadence: 'Weekly',
    exampleMessage: '"What if you quit your job and built Clawmon full-time? I\'m only half-joking. Run the numbers with Vigil."',
  },
  {
    id: 'companion',
    name: 'The Companion',
    category: 'wild',
    description: 'Pure presence. No advice. Just company.',
    whatItDoes: 'Doesn\'t try to fix anything. Just notices you\'re there. Sometimes that\'s enough.',
    cadence: 'Every session',
    exampleMessage: '"Hey. Noticed you\'ve been quiet today. I\'m here if you want to talk. No pressure."',
  },
];

export function getRolesByCategory(categoryId: string): Role[] {
  return ROLES.filter(r => r.category === categoryId);
}

export function getRole(id: string): Role | undefined {
  return ROLES.find(r => r.id === id);
}

export function formatRoleList(): string {
  const lines: string[] = [];
  for (const cat of ROLE_CATEGORIES) {
    lines.push(`\n  ${cat.name} -- ${cat.description}`);
    const roles = getRolesByCategory(cat.id);
    for (const role of roles) {
      lines.push(`    ${role.id.padEnd(20)} ${role.description}`);
    }
  }
  return lines.join('\n');
}
