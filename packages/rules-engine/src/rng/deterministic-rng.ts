const UINT64_MASK = 0xffffffffffffffffn;
const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;

export const RNG_VERSION = "splitmix64-v1" as const;

export class DeterministicRng {
  #state: bigint;

  constructor(seed: bigint) {
    this.#state = BigInt.asUintN(64, seed);
  }

  nextUint64(): bigint {
    this.#state = BigInt.asUintN(64, this.#state + 0x9e3779b97f4a7c15n);
    let value = this.#state;
    value = BigInt.asUintN(64, (value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n);
    value = BigInt.asUintN(64, (value ^ (value >> 27n)) * 0x94d049bb133111ebn);
    return BigInt.asUintN(64, value ^ (value >> 31n));
  }

  nextFloat(): number {
    return Number(this.nextUint64() >> 11n) / 9007199254740992;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be positive integer");
    }

    return Math.floor(this.nextFloat() * maxExclusive);
  }
}

export function deriveSeed(parts: readonly (string | number)[]): bigint {
  let hash = FNV_OFFSET_BASIS_64;
  const encoder = new TextEncoder();

  for (const part of parts) {
    const type = typeof part === "number" ? "n" : "s";
    const value = String(part);
    const bytes = encoder.encode(`${type}${value.length}:${value};`);

    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = (hash * FNV_PRIME_64) & UINT64_MASK;
    }
  }

  return hash;
}
