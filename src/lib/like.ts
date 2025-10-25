// src/lib/like.ts
export const keyEdge = (likerDid: string, targetDid: string) =>
  `likes:edge:${likerDid}:${targetDid}`;
export const keyCount = (targetDid: string) => `likes:count:${targetDid}`;

type RedisLike = {
  pipeline(cmds: any[][]): Promise<Array<{ result: any }>>;
};

/**
 * يضبط حالة الإعجاب كعملية idempotent صريحة بناءً على liked:
 * - liked=true  => تأكيد وجود الحافة (مع زيادة العدّاد إذا لم تكن موجودة).
 * - liked=false => إزالة الحافة (مع إنقاص العدّاد إذا كانت موجودة).
 * تُعيد العدد الجديد مع الحالة النهائية.
 */
export async function toggleEdgeAndCount(
  redis: RedisLike,
  likerDid: string,
  targetDid: string,
  liked: boolean
): Promise<{ liked: boolean; count: number }> {
  const edgeK = keyEdge(likerDid, targetDid);
  const cntK = keyCount(targetDid);

  // اقرأ الحالة الحالية
  const r0 = await redis.pipeline([
    ["GET", edgeK],
    ["GET", cntK],
  ]);
  const wasEdge = String(r0?.[0]?.result ?? "") === "1";
  const prevCount = Number(r0?.[1]?.result ?? 0) || 0;

  // إذا لم تتغير الحالة المطلوبة، أعد كما هي
  if (liked === wasEdge) {
    return { liked, count: Math.max(0, prevCount) };
  }

  let newCount = prevCount;

  if (liked && !wasEdge) {
    const r = await redis.pipeline([
      ["INCR", cntK],
      ["SET", edgeK, "1"],
    ]);
    newCount = Number(r?.[0]?.result ?? prevCount + 1) || prevCount + 1;
  } else if (!liked && wasEdge) {
    const r = await redis.pipeline([
      ["DECR", cntK],
      ["SET", edgeK, "0"],
    ]);
    newCount = Number(r?.[0]?.result ?? prevCount - 1) || prevCount - 1;
  }

  if (!Number.isFinite(newCount) || newCount < 0) newCount = 0;

  return { liked, count: newCount };
}
