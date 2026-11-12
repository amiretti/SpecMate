// Minimal static server for the e2e CSP test (research R6): serves a build directory with the headers of its own
// `_headers` "/*" rule, as Cloudflare does, and answers unknown paths with 404.html and status 404 ("404-page").
// `astro preview` does not apply `_headers`, so it cannot test the CSP.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { parseHeaders } from './scan.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.resolve(root, `.${clean}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return undefined;
  for (const candidate of [target, path.join(target, 'index.html')]) {
    const info = await stat(candidate).catch(() => undefined);
    if (info?.isFile()) return candidate;
  }
  return undefined;
}

/** Starts the server on 127.0.0.1 and a free port; returns { url, headers, close }. */
export async function serve(dir) {
  const root = path.resolve(dir);
  const rules = parseHeaders(await readFile(path.join(root, '_headers'), 'utf8'));
  const headers = Object.fromEntries(rules.get('/*')?.headers ?? []);
  const server = createServer(async (req, res) => {
    const file = await resolveFile(root, req.url ?? '/');
    const status = file ? 200 : 404;
    const body = await readFile(file ?? path.join(root, '404.html'));
    res.writeHead(status, { ...headers, 'Content-Type': TYPES[path.extname(file ?? '404.html')] ?? 'application/octet-stream' });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    headers,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
