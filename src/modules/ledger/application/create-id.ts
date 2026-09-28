export function createId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}
