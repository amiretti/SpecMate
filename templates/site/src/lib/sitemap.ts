// sitemap.xml (FR-006): every content page with its absolute URL, never the error pages.

const ERROR_PAGES = new Set(['404', '500']);

/** Routes of the page files ("./index.astro", "./a/b.astro"), sorted, without error pages. */
export function contentRoutes(files: readonly string[]): string[] {
  const routes = files.flatMap((file) => {
    const name = file.replace(/^\.\//, '').replace(/\.astro$/, '');
    if (name.includes('[')) throw new Error(`sitemap: cannot list the dynamic route ${file}`);
    if (ERROR_PAGES.has(name)) return [];
    const route = name.replace(/(^|\/)index$/, '');
    return [route === '' ? '/' : `/${route}/`];
  });
  return routes.sort();
}

const xml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function buildSitemap(siteUrl: string, routes: readonly string[]): string {
  const urls = routes.map((route) => `  <url><loc>${xml(new URL(route, `${siteUrl}/`).href)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
