import type { APIRoute } from 'astro';
import { site } from '../data/site.ts';
import { AI_CRAWLERS } from '../lib/ai-crawlers.ts';
import { buildRobots } from '../lib/robots.ts';

// Static endpoint: dist/robots.txt from the single per-site AI crawler setting (FR-006).
export const GET: APIRoute = () =>
  new Response(buildRobots(site.url, site.aiCrawlers, AI_CRAWLERS), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
