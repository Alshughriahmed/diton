"use client";
export function useAnalytics(): any {
  const track    = (..._args: any[]) => {};
  const page     = (..._args: any[]) => {};
  const identify = (..._args: any[]) => {};
  const group    = (..._args: any[]) => {};
  const screen   = (..._args: any[]) => {};
  const reset    = (..._args: any[]) => {};
  const log      = (..._args: any[]) => {};
  return { track, page, identify, group, screen, reset, log } as any;
}
export default useAnalytics;
