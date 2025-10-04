export async function getQueueStats() {
  // قيم افتراضية آمنة للعرض فقط؛ يمكن استبدالها لاحقًا بقيَم Upstash الفعلية.
  return { qlen: 0, vips: 0, ghosts_cleaned: 0 };
}
export default { getQueueStats };
