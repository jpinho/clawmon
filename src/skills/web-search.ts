import type { Skill } from './types.js';

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

    try {
      // Use DuckDuckGo instant answer API (no API key needed)
      const encoded = encodeURIComponent(query);
      const response = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`);
      const data = await response.json() as {
        Abstract?: string;
        AbstractText?: string;
        AbstractSource?: string;
        AbstractURL?: string;
        Answer?: string;
        AnswerType?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      };

      const parts: string[] = [];

      // Direct answer
      if (data.Answer) {
        parts.push(`Answer: ${data.Answer}`);
      }

      // Abstract
      if (data.AbstractText) {
        parts.push(`${data.AbstractText}`);
        if (data.AbstractSource) parts.push(`Source: ${data.AbstractSource} (${data.AbstractURL})`);
      }

      // Related topics (top 5)
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        const topics = data.RelatedTopics
          .filter((t): t is { Text: string; FirstURL: string } => !!t.Text)
          .slice(0, 5);
        if (topics.length > 0) {
          parts.push('Related:');
          for (const t of topics) {
            parts.push(`- ${t.Text}`);
          }
        }
      }

      if (parts.length === 0) {
        // DuckDuckGo didn't have a direct answer -- try a lite scrape
        return `No instant answer found for "${query}". The query may require a more specific search engine or API. Try rephrasing.`;
      }

      return parts.join('\n');
    } catch (err: any) {
      return `Search error: ${err.message}`;
    }
  },
};
