/**
 * @ckirby/coauthor/core
 *
 * Pure join-semilattice registers, fractional positioning, and merge logic.
 * Zero external dependencies. Safe for Cloudflare Workers, Node, Bun, and browsers.
 */

export interface RegisterStamp<T = unknown> {
  rev: number;
  clientID: string;
  schemaVersion: number;
  value: T | null; // null represents a tombstone
}

export type RegisterMap<T = unknown> = Record<string, RegisterStamp<T>>;

export interface MergeResult<T = unknown> {
  winner: RegisterStamp<T>;
  changed: boolean;
}

/**
 * Merges two register stamps according to last-write-wins semilattice rules:
 * 1. Higher rev wins
 * 2. Higher clientID wins (lexicographical tie-break)
 * 3. Canonical UTF-8 JSON byte tie-break
 *
 * Additionally enforces schema version protection: an incoming stamp with a
 * schemaVersion higher than currentSupportedVersion cannot be restamped by an older client.
 */
export function mergeStamp<T = unknown>(
  existing: RegisterStamp<T> | undefined,
  incoming: RegisterStamp<T>,
  currentSupportedVersion: number = incoming.schemaVersion
): RegisterStamp<T> {
  if (!existing) {
    return incoming;
  }

  // Schema-version protection: never allow older schema to overwrite newer schema
  if (existing.schemaVersion > incoming.schemaVersion) {
    return existing;
  }
  if (incoming.schemaVersion > currentSupportedVersion) {
    // Incoming is from a future schema version beyond what this engine supports
    return incoming;
  }

  // 1. Revision ordering
  if (incoming.rev > existing.rev) return incoming;
  if (existing.rev > incoming.rev) return existing;

  // 2. Client ID tie-break
  if (incoming.clientID > existing.clientID) return incoming;
  if (existing.clientID > incoming.clientID) return existing;

  // 3. Deterministic value tie-break
  if (incoming.value === existing.value) return incoming;
  const inBytes = JSON.stringify(incoming.value);
  const exBytes = JSON.stringify(existing.value);
  return inBytes >= exBytes ? incoming : existing;
}

/**
 * Merges two maps of stamped registers into a single converged register map.
 */
export function mergeRegisterMaps<T = unknown>(
  base: RegisterMap<T>,
  patch: RegisterMap<T>,
  currentSupportedVersion?: number
): RegisterMap<T> {
  const result: RegisterMap<T> = { ...base };
  for (const [key, incoming] of Object.entries(patch)) {
    result[key] = mergeStamp(result[key], incoming, currentSupportedVersion);
  }
  return result;
}

/**
 * Base-62 digits for fractional indexing.
 */
const BASE62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Computes a deterministic fractional position string strictly between `prev` and `next`.
 * If `prev` is null/empty, positions before `next`.
 * If `next` is null/empty, positions after `prev`.
 * If both are null/empty, returns a middle midpoint ("V").
 */
export function generatePositionBetween(
  prev: string | null | undefined,
  next: string | null | undefined
): string {
  const p = prev || "";
  const n = next || "";

  if (!p && !n) return "V";
  if (!p) {
    // Before next: decrement or prepend
    const firstChar = n[0] || "V";
    const idx = BASE62_DIGITS.indexOf(firstChar);
    if (idx > 0) {
      return BASE62_DIGITS[Math.floor(idx / 2)] + n.slice(1);
    }
    return "0" + generatePositionBetween("", n.slice(1));
  }
  if (!n) {
    // After prev: increment
    const lastChar = p[p.length - 1];
    const idx = BASE62_DIGITS.indexOf(lastChar);
    if (idx < BASE62_DIGITS.length - 2) {
      return p.slice(0, -1) + BASE62_DIGITS[idx + 1];
    }
    return p + "V";
  }

  // Find first differing character
  let i = 0;
  while (i < p.length && i < n.length && p[i] === n[i]) {
    i++;
  }

  const pChar = p[i] || "0";
  const nChar = n[i] || "z";
  const pIdx = BASE62_DIGITS.indexOf(pChar);
  const nIdx = BASE62_DIGITS.indexOf(nChar);

  if (nIdx - pIdx > 1) {
    const midIdx = Math.floor((pIdx + nIdx) / 2);
    return p.slice(0, i) + BASE62_DIGITS[midIdx];
  }

  // No room between characters: append to prefix
  return p.slice(0, i + 1) + generatePositionBetween(p.slice(i + 1), null);
}
