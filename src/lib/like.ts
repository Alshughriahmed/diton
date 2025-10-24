// src/lib/like.ts
/**
 * تبديل إعجاب المستخدم لمطابقة/غرفة معينة وحساب العدد الحالي.
 * pairKey: اسم الغرفة أو pairId.
 * likerId: هوية المستخدم المستقرة.
 * يخزّن الإعجابات في مجموعة Redis: likes:set:{pairKey}
 * لا تكرار، والضغط مرة ثانية يزيل الإعجاب.
 */

type RedisSetOps = {
  sadd: (key: string, member: string) => Promise<number>;
  srem: (key: string, member: string) => Promise<number>;
  scard: (key: string) => Promise<number>;
};

export const keySet = (pairKey: string) => `likes:set:${pairKey}`;

export async function toggleEdgeAndCount(
  r: RedisSetOps,
  pairKey: string,
  likerId: string
): Promise<{ liked: boolean; count: number }> {
  const setKey = keySet(pairKey);

  let liked = false;

  // جرّب إضافة العضو. إن كان موجوداً مُسبقاً فسنقوم بإزالته.
  try {
    const added = await r.sadd(setKey, likerId);
    if (added === 1) {
      liked = true; // تم تسجيل الإعجاب الآن
    } else {
      await r.srem(setKey, likerId);
      liked = false; // تمت إزالة الإعجاب
    }
  } catch {
    // مسار احتياطي قوي
    try {
      const removed = await r.srem(setKey, likerId);
      if (removed === 1) liked = false;
      else liked = (await r.sadd(setKey, likerId)) === 1;
    } catch {}
  }

  let count = 0;
  try {
    count = await r.scard(setKey);
  } catch {}
  if (!Number.isFinite(count) || count < 0) count = 0;

  return { liked, count };
}
