// FICTITIOUS fixture: the address example without its public URL -> the build must fail (FR-005, AC-5).
import address from '../../../src/data/examples/address.ts';

const { url: _dropped, ...settings } = address.site;
export default { ...address, site: settings };
