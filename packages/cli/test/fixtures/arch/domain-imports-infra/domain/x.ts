// Invented violation (US-13 AC-8): domain must not import infrastructure.
import { y } from '../infrastructure/y.ts';
export const x = y;
