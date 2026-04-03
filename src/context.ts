/**
 * Gather environmental context for clawmon prompts.
 * No external APIs -- derives everything from system info.
 */

// Timezone-to-approximate-location mapping for common timezones
const TZ_LOCATIONS: Record<string, string> = {
  'Europe/Berlin': 'Germany',
  'Europe/Vienna': 'Austria',
  'Europe/Zurich': 'Switzerland',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Brussels': 'Belgium',
  'Europe/Paris': 'France',
  'Europe/London': 'United Kingdom',
  'Europe/Dublin': 'Ireland',
  'Europe/Madrid': 'Spain',
  'Europe/Rome': 'Italy',
  'Europe/Lisbon': 'Portugal',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Warsaw': 'Poland',
  'Europe/Prague': 'Czech Republic',
  'Europe/Bucharest': 'Romania',
  'Europe/Athens': 'Greece',
  'Europe/Istanbul': 'Turkey',
  'America/New_York': 'US East Coast',
  'America/Chicago': 'US Central',
  'America/Denver': 'US Mountain',
  'America/Los_Angeles': 'US West Coast',
  'America/Toronto': 'Canada (Eastern)',
  'America/Vancouver': 'Canada (Pacific)',
  'America/Sao_Paulo': 'Brazil',
  'America/Mexico_City': 'Mexico',
  'America/Argentina/Buenos_Aires': 'Argentina',
  'Asia/Tokyo': 'Japan',
  'Asia/Seoul': 'South Korea',
  'Asia/Shanghai': 'China',
  'Asia/Singapore': 'Singapore',
  'Asia/Kolkata': 'India',
  'Asia/Dubai': 'UAE',
  'Australia/Sydney': 'Australia (Eastern)',
  'Australia/Melbourne': 'Australia (Eastern)',
  'Pacific/Auckland': 'New Zealand',
};

export interface OwnerContext {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM:SS
  dayOfWeek: string;   // Monday, Tuesday, etc.
  timezone: string;    // e.g. Europe/Berlin
  location: string;    // e.g. Germany (derived from TZ)
  locale: string;      // e.g. en-US
  isLateNight: boolean; // 11 PM - 5 AM
  isWeekend: boolean;
}

export function getOwnerContext(): OwnerContext {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hour = now.getHours();
  const day = now.getDay();

  return {
    date: now.toISOString().split('T')[0]!,
    time: now.toTimeString().split(' ')[0]!,
    dayOfWeek: days[day]!,
    timezone: tz,
    location: TZ_LOCATIONS[tz] ?? tz.replace(/_/g, ' ').split('/').pop() ?? 'Unknown',
    locale,
    isLateNight: hour >= 23 || hour < 5,
    isWeekend: day === 0 || day === 6,
  };
}

export function formatContextForPrompt(ctx: OwnerContext): string {
  const parts = [
    `Current: ${ctx.dayOfWeek}, ${ctx.date} ${ctx.time} (${ctx.timezone})`,
    `Location: ${ctx.location}`,
  ];
  if (ctx.isLateNight) parts.push('Note: It is late at night for the owner.');
  if (ctx.isWeekend) parts.push('Note: It is the weekend.');
  return parts.join('\n');
}
