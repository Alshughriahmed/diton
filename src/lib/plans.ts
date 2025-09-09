export type Plan = {
  id: string;
  nickname: string;
  interval: 'day' | 'week' | 'month' | 'year';
  amount: number; // cents
  currency: 'usd';
  priceId?: string;
};

export const FALLBACK_PLANS: Plan[] = [
  { id: 'daily',   nickname: 'Daily',   interval: 'day',   amount: 149,  currency: 'usd' },
  { id: 'weekly',  nickname: 'Weekly',  interval: 'week',  amount: 599,  currency: 'usd' },
  { id: 'monthly', nickname: 'Monthly', interval: 'month', amount: 1699, currency: 'usd' },
  { id: 'yearly',  nickname: 'Yearly',  interval: 'year',  amount: 9999, currency: 'usd' },
];