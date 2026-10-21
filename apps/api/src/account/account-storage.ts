/**
 * Storage objects are not removed by the Postgres cascade when a studio is deleted,
 * so the account delete clears the studio's media files first.
 * Pure over a minimal Supabase-like client so it can be unit tested.
 */
export interface StorageCleanupClient {
  from(table: string): any;
  storage: { from(bucket: string): { remove(paths: string[]): Promise<{ error: { message: string } | null }> } };
}

export async function purgeWorkspaceStorage(service: StorageCleanupClient, workspaceId: string, chunk = 100): Promise<number> {
  const { data, error } = await service.from('media_assets').select('storage_bucket,storage_path').eq('workspace_id', workspaceId);
  if (error) throw new Error(`Could not list studio media: ${error.message}`);
  const byBucket = new Map<string, string[]>();
  for (const row of (data ?? []) as Array<{ storage_bucket: string | null; storage_path: string | null }>) {
    if (!row.storage_path) continue;
    const bucket = row.storage_bucket || 'media';
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), row.storage_path]);
  }
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += chunk) {
      const part = paths.slice(i, i + chunk);
      const res = await service.storage.from(bucket).remove(part);
      if (res.error) throw new Error(`Could not delete studio media: ${res.error.message}`);
      removed += part.length;
    }
  }
  return removed;
}
