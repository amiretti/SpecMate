// Invented violation: application must not import the console adapter, even lazily.
export const x = () => import('../cli/y.ts');
