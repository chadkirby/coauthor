import { describe, it, expect } from "vitest";
import {
  mergeStamp,
  mergeRegisterMaps,
  generatePositionBetween,
  RegisterStamp,
} from "../src/core/index.js";

describe("@ckirby/coauthor/core", () => {
  it("satisfies semilattice properties (idempotence, commutativity, associativity)", () => {
    const a: RegisterStamp<string> = {
      rev: 1,
      clientID: "client-a",
      schemaVersion: 1,
      value: "hello",
    };
    const b: RegisterStamp<string> = {
      rev: 2,
      clientID: "client-b",
      schemaVersion: 1,
      value: "world",
    };
    const c: RegisterStamp<string> = {
      rev: 2,
      clientID: "client-c",
      schemaVersion: 1,
      value: "foo",
    };

    // Idempotent: merge(A, A) === A
    expect(mergeStamp(a, a)).toEqual(a);

    // Commutative: merge(A, B) === merge(B, A)
    expect(mergeStamp(a, b)).toEqual(mergeStamp(b, a));
    expect(mergeStamp(b, c)).toEqual(mergeStamp(c, b));

    // Associative: merge(merge(A, B), C) === merge(A, merge(B, C))
    const ab_c = mergeStamp(mergeStamp(a, b), c);
    const a_bc = mergeStamp(a, mergeStamp(b, c));
    expect(ab_c).toEqual(a_bc);
  });

  it("breaks ties by clientID when revs are equal", () => {
    const stampA: RegisterStamp<string> = {
      rev: 5,
      clientID: "alpha",
      schemaVersion: 1,
      value: "A",
    };
    const stampB: RegisterStamp<string> = {
      rev: 5,
      clientID: "beta",
      schemaVersion: 1,
      value: "B",
    };

    // "beta" > "alpha" lexicographically
    expect(mergeStamp(stampA, stampB).clientID).toBe("beta");
    expect(mergeStamp(stampB, stampA).clientID).toBe("beta");
  });

  it("breaks ties deterministically on identical (rev, clientID) with distinct values", () => {
    const stamp1: RegisterStamp<string> = {
      rev: 5,
      clientID: "same",
      schemaVersion: 1,
      value: "apple",
    };
    const stamp2: RegisterStamp<string> = {
      rev: 5,
      clientID: "same",
      schemaVersion: 1,
      value: "banana",
    };

    const winner1 = mergeStamp(stamp1, stamp2);
    const winner2 = mergeStamp(stamp2, stamp1);
    expect(winner1).toEqual(winner2);
    expect(winner1.value).toBe("banana");
  });

  it("protects newer schema versions from being overwritten by older clients", () => {
    const v1Stamp: RegisterStamp<string> = {
      rev: 10,
      clientID: "old-device",
      schemaVersion: 1,
      value: "old data",
    };
    const v2Stamp: RegisterStamp<string> = {
      rev: 2,
      clientID: "new-device",
      schemaVersion: 2,
      value: "new data",
    };

    // Even though v1 has rev: 10, v2 has higher schemaVersion so v2 stands
    expect(mergeStamp(v2Stamp, v1Stamp)).toEqual(v2Stamp);
  });

  it("generates deterministic fractional positions between strings", () => {
    const pos1 = generatePositionBetween(null, null);
    expect(pos1).toBe("V");

    const pos0 = generatePositionBetween(null, pos1);
    expect(pos0 < pos1).toBe(true);

    const pos2 = generatePositionBetween(pos1, null);
    expect(pos2 > pos1).toBe(true);

    const posMid = generatePositionBetween(pos1, pos2);
    expect(posMid > pos1).toBe(true);
    expect(posMid < pos2).toBe(true);
  });
});
