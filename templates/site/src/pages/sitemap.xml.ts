import type { APIRoute } from 'astro';
import { site } from '../data/site.ts';
import { buildSitemap, contentRoutes } from '../lib/sitemap.ts';

// Static endpoint: dist/sitemap.xml lists every page file of src/pages except the error pages (FR-006).
const pages = Object.keys(import.meta.glob('./**/*.astro'));

export const GET: APIRoute = () =>
  new Response(buildSitemap(site.url, contentRoutes(pages)), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
