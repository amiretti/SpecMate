// FICTITIOUS fixture: the address example without its public URL -> the build must fail naming brief.site.url.
import { readExample } from '../../lib/build.mjs';

const data = readExample('address');
delete data.brief.site.url;
export default data;
