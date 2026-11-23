// Rule (US-15 FR-003 to FR-005, AC-3, AC-5, AC-6; data-model.md): a new run keeps a kind Harvi corrected by hand,
// adds new files, marks the ones that are no longer there as "gone", lists as missing every expected kind with no
// present file, and fails naming the entry when the saved inventory was edited into something invalid.
import { describe, expect, it } from 'vitest';
import type { Scan } from '../src/application/inventory-client-folder.ts';
import { InvalidInventoryError, type InventoryEntry, mergeInventory } from '../src/domain/inventory.ts';

const entry = (path: string, kind: InventoryEntry['kind'], extra: Partial<InventoryEntry> = {}): InventoryEntry => ({
  path,
  kind,
  detectedKind: kind,
  size: 1,
  sha256: 'h',
  notices: [],
  ...extra,
});
const scan = (entries: InventoryEntry[], extra: Partial<Scan> = {}): Scan => ({
  entries,
  omitted: [],
  ignored: 0,
  ...extra,
});

describe('mergeInventory, first run', () => {
  it('lists every present file, the missing kinds and the summary (AC-3)', () => {
    const result = mergeInventory(
      undefined,
      scan([entry('foto.jpg', 'photo'), entry('notas.txt', 'text')], {
        ignored: 2,
        omitted: [{ path: 'atajo', reason: 'link' }],
      }),
    );
    expect(result).toEqual({
      version: 1,
      summary: { files: 2, ignored: 2, omitted: 1 },
      missing: ['brand-manual', 'logo', 'prices', 'tokens'],
      entries: [entry('foto.jpg', 'photo'), entry('notas.txt', 'text')],
      omitted: [{ path: 'atajo', reason: 'link' }],
    });
  });

  it('an empty folder is all missing, without error', () => {
    expect(mergeInventory(undefined, scan([])).missing).toEqual([
      'brand-manual',
      'logo',
      'photo',
      'text',
      'prices',
      'tokens',
    ]);
  });

  it('a secret or an unclassified file does not fill any kind', () => {
    const result = mergeInventory(undefined, scan([entry('.env', 'secret'), entry('x.bin', 'unclassified')]));
    expect(result.missing).toHaveLength(6);
  });
});

describe('mergeInventory, next runs', () => {
  it('keeps a kind corrected by hand and marks it (AC-5)', () => {
    const previous = mergeInventory(undefined, scan([entry('planilla.xlsx', 'unclassified')]));
    const edited = JSON.parse(JSON.stringify(previous));
    edited.entries[0].kind = 'prices'; // what Harvi does in relevamiento.json
    const next = mergeInventory(edited, scan([entry('planilla.xlsx', 'unclassified')]));
    expect(next.entries[0]).toEqual(
      entry('planilla.xlsx', 'prices', { detectedKind: 'unclassified', correctedBy: 'manual' }),
    );
    expect(next.missing).not.toContain('prices');
    expect(mergeInventory(next, scan([entry('planilla.xlsx', 'unclassified')]))).toEqual(next); // and stays
  });

  it('adds a new file and marks a deleted one as gone, keeping its kind (AC-6)', () => {
    const previous = mergeInventory(undefined, scan([entry('logo.png', 'logo'), entry('viejo.jpg', 'photo')]));
    const next = mergeInventory(previous, scan([entry('logo.png', 'logo'), entry('nuevo.jpg', 'photo')]));
    expect(next.entries).toEqual([
      entry('logo.png', 'logo'),
      entry('nuevo.jpg', 'photo'),
      { path: 'viejo.jpg', kind: 'photo', detectedKind: 'photo', notices: [], status: 'gone' },
    ]);
    expect(next.summary.files).toBe(2);
  });

  it('a gone file does not fill its kind, and comes back when the file does', () => {
    const previous = mergeInventory(undefined, scan([entry('logo.png', 'logo')]));
    const gone = mergeInventory(previous, scan([]));
    expect(gone.missing).toContain('logo');
    expect(mergeInventory(gone, scan([entry('logo.png', 'logo')])).entries).toEqual([entry('logo.png', 'logo')]);
  });

  it('two runs over the same folder give the same inventory (SC-002)', () => {
    const s = scan([entry('b.jpg', 'photo'), entry('a.txt', 'text')]);
    const once = mergeInventory(undefined, s);
    expect(mergeInventory(once, s)).toEqual(once);
    expect(once.entries.map((e) => e.path)).toEqual(['a.txt', 'b.jpg']);
  });
});

describe('mergeInventory, a saved inventory edited into something invalid', () => {
  it.each([
    [[], /steps\.inventory must be an object/],
    [{ version: 2, entries: [] }, /steps\.inventory\.version must be 1/],
    [{ version: 1, entries: {} }, /steps\.inventory\.entries must be a list/],
    [{ version: 1, entries: [{ kind: 'photo' }] }, /entries\[0\]\.path must be text/],
    [
      { version: 1, entries: [{ path: 'a.jpg', kind: 'photos', detectedKind: 'photo' }] },
      /entries\[0\]\.kind "photos" is not one of: brand-manual, logo/,
    ],
  ])('%j fails naming it', (previous, message) => {
    expect(() => mergeInventory(previous, scan([]))).toThrow(InvalidInventoryError);
    expect(() => mergeInventory(previous, scan([]))).toThrow(message);
  });
});
