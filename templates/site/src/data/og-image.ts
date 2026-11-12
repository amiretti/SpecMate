// The Open Graph image, built once from the example asset (ADR-0030 "Imágenes": through astro:assets, <= 250 KB,
// checked by images.test and head.test). Shared by the head of every page and the JSON-LD `image`.
import { getImage } from 'astro:assets';
import vidriera from '../assets/vidriera.jpg';

export const ogImage = await getImage({ src: vidriera, format: 'jpg', width: 1200 });
