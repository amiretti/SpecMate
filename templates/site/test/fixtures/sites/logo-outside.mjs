// FICTITIOUS fixture (US-14 AC-8): a logo whose path leaves the repo -> the build must fail naming brief.logo.light.
import { readExample } from '../../lib/build.mjs';

const data = readExample('address');
data.brief.logo = { light: '../x.svg', alt: 'Logo', source: 'fixture', confirmedBy: 'fixture: inventado, 2026-01-01' };
export default data;
