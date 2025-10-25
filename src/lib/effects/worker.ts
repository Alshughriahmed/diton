// src/lib/effects/worker.ts
// واجهة عامل (Worker) اختيارية. تُرجع غلافًا لا-مزامنًا يعمل بدون ملفات إضافية.

export type WorkerTask<TIn = any, TOut = any> = (input: TIn) => Promise<TOut> | TOut;

export interface EffectsWorker {
  run<TIn, TOut>(taskName: string, payload: TIn): Promise<TOut>;
  terminate(): void;
}

class NoopWorker implements EffectsWorker {
  private tasks = new Map<string, WorkerTask>();
  register(name: string, fn: WorkerTask) {
    this.tasks.set(name, fn);
  }
  async run<TIn, TOut>(taskName: string, payload: TIn): Promise<TOut> {
    const fn = this.tasks.get(taskName);
    if (!fn) return (payload as unknown) as TOut;
    const r = fn(payload);
    return (r instanceof Promise ? await r : r) as TOut;
  }
  terminate() {
    this.tasks.clear();
  }
}

/**
 * يبدأ عامل تأثيرات اختياريًا. لا يستخدم Web Worker الحقيقي هنا
 * لتجنّب إعدادات bundling. يمكن الاستبدال لاحقًا بعامل حقيقي.
 */
export function startEffectsWorker(): EffectsWorker {
  const w = new NoopWorker();

  // أمثلة مهام يمكن ملؤها لاحقًا
  w.register("beauty/params", (p) => p);
  w.register("mask/fit", (p) => p);

  return w;
}
