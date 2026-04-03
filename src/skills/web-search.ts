import type { Skill } from './types.js';
import { debug } from '../debug.js';

export const webSearchSkill: Skill = {
  name: 'web_search',
  description: 'Search the web for current information. Use for: current prices, exchange rates, news, product comparisons, facts that might have changed since training. Returns a summary of top results.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific. E.g. "best high-yield savings accounts Germany 2026" or "EUR to USD exchange rate today"',
      },
    },
    required: ['query'],
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const query = String(input.query ?? '');
    if (!query) return 'Error: No search query provided.';

    debug(`web_search: query="${query}"`);

    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      debug('web_search: BRAVE_API_KEY not set');
      return 'Error: BRAVE_API_KEY not set. Get a free key at https://brave.com/search/api/';
    }

    try {
      const encoded = encodeURIComponent(query);
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encoded}&count=5`,
        {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
          },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!response.ok) {
        debug(`web_search: Brave API error: ${response.status} ${response.statusText}`);
        return `Search error: ${response.status} ${response.statusText}`;
      }

      const data = await response.json() as BraveSearchResponse;
      debug(`web_search: got ${data.web?.results?.length ?? 0} results`);

      const parts: string[] = [];

      // Infobox (quick facts like exchange rates, definitions)
      if (data.infobox?.results?.length) {
        const info = data.infobox.results[0]!;
        if (info.description) {
          parts.push(`${info.title ?? 'Info'}: ${info.description}`);
        }
      }

      // Web results
      if (data.web?.results?.length) {
        for (const result of data.web.results.slice(0, 5)) {
          const title = result.title ?? '';
          const desc = result.description ?? '';
          const url = result.url ?? '';
          parts.push(`${title}\n  ${desc}\n  ${url}`);
        }
      }

      if (parts.length === 0) {
        return `No results found for "${query}".`;
      }

      return `Search results for "${query}":\n\n${parts.join('\n\n')}`;
    } catch (err: any) {
      debug(`web_search: error: ${err.message}`);
      return `Search error: ${err.message}`;
    }
  },
};

// Brave Search API response types (relevant subset)
interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      description?: string;
      url?: string;
    }>;
  };
  infobox?: {
    results?: Array<{
      title?: string;
      description?: string;
    }>;
  };
}
