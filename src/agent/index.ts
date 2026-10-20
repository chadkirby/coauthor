/**
 * @ckirby/coauthor/agent
 *
 * Agentic co-authoring utilities: short handle projection, precondition checking,
 * and designated writer coordination.
 */

export interface HandleSnapshot {
  entityID: string;
  baseRev: number;
  handleToKey: Record<string, string>;
  keyToHandle: Record<string, string>;
  createdAt: number;
}

/**
 * Projects entity item keys into short human-readable handles (e.g. L1..Ln, S1..Sm)
 * for compact LLM context windows and reliable tool call targets.
 */
export function createHandleSnapshot(
  entityID: string,
  baseRev: number,
  prefix: string,
  orderedKeys: string[]
): HandleSnapshot {
  const handleToKey: Record<string, string> = {};
  const keyToHandle: Record<string, string> = {};

  orderedKeys.forEach((key, index) => {
    const handle = `${prefix}${index + 1}`;
    handleToKey[handle] = key;
    keyToHandle[key] = handle;
  });

  return {
    entityID,
    baseRev,
    handleToKey,
    keyToHandle,
    createdAt: Date.now(),
  };
}

/**
 * Validates in O(1) that all touched registers have current rev <= baseRev.
 * Returns null if preconditions pass, or an error detailing the conflict.
 */
export function checkTouchedPreconditions(
  baseRev: number,
  touchedKeys: string[],
  currentRegisterRevs: Record<string, number>
): { valid: boolean; conflictedKey?: string; conflictedRev?: number } {
  for (const key of touchedKeys) {
    const currentRev = currentRegisterRevs[key] ?? 0;
    if (currentRev > baseRev) {
      return {
        valid: false,
        conflictedKey: key,
        conflictedRev: currentRev,
      };
    }
  }
  return { valid: true };
}
