import type { APIRoute } from 'astro';
import tokens from '../data/tokens.json';
import { buildTokensCss } from '../lib/tokens.ts';

// Static endpoint: emits dist/tokens.css as an external stylesheet (nothing inline, ADR-0030).
export const GET: APIRoute = () =>
  new Response(buildTokensCss(tokens), { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
