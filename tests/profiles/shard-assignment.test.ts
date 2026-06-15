import { describe, expect, it } from "vitest";
import { validateShardConfig } from "../../src/profiles/shard-assignment";

describe("validateShardConfig", () => {
  it("throws when shard count is greater than one and shard index is missing", () => {
    expect(() =>
      validateShardConfig({
        shardCount: 3,
        shardIndexRaw: undefined,
        replicaId: "replica-a",
      }),
    ).toThrow(/REPLICA_SHARD_INDEX/i);
  });

  it("returns shard index 0 when shard count is 1 and index is missing", () => {
    const result = validateShardConfig({
      shardCount: 1,
      shardIndexRaw: undefined,
      replicaId: "replica-a",
    });
    expect(result.shardIndex).toBe(0);
    expect(result.shardCount).toBe(1);
  });

  it("throws on out-of-range shard index", () => {
    expect(() =>
      validateShardConfig({
        shardCount: 3,
        shardIndexRaw: "5",
        replicaId: "replica-a",
      }),
    ).toThrow(/invalid shard index/i);
  });
});
