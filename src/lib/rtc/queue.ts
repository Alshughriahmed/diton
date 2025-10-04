export type QueueStats = {
  wait: number;
  pairs: number;
  // حقول اختيارية إن استُخدمت في أماكن أخرى:
  qlen?: number;
  vips?: number;
  ghosts_cleaned?: number;
};

export async function getQueueStats(): Promise<QueueStats> {
  // قيم افتراضية آمنة للبناء
  return { wait: 0, pairs: 0 };
}

export async function cleanupGhosts(): Promise<number> {
  // لا تنظيف فعلي بهذا الـstub
  return 0;
}

export default { getQueueStats, cleanupGhosts };
