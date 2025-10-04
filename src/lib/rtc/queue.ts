export type QueueStats = { qlen: number; vips?: number; ghosts_cleaned?: number };

export async function getQueueStats(): Promise<QueueStats> {
  return { qlen: 0, vips: 0, ghosts_cleaned: 0 };
}

export async function cleanupGhosts(): Promise<number> {
  // no-op stub to satisfy imports; backend real logic lives in Upstash impl on Ditona
  return 0;
}

const queueApi = { getQueueStats, cleanupGhosts };
export default queueApi;
