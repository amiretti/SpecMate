// Licence check over package-lock.json v3 (FR-012, ADR-0035, constitution "Licencias permitidas").
// Groups: "shipped" = lands in dist/ (the lockfile entry has no dev flag); "build-only" = `dev` or `devOptional`.

const SHIPPED = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'ISC', 'OFL-1.1', 'CC0-1.0'];
const BUILD_ONLY = [...SHIPPED, 'MPL-2.0', 'LGPL-3.0', 'BlueOak-1.0.0'];

export const allowedLicenses = { shipped: new Set(SHIPPED), 'build-only': new Set(BUILD_ONLY) };

// ADR-0038 decision 4-5: out-of-list licences admitted one package at a time, build-only group only. A new package
// with the same licence fails, and an entry that no longer matches the lockfile fails so the table never goes stale.
const SECRETLINT = 'secretlint 13 dependency, runs only when checking the site (ADR-0038)';
export const LICENSE_EXCEPTIONS = [
  { name: 'binaryextensions', license: 'Artistic-2.0', reason: SECRETLINT },
  { name: 'editions', license: 'Artistic-2.0', reason: SECRETLINT },
  { name: 'istextorbinary', license: 'Artistic-2.0', reason: SECRETLINT },
  { name: 'textextensions', license: 'Artistic-2.0', reason: SECRETLINT },
  { name: 'version-range', license: 'Artistic-2.0', reason: SECRETLINT },
  { name: '@azu/style-format', license: 'WTFPL', reason: SECRETLINT },
  { name: 'argparse', license: 'Python-2.0', reason: SECRETLINT },
  { name: 'argparse', license: 'PSF-2.0', reason: `${SECRETLINT}; older argparse nested under rc-config-loader` },
  { name: 'spdx-exceptions', license: 'CC-BY-3.0', reason: `${SECRETLINT}; SPDX data, not code` },
];

// sentry is FSL-1.1 (not open source) and oxc-parser is native; both came with @sentry/node (ADR-0038).
const STUB_TARGET = 'vendor/sentry-stub';
const nameOf = (key) => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);

/** Keys of lockfile entries that ADR-0038 forbids: sentry, oxc-parser, and any @sentry/* other than the local stub. */
export function forbiddenPackages(lock) {
  return Object.entries(lock.packages ?? {})
    .filter(([key, pkg]) => {
      if (!key.includes('node_modules/')) return false;
      const name = nameOf(key);
      if (name === '@sentry/node' && pkg.link === true && pkg.resolved === STUB_TARGET) return false;
      return (
        name === 'sentry' || name === 'oxc-parser' || name.startsWith('@oxc-parser/') || name.startsWith('@sentry/')
      );
    })
    .map(([key]) => key);
}

// OFL-1.1 is for fonts only (constitution), whatever the group.
const FONT_PACKAGE = /^@fontsource(-variable)?\//;

// Maps "-only", "-or-later" and "+" onto the base identifier so the lists name one entry per licence.
const normalize = (id) => id.replace(/(-only|-or-later|\+)$/, '');

function parse(expression) {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const orExpr = () => {
    const terms = [andExpr()];
    while (peek() === 'OR') {
      i += 1;
      terms.push(andExpr());
    }
    return terms.length === 1 ? terms[0] : { or: terms };
  };
  const andExpr = () => {
    const terms = [atom()];
    while (peek() === 'AND') {
      i += 1;
      terms.push(atom());
    }
    return terms.length === 1 ? terms[0] : { and: terms };
  };
  const atom = () => {
    const token = tokens[i];
    i += 1;
    if (token === '(') {
      const inner = orExpr();
      if (tokens[i] !== ')') throw new Error('unbalanced parenthesis');
      i += 1;
      return inner;
    }
    if (token === undefined || token === ')' || token === 'AND' || token === 'OR') throw new Error('unexpected token');
    return { id: normalize(token) };
  };
  const tree = orExpr();
  if (i !== tokens.length) throw new Error('trailing tokens');
  return tree;
}

const satisfies = (node, ok) => {
  if (node.id !== undefined) return ok(node.id);
  if (node.or) return node.or.some((n) => satisfies(n, ok));
  return node.and.every((n) => satisfies(n, ok));
};

function groupOf(pkg) {
  for (const flag of ['dev', 'devOptional']) {
    if (flag in pkg && pkg[flag] !== true) return null;
  }
  return pkg.dev === true || pkg.devOptional === true ? 'build-only' : 'shipped';
}

/** Returns one problem string per package that breaks its group's list (empty array = compliant). */
export function checkLockfile(lock, { exceptions = [] } = {}) {
  const problems = [];
  const used = new Set();
  const packages = lock.packages ?? {};
  for (const [key, pkg] of Object.entries(packages)) {
    if (key === '') continue;
    // A local link is checked through its target entry, which the loop visits on its own.
    if (pkg.link === true && typeof pkg.resolved === 'string' && packages[pkg.resolved]?.version !== undefined)
      continue;
    const group = pkg.link === true || pkg.version === undefined ? null : groupOf(pkg);
    if (group === null) {
      problems.push(`${key}: unclassified (cannot tell whether it ships in dist/ or only builds)`);
      continue;
    }
    const license = pkg.license;
    if (typeof license !== 'string' || license.trim() === '') {
      problems.push(`${key} (${group}): no licence declared`);
      continue;
    }
    const name = key.includes('node_modules/') ? nameOf(key) : (pkg.name ?? key);
    const allowed = allowedLicenses[group];
    let tree;
    try {
      tree = parse(license);
    } catch {
      problems.push(`${key} (${group}): unparsable licence expression "${license}"`);
      continue;
    }
    const ok = (id) => allowed.has(id) && (id !== 'OFL-1.1' || FONT_PACKAGE.test(name));
    if (satisfies(tree, ok)) continue;
    const excused = group === 'build-only' ? exceptions.findIndex((e) => e.name === name && e.license === license) : -1;
    if (excused !== -1) {
      used.add(excused);
      continue;
    }
    problems.push(`${key} (${group}): licence ${license} is not on the ${group} list`);
  }
  exceptions.forEach((e, i) => {
    if (!used.has(i))
      problems.push(`exception ${e.name} (${e.license}) is not in the lockfile: remove it from the table`);
  });
  return problems;
}
