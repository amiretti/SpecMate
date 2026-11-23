// Publishes the files of the confirmed logo, and only those (src/lib/logo.ts): no logo, no file.
import type { APIRoute, GetStaticPaths } from 'astro';
import { site } from '../../data/site.ts';
import { logoVariants, type PublishedFile } from '../../lib/logo.ts';

export const getStaticPaths = (async () =>
  (await logoVariants(site.logo, __SITE_ROOT__))
    .flatMap((variant) => variant.files)
    .map((file) => ({ params: { file: file.name }, props: { file } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response((props as { file: PublishedFile }).file.bytes);
