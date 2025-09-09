export type Plan = {
  id: string;
  nickname: string;
  interval: 'day' | 'week' | 'month' | 'year';
  amount: number; // cents
  currency: 'usd' | 'eur';
  priceId?: string;
};

export const FALLBACK_PLANS: Plan[] = [
  { id: 'daily',   nickname: 'Daily',   interval: 'day',   amount: 149,  currency: 'eur' },
  { id: 'weekly',  nickname: 'Weekly',  interval: 'week',  amount: 599,  currency: 'eur' },
  { id: 'monthly', nickname: 'Monthly', interval: 'month', amount: 1699, currency: 'eur' },
  { id: 'yearly',  nickname: 'Yearly',  interval: 'year',  amount: 9999, currency: 'eur' },
];