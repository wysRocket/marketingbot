export function validateShardConfig(input: {
  shardCount: number;
  shardIndexRaw?: string;
  replicaId: string;
}): { shardCount: number; shardIndex: number } {
  const shardCount = Math.max(1, input.shardCount);

  if (shardCount > 1 && input.shardIndexRaw == null) {
    throw new Error(
      "REPLICA_SHARD_INDEX is required when REPLICA_SHARD_COUNT > 1",
    );
  }

  const shardIndex =
    shardCount === 1 ? 0 : Number.parseInt(input.shardIndexRaw ?? "0", 10);

  if (
    !Number.isFinite(shardIndex) ||
    shardIndex < 0 ||
    shardIndex >= shardCount
  ) {
    throw new Error(
      `Invalid shard index ${input.shardIndexRaw} for shard count ${shardCount}`,
    );
  }

  return { shardCount, shardIndex };
}

export function shardCatalogProfiles<T>(
  profiles: T[],
  shardCount: number,
  shardIndex: number,
): T[] {
  return profiles.filter((_, i) => i % shardCount === shardIndex);
}
