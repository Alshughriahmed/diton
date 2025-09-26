export const H_THRESHOLD = 80;
export const V_THRESHOLD = 50;

export function isHorizontalDrag(dx: number, dy: number) {
  return Math.abs(dx) >= H_THRESHOLD && Math.abs(dx) > Math.abs(dy);
}
export function isVerticalDrag(dx: number, dy: number) {
  return Math.abs(dy) >= V_THRESHOLD && Math.abs(dy) > Math.abs(dx);
}
