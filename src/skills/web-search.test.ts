import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webSearchSkill } from './web-search.js';

describe('web-search skill', () => {
  const originalEnv = process.env.BRAVE_API_KEY;

  afterEach(() => {
    process.env.BRAVE_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns error when query is empty', async () => {
    const result = await webSearchSkill.execute({ query: '' });
    expect(result).toContain('Error');
    expect(result).toContain('No search query');
  });

  it('returns error when BRAVE_API_KEY is not set', async () => {
    delete process.env.BRAVE_API_KEY;
    const result = await webSearchSkill.execute({ query: 'test' });
    expect(result).toContain('BRAVE_API_KEY not set');
  });

  it('returns formatted results on successful search', async () => {
    process.env.BRAVE_API_KEY = 'test-key';
    const mockResponse = {
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Result 1', description: 'Description 1', url: 'https://example.com/1' },
            { title: 'Result 2', description: 'Description 2', url: 'https://example.com/2' },
          ],
        },
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await webSearchSkill.execute({ query: 'ETF Germany' });
    expect(result).toContain('Search results for "ETF Germany"');
    expect(result).toContain('Result 1');
    expect(result).toContain('Result 2');
  });

  it('includes infobox when present', async () => {
    process.env.BRAVE_API_KEY = 'test-key';
    const mockResponse = {
      ok: true,
      json: async () => ({
        infobox: {
          results: [{ title: 'EUR/USD', description: '1 EUR = 1.08 USD' }],
        },
        web: { results: [] },
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await webSearchSkill.execute({ query: 'EUR USD rate' });
    expect(result).toContain('EUR/USD');
    expect(result).toContain('1.08');
  });

  it('returns "no results" when API returns empty', async () => {
    process.env.BRAVE_API_KEY = 'test-key';
    const mockResponse = {
      ok: true,
      json: async () => ({ web: { results: [] } }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await webSearchSkill.execute({ query: 'xyzzynonexistent' });
    expect(result).toContain('No results found');
  });

  it('handles HTTP error responses', async () => {
    process.env.BRAVE_API_KEY = 'test-key';
    const mockResponse = { ok: false, status: 429, statusText: 'Too Many Requests' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await webSearchSkill.execute({ query: 'test' });
    expect(result).toContain('Search error');
    expect(result).toContain('429');
  });

  it('handles network errors gracefully', async () => {
    process.env.BRAVE_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network timeout'));

    const result = await webSearchSkill.execute({ query: 'test' });
    expect(result).toContain('Search error');
    expect(result).toContain('Network timeout');
  });
});
