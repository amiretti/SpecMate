// robots.txt (FR-006): every crawler may read the whole site; each AI crawler of the template list gets its own
// group with the action of the single per-site setting; the sitemap is referenced by absolute URL. No other path
// is listed (no sensitive routes). A broken list fails the build.
import type { AiCrawlerPolicy } from './site.ts';

const AGENT = /^[A-Za-z][A-Za-z0-9-]*$/;

export function buildRobots(siteUrl: string, policy: AiCrawlerPolicy, crawlers: readonly string[]): string {
  if (policy !== 'allow' && policy !== 'block') throw new Error(`robots.txt: unknown AI crawler policy "${policy}"`);
  const seen = new Set<string>();
  for (const agent of crawlers) {
    if (!AGENT.test(agent)) throw new Error(`robots.txt: invalid AI crawler agent ${JSON.stringify(agent)}`);
    const key = agent.toLowerCase();
    if (seen.has(key)) throw new Error(`robots.txt: repeated AI crawler agent "${agent}"`);
    seen.add(key);
  }
  const action = policy === 'allow' ? 'Allow: /' : 'Disallow: /';
  const groups = [['User-agent: *', 'Allow: /'], ...crawlers.map((agent) => [`User-agent: ${agent}`, action])];
  return `${groups.map((g) => g.join('\n')).join('\n\n')}\n\nSitemap: ${new URL('/sitemap.xml', `${siteUrl}/`).href}\n`;
}
