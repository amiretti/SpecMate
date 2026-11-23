// FICTITIOUS fixture: a confirmed profile served over http -> the build must fail naming it.
import { readExample } from '../../lib/build.mjs';

const data = readExample('address');
data.brief.profiles = [
  { url: 'http://social-uno.example/hornoazul', source: 'fixture', confirmedBy: 'fixture: inventado, 2026-01-01' },
];
export default data;
