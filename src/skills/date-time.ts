import type { Skill } from './types.js';

export const dateTimeSkill: Skill = {
  name: 'date_time',
  description: 'Get current date, time, day of week, or calculate days between dates. Use for scheduling awareness, deadline tracking, and time-based context.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['now', 'days_between', 'days_until', 'day_of_week'],
        description: 'What to calculate. "now" returns current date/time. "days_between" calculates days between two dates. "days_until" calculates days from now to a target date. "day_of_week" returns the day name for a date.',
      },
      date1: {
        type: 'string',
        description: 'First date in YYYY-MM-DD format (for days_between, days_until, day_of_week)',
      },
      date2: {
        type: 'string',
        description: 'Second date in YYYY-MM-DD format (for days_between)',
      },
    },
    required: ['operation'],
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const op = String(input.operation ?? 'now');

    switch (op) {
      case 'now': {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]} (${days[now.getDay()]})`;
      }

      case 'days_between': {
        const d1 = new Date(String(input.date1));
        const d2 = new Date(String(input.date2));
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 'Error: Invalid date format. Use YYYY-MM-DD.';
        const diff = Math.abs(d2.getTime() - d1.getTime());
        return `${Math.round(diff / (1000 * 60 * 60 * 24))} days`;
      }

      case 'days_until': {
        const target = new Date(String(input.date1));
        if (isNaN(target.getTime())) return 'Error: Invalid date format. Use YYYY-MM-DD.';
        const diff = target.getTime() - Date.now();
        const days = Math.round(diff / (1000 * 60 * 60 * 24));
        return days >= 0 ? `${days} days from now` : `${Math.abs(days)} days ago`;
      }

      case 'day_of_week': {
        const d = new Date(String(input.date1));
        if (isNaN(d.getTime())) return 'Error: Invalid date format. Use YYYY-MM-DD.';
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[d.getDay()]!;
      }

      default:
        return `Unknown operation: ${op}`;
    }
  },
};
