// Per-page head metadata (FR-005): title, description, absolute canonical and Open Graph, all from the validated
// Site so the name and the URL match the visible HTML and the JSON-LD (FR-004).
import { pageUrl, type Site } from './site.ts';

export interface HeadInput {
  /** Path of the page on the site, e.g. "/" or "/404.html". */
  path: string;
  title: string;
  description: string;
  /** Built Open Graph image: its root-relative src and its alternative text. */
  image: { src: string; alt: string };
}

export interface Head {
  title: string;
  description: string;
  canonical: string;
  og: Record<'og:title' | 'og:description' | 'og:type' | 'og:url' | 'og:image' | 'og:image:alt', string>;
}

export function buildHead(site: Pick<Site, 'url'>, page: HeadInput): Head {
  const canonical = pageUrl(site, page.path);
  return {
    title: page.title,
    description: page.description,
    canonical,
    og: {
      'og:title': page.title,
      'og:description': page.description,
      'og:type': 'website',
      'og:url': canonical,
      'og:image': pageUrl(site, page.image.src),
      'og:image:alt': page.image.alt,
    },
  };
}
