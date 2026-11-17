// Mutation table of the static controls (US-12, U3): one mutation per control, each breaking exactly that control.
// Lives outside the test file so controls-isolation can import it without re-registering the static tests.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mutateFile } from './mutate.mjs';

// Invented token, built at runtime so the repo scan never sees it in source (constitution XII: marked as invented).
export const INVENTED_TOKEN = ['gh', 'p_', 'INVENTEDTESTSECRET'.padEnd(36, '0')].join('');
export const INVENTED_NOTE = 'INVENTED TEST SECRET, not a real credential';

/** @type {{ control: string, mutation: (dir: string) => Promise<void>, expected: RegExp }[]} */
export const STATIC_MUTATIONS = [
  {
    control: 'html',
    mutation: (dir) => mutateFile(dir, 'index.html', (t) => t.replace('</main>', '</span></main>')),
    expected: /index\.html.*close-order.*<\/span>/,
  },
  {
    control: 'links',
    mutation: (dir) =>
      mutateFile(dir, 'index.html', (t) =>
        t.replace('</main>', '<p><a href="/missing-page/">Missing page</a></p></main>'),
      ),
    expected: /\/missing-page\/.*404.*index\.html|index\.html.*\/missing-page\/.*404/,
  },
  {
    control: 'secrets',
    mutation: (dir) => writeFile(path.join(dir, 'leaked-config.txt'), `${INVENTED_NOTE}: ${INVENTED_TOKEN}\n`),
    expected: /leaked-config\.txt.*github/i,
  },
];
