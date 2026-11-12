// FICTITIOUS fixture: a confirmed profile served over http -> the build must fail (FR-010, AC-10).
import address from '../../../src/data/examples/address.ts';

export default {
  ...address,
  profiles: [{ url: 'http://social-uno.example/hornoazul', source: 'fixture', confirmed: true }],
};
