// Invented violation (US-13 AC-9): paths are built with node:path, never by concatenating separators.
export const x = (dir: string, name: string) => dir + '/' + name;
